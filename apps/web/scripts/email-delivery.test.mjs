import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) for (const suffix of ['.ts','.js']) {
    const candidate = new URL(`${specifier}${suffix}`, context.parentURL);
    if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
  }
  return nextResolve(specifier, context);
} });
const provider = await import('../convex/lib/autosend.ts');
const records = await import('../convex/emailRecords.ts');
const http = await import('../convex/notificationHttp.ts');
const policy = await import('../convex/lib/emailPolicy.ts');
const config = provider.autosendConfiguration({ AUTOSEND_API_KEY:'secret',AUTOSEND_FROM_EMAIL:'send@example.test',APP_URL:'https://gearboxe.test',CONVEX_SITE_URL:'https://test.convex.site' });
const mail = { recipientEmail:'user@example.test',subject:'Update',message:'Private <tag> & text',path:'/account',unsubscribeToken:'a'.repeat(72),attempts:1 };
function fixture() {
 const user={_id:'user',email:'user@example.test',emailVerified:true};
 const row={_id:'mail',userId:'user',category:'messages',status:'pending',attempts:0,nextAttemptAt:0,createdAt:Date.now(),updatedAt:Date.now(),...mail};
 const tables={users:[user],emailOutbox:[row],emailWebhookEvents:[],emailSuppressions:[],userBlocks:[]};
 const scheduled=[];
 const ctx={db:{get:async id=>Object.values(tables).flat().find(x=>x._id===id)??null,patch:async(id,patch)=>Object.assign(await ctx.db.get(id),patch),insert:async(table,fields)=>{const id=`${table}-${tables[table].length}`;tables[table].push({_id:id,...fields});return id;},delete:async id=>{for(const rows of Object.values(tables)){const index=rows.findIndex(x=>x._id===id);if(index>=0)rows.splice(index,1);}},query:table=>{
  const predicates=[];const q={withIndex:(_name,callback)=>{const b={eq:(key,value)=>{predicates.push(x=>x[key]===value);return b;},lt:(key,value)=>{predicates.push(x=>x[key]<value);return b;},lte:(key,value)=>{predicates.push(x=>x[key]<=value);return b;}};callback(b);return q;},collect:async()=>tables[table].filter(x=>predicates.every(p=>p(x))),unique:async()=>{const rows=await q.collect();assert.ok(rows.length<=1);return rows[0]??null;},take:async n=>(await q.collect()).slice(0,n)};return q;
 }},scheduler:{runAfter:async(...args)=>scheduled.push(args)},runMutation:async(_ref,args)=>records.unsubscribe._handler(ctx,args)};
 return {ctx,tables,user,row,scheduled};
}
test('Autosend contract includes privacy controls and escaped notification content',async()=>{
 let request;const outcome=await provider.sendAutosend(config,mail,async(url,opts)=>{request={url,...opts};return Response.json({success:true,data:{emailId:'provider-id'}});});
 assert.deepEqual(outcome,{status:'accepted',providerId:'provider-id'});
 assert.equal(request.url,'https://api.autosend.com/v1/mails/send');
 const payload=JSON.parse(request.body);assert.deepEqual(payload.to,{email:mail.recipientEmail});assert.equal(payload.trackingOpen,false);assert.equal(payload.trackingClick,false);assert.equal(payload.bypassSuppressions,false);assert.match(payload.html,/&lt;tag&gt; &amp;/);assert.equal('headers' in payload,false);
});
test('429 retries while ambiguous acceptance never blindly resends',async()=>{
 const limited=await provider.sendAutosend(config,mail,async()=>new Response('',{status:429,headers:{'Retry-After':'120'}}));assert.equal(limited.status,'pending');assert.equal(limited.delayMs,120000);
 for(const code of [500,503,408])assert.equal((await provider.sendAutosend(config,mail,async()=>new Response('',{status:code}))).status,'uncertain');
 assert.equal((await provider.sendAutosend(config,mail,async()=>{throw Error('secret bearer');})).error,'provider_connection_uncertain');
 assert.equal((await provider.sendAutosend(config,mail,async()=>Response.json({success:true}))).status,'uncertain');
 assert.equal((await provider.sendAutosend(config,mail,async()=>new Response('',{status:400}))).status,'failed');
});
test('unsafe paths never reach provider',async()=>{
 for(const path of ['//evil.test','/\\evil.test','https://evil.test'])assert.equal((await provider.sendAutosend(config,{...mail,path},()=>{throw Error('called');})).status,'failed');
});
test('webhook matches actual raw body hex signature contract',async()=>{
 const body=JSON.stringify({type:'email.delivered',data:{emailId:'id'}});const signature=await provider.hmacHex(body,'test-secret');
 assert.equal(await provider.verifyAutosendSignature(body,signature,'test-secret'),true);
 assert.equal(await provider.verifyAutosendSignature(body+' ',signature,'test-secret'),false);
 assert.equal(await provider.verifyAutosendSignature(body,'sha256='+signature,'test-secret'),false);
 assert.equal(await provider.verifyAutosendSignature(body,signature,'wrong-secret'),false);
});
test('claim leases once and skips disabled/unverified/blocked/suppressed recipients',async()=>{
 const f=fixture();const args={id:'mail',leaseToken:'lease',unsubscribeToken:'token'};
 assert.equal((await records.claim._handler(f.ctx,args)).attempts,2);assert.equal(await records.claim._handler(f.ctx,args),null);
 for(const mode of ['unverified','disabled','suppressed','blocked']){const g=fixture();if(mode==='unverified')g.user.emailVerified=false;if(mode==='disabled')g.user.notificationPreferences={emailEnabled:false};if(mode==='suppressed')g.tables.emailSuppressions.push({email:g.user.email});if(mode==='blocked'){g.row.sourceUserId='sender';g.tables.users.push({_id:'sender'});g.tables.userBlocks.push({userId:'sender',blockedUserId:'user'});}assert.equal(await records.claim._handler(g.ctx,args),null);assert.equal(g.row.status,'skipped');}
});
test('retry limit and expired in-flight leases avoid duplicate sends',async()=>{
 const f=fixture();f.row.status='sending';f.row.leaseToken='lease';f.row.attempts=5;
 await records.complete._handler(f.ctx,{id:'mail',leaseToken:'lease',status:'pending',delayMs:100});assert.equal(f.row.status,'failed');assert.equal(f.scheduled.length,0);
 f.row.status='sending';f.row.leaseExpiresAt=0;await records.sweep._handler(f.ctx,{});assert.equal(f.row.status,'uncertain');assert.equal(f.scheduled.length,0);
});
test('webhook races persist and terminal statuses cannot regress; suppression uses send snapshot',async()=>{
 const f=fixture();await records.recordWebhook._handler(f.ctx,{eventKey:'event',providerId:'provider-id',type:'email.spam_reported',recipientEmail:'user@example.test',permanentBounce:false});
 assert.equal(f.tables.emailWebhookEvents.length,1);f.row.status='sending';f.row.leaseToken='lease';f.row.recipientEmail='user@example.test';f.user.email='new@example.test';
 await records.complete._handler(f.ctx,{id:'mail',leaseToken:'lease',status:'accepted',providerId:'provider-id'});assert.equal(f.row.status,'complained');assert.equal(f.tables.emailSuppressions[0].email,'user@example.test');
 await records.recordWebhook._handler(f.ctx,{eventKey:'late',providerId:'provider-id',type:'email.delivered',permanentBounce:false});assert.equal(f.row.status,'complained');
 await records.recordWebhook._handler(f.ctx,{eventKey:'event',providerId:'provider-id',type:'email.spam_reported',permanentBounce:false});assert.equal(f.tables.emailWebhookEvents.length,2);
});
test('unsubscribe GET does not mutate; POST disables emails; changed address/expired token fail',async()=>{
 const f=fixture();f.row.recipientEmail=f.user.email;f.row.unsubscribeToken='a'.repeat(72);const url=`https://test.convex.site/notifications/unsubscribe?token=${f.row.unsubscribeToken}`;
 const get=await http.unsubscribe._handler(f.ctx,new Request(url));assert.equal(get.status,200);assert.equal(f.user.notificationPreferences,undefined);
 const response=await http.unsubscribe._handler(f.ctx,new Request(url,{method:'POST',body:new URLSearchParams({token:f.row.unsubscribeToken})}));assert.equal(response.status,200);assert.equal(f.user.notificationPreferences.emailEnabled,false);
 f.user.email='changed@example.test';assert.equal(await records.unsubscribe._handler(f.ctx,{token:f.row.unsubscribeToken}),false);f.user.email=f.row.recipientEmail;f.row.createdAt=0;assert.equal(await records.unsubscribe._handler(f.ctx,{token:f.row.unsubscribeToken}),false);
});
test('webhook validates signatures before applying and limits streamed bodies',async()=>{
 process.env.AUTOSEND_WEBHOOK_SECRET='test-secret';let mutations=0;const ctx={runMutation:async()=>mutations++};const body=JSON.stringify({type:'email.delivered',data:{emailId:'provider-id'}});
 assert.equal((await http.autosendWebhook._handler(ctx,new Request('https://test/autosend-webhook',{method:'POST',body}))).status,401);assert.equal(mutations,0);
 const signature=await provider.hmacHex(body,process.env.AUTOSEND_WEBHOOK_SECRET);assert.equal((await http.autosendWebhook._handler(ctx,new Request('https://test/autosend-webhook',{method:'POST',body,headers:{'X-Webhook-Signature':signature}}))).status,200);assert.equal(mutations,1);
 assert.equal((await http.autosendWebhook._handler(ctx,new Request('https://test/autosend-webhook',{method:'POST',body:'x'.repeat(65537)}))).status,413);
});
test('retention deletes terminal records after90d and preserves unresolved deliveries/suppression',async()=>{
 const f=fixture();f.row.status='delivered';f.row.updatedAt=0;f.tables.emailOutbox.push({...f.row,_id:'uncertain',status:'uncertain'});f.tables.emailSuppressions.push({_id:'suppression',email:f.user.email});f.tables.emailWebhookEvents.push({_id:'old',createdAt:0});await records.cleanup._handler(f.ctx,{});assert.equal(f.tables.emailOutbox.length,1);assert.equal(f.tables.emailOutbox[0].status,'uncertain');assert.equal(f.tables.emailWebhookEvents.length,0);assert.equal(f.tables.emailSuppressions.length,1);
 assert.equal(policy.mergeDeliveryStatus('delivered','deferred'),'delivered');
});
test('operator reconciliation requires evidence and only resets confirmed unsent deliveries within bounds',async()=>{
 const f=fixture();f.tables.adminAuditLog=[];f.row.status='uncertain';
 await assert.rejects(records.reconcileUncertain._handler(f.ctx,{id:'mail',decision:'not_sent',reason:'user@example.test'}),/reference/);
 await records.reconcileUncertain._handler(f.ctx,{id:'mail',decision:'not_sent',reason:'INC-123'});assert.equal(f.row.status,'pending');assert.equal(f.scheduled.length,1);assert.equal(f.tables.adminAuditLog[0].source,'deployment-operator');
 f.row.status='uncertain';f.row.attempts=5;await records.reconcileUncertain._handler(f.ctx,{id:'mail',decision:'not_sent',reason:'INC-124'});assert.equal(f.row.status,'failed');assert.equal(f.scheduled.length,1);
 await assert.rejects(records.reconcileUncertain._handler(f.ctx,{id:'mail',decision:'not_sent',reason:'INC-125'}),/uncertain/);
});
test('operator acceptance reconciles persisted webhook and prevents duplicate provider identity',async()=>{
 const f=fixture();f.tables.adminAuditLog=[];f.row.status='uncertain';f.row.recipientEmail=f.user.email;
 await records.recordWebhook._handler(f.ctx,{eventKey:'early',providerId:'actual-provider',type:'email.delivered',permanentBounce:false});
 await assert.rejects(records.reconcileUncertain._handler(f.ctx,{id:'mail',decision:'accepted',reason:'INC-123'}),/provider email/);
 await records.reconcileUncertain._handler(f.ctx,{id:'mail',decision:'accepted',providerId:'actual-provider',reason:'provider:log123'});assert.equal(f.row.status,'delivered');assert.equal(f.row.providerId,'actual-provider');assert.equal(f.tables.adminAuditLog[0].action,'email_reconciled_accepted');
 f.tables.emailOutbox.push({...f.row,_id:'second',status:'uncertain',providerId:undefined});await assert.rejects(records.reconcileUncertain._handler(f.ctx,{id:'second',decision:'accepted',providerId:'actual-provider',reason:'INC-125'}),/already assigned/);
});
test('permanent bounce suppresses recipient while temporary bounce only tracks failed delivery',async()=>{
 for(const permanentBounce of [false,true]){const f=fixture();f.row.providerId='provider';f.row.recipientEmail=f.user.email;await records.recordWebhook._handler(f.ctx,{eventKey:'bounce',providerId:'provider',type:'email.bounced',recipientEmail:f.user.email,permanentBounce});assert.equal(f.row.status,'bounced');assert.equal(f.tables.emailSuppressions.length,permanentBounce?1:0);}
});
test('signed malformed webhook is rejected without mutation',async()=>{
 process.env.AUTOSEND_WEBHOOK_SECRET='secret';for(const body of ['null','[]','{"type":"email.delivered","data":null}','{broken']){const signature=await provider.hmacHex(body,'secret');const response=await http.autosendWebhook._handler({runMutation:async()=>assert.fail('must reject')},new Request('https://test/hook',{method:'POST',body,headers:{'X-Webhook-Signature':signature}}));assert.equal(response.status,400);}
});
