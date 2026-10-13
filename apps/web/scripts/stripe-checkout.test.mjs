import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
registerHooks({ resolve(specifier, context, nextResolve) {
  if (context.parentURL && !context.parentURL.includes('/node_modules/') && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) for (const suffix of ['.ts','.js']) {
    const candidate = new URL(`${specifier}${suffix}`, context.parentURL);
    if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
  }
  return nextResolve(specifier, context);
} });
const Stripe = (await import('stripe')).default;
const payments = await import('../convex/registrationPayments.ts');
const { getFunctionName } = await import('convex/server');
process.env.STRIPE_SECRET_KEY='sk_test_stub';process.env.STRIPE_WEBHOOK_SECRET='whsec_stub';process.env.APP_URL='https://gearboxe.test';
function stripeStub(overrides={}) {
  const calls=[];
  const request=Stripe.StripeResource.prototype._makeRequest;
  Stripe.StripeResource.prototype._makeRequest=function(args,spec,overrideData) {
    const opts=this._getRequestOpts([...args],spec,overrideData);
    const call={method:opts.requestMethod,path:opts.requestPath,data:opts.bodyData,options:{idempotencyKey:opts.headers['Idempotency-Key']}};
    calls.push(call);
    const value=call.path==='/v1/refunds' && call.method==='GET' && !overrides.refundList ? {data:[],has_more:false} : overrides.handle?.(call) ?? {};
    if (value instanceof Error) return Promise.reject(value);
    return Promise.resolve(value);
  };
  return {calls,restore:()=>{Stripe.StripeResource.prototype._makeRequest=request;}};
}
const reservation={_id:'hold',eventId:'event',vehicleId:'vehicle',userId:'user',customerEmail:'seller@example.test',eventName:'Show',vehicleName:'Car',amount:2500,currency:'usd',expiresAt:Date.now()+35*60_000,createdAt:Date.now()};
function ctxFor(row=reservation) {
  const mutations=[];
  return {mutations,ctx:{runMutation:async(ref,args)=>{const name=getFunctionName(ref);mutations.push({name,args});return name.endsWith(':reserve')?row:name.endsWith(':recordPayment')?{registrationId:'registered'}:null;},runQuery:async()=>row}};
}
test('checkout reserves capacity before Stripe and charges only server snapshot with stable idempotency',async()=>{
  const f=ctxFor();const stub=stripeStub({handle:({path})=>path==='/v1/checkout/sessions'?{id:'cs_checkout',url:'https://checkout.stripe.com/session',status:'open'}:undefined});
  try {
    const result=await payments.createCheckout._handler(f.ctx,{eventId:'event',vehicleId:'vehicle'});
    assert.equal(result.url,'https://checkout.stripe.com/session');assert.equal(f.mutations[0].name,'eventBookings:reserve');
    assert.equal(stub.calls[0].data.line_items[0].price_data.unit_amount,2500);
    assert.equal(stub.calls[0].options.idempotencyKey,'event-registration:hold');
    assert.equal(stub.calls[0].data.expires_at,Math.floor(reservation.expiresAt/1000));
    assert.equal(stub.calls[0].data.customer_creation,'always');
    assert.equal(f.mutations[1].name,'eventBookings:markCheckoutAttempt');
    assert.equal(f.mutations[2].name,'eventBookings:attachSession');
  } finally {stub.restore();}
});
test('owner refresh retrieves persisted session and invalid provider amount goes to backend refund decision',async()=>{
  const f=ctxFor({...reservation,stripeSessionId:'cs_owned'});
  const stub=stripeStub({handle:()=>({id:'cs_owned',payment_status:'paid',currency:'usd',amount_total:1200,metadata:{reservationId:'hold',eventId:'event',vehicleId:'vehicle',userId:'user'},payment_intent:{id:'pi_paid',latest_charge:{id:'ch_paid',receipt_url:'https://pay.stripe.com/receipt'}},customer:'cus_seller'})});
  try {
    await payments.refreshCheckout._handler(f.ctx,{reservationId:'hold'});
    assert.equal(stub.calls[0].path,'/v1/checkout/sessions/cs_owned');
    const payment=f.mutations.find(x=>x.name==='eventBookings:recordPayment').args;
    assert.equal(payment.amount,1200);assert.equal(payment.stripePaymentId,'pi_paid');assert.equal(payment.stripeChargeId,'ch_paid');assert.equal(payment.metadataValid,true);
  } finally {stub.restore();}
});
test('webhook rejects forged signature before invoking durable records',async()=>{
  const f=ctxFor();
  await assert.rejects(payments.receiveWebhook._handler(f.ctx,{body:'{}',signature:'forged'}));
  assert.equal(f.mutations.length,0);
});
test('cancel expires Stripe before reservation release and never trusts browser session id',async()=>{
  const f=ctxFor({...reservation,stripeSessionId:'cs_owned'});
  let expired=false;
  const stub=stripeStub({handle:({path})=>{if(path.endsWith('/expire'))expired=true;return {id:'cs_owned',status:expired?'expired':'open',payment_status:'unpaid',metadata:{reservationId:'hold'}};}});
  try {await payments.cancelCheckout._handler(f.ctx,{reservationId:'hold'});assert.ok(stub.calls.some(x=>x.path==='/v1/checkout/sessions/cs_owned/expire'));assert.equal(f.mutations.at(-1).name,'eventBookings:releaseReservation');}
  finally {stub.restore();}
});
test('refund worker uses stable idempotency and forwards pending provider status without declaring success',async()=>{
  const mutations=[];const job={_id:'payment',stripePaymentId:'pi_paid',amount:2500,currency:'usd'};
  const ctx={runQuery:async ref=>getFunctionName(ref)==='paymentWebhookRecords:due'?[]:{reservations:[],refunds:[job],legacyMigrations:[]},runMutation:async(ref,args)=>{const name=getFunctionName(ref);mutations.push({name,args});return name==='eventBookings:claimRefund'?job:null;}};
  const stub=stripeStub({handle:()=>({id:'re_pending',status:'pending',amount:2500,currency:'usd',payment_intent:'pi_paid'})});
  try {await payments.sweep._handler(ctx,{});assert.equal(stub.calls[0].options.idempotencyKey,'event-refund:payment');assert.equal(stub.calls[0].data.payment_intent,'pi_paid');assert.equal(mutations.at(-1).name,'eventBookings:completeRefund');assert.equal(mutations.at(-1).args.status,'pending');}
  finally {stub.restore();}
});
test('active held checkout remains open while scheduled reconciliation checks for missed paid webhook',async()=>{
  const mutations=[];const held={...reservation,status:'held',stripeSessionId:'cs_open'};
  const ctx={runQuery:async ref=>getFunctionName(ref)==='paymentWebhookRecords:due'?[]:getFunctionName(ref)==='eventBookings:listWork'?{reservations:[held],refunds:[],legacyMigrations:[]}:held,runMutation:async(ref,args)=>{mutations.push({name:getFunctionName(ref),args});}};
  const stub=stripeStub({handle:()=>({id:'cs_open',status:'open',expires_at:Math.floor(held.expiresAt/1000),payment_status:'unpaid',metadata:{reservationId:'hold'}})});
  try {await payments.sweep._handler(ctx,{});assert.equal(stub.calls.length,2);assert.ok(stub.calls.every(x=>x.method==='GET'));assert.ok(!mutations.some(x=>x.name==='eventBookings:releaseReservation'));}
  finally {stub.restore();}
});
test('webhook persistence deduplicates provider events and recovers expired processing leases',async()=>{
  const records=await import('../convex/paymentWebhookRecords.ts');let row=null;
  const ctx={db:{query:()=>({withIndex:()=>({unique:async()=>row})}),insert:async(_table,args)=>{row={_id:'webhook',...args};return row._id;},get:async()=>row,patch:async(_id,args)=>Object.assign(row,args)}};
  const input={eventId:'evt_one',type:'checkout.session.completed',objectId:'cs_one'};
  await records.record._handler(ctx,input);await records.record._handler(ctx,input);assert.equal(row.attempts,0);
  assert.ok(await records.claim._handler(ctx,{eventId:input.eventId}));assert.equal(row.attempts,1);
  assert.equal(await records.claim._handler(ctx,{eventId:input.eventId}),null);
  row.nextAttemptAt=0;assert.ok(await records.claim._handler(ctx,{eventId:input.eventId}));
  await records.finish._handler(ctx,{eventId:input.eventId,error:'provider_timeout'});assert.equal(row.status,'pending');
  row.nextAttemptAt=0;await records.claim._handler(ctx,{eventId:input.eventId});await records.finish._handler(ctx,{eventId:input.eventId});assert.equal(row.status,'completed');
  await records.finish._handler(ctx,{eventId:input.eventId,error:'late_failure'});assert.equal(row.status,'completed');assert.equal(await records.claim._handler(ctx,{eventId:input.eventId}),null);
});
test('signed webhook durably queues event and independently fetches session instead of trusting payload amount',async()=>{
 const mutations=[];
 const row={eventId:'evt_valid',type:'checkout.session.completed',objectId:'cs_verified'};
 const ctx={runQuery:async()=>reservation,runMutation:async(ref,args)=>{const name=getFunctionName(ref);mutations.push({name,args});if(name==='paymentWebhookRecords:claim')return row;return null;}};
 const body=JSON.stringify({id:row.eventId,type:row.type,data:{object:{id:row.objectId,payment_status:'paid',amount_total:999999}}});
 const signature=Stripe.webhooks.generateTestHeaderString({payload:body,secret:process.env.STRIPE_WEBHOOK_SECRET});
 const stub=stripeStub({handle:()=>({id:'cs_verified',payment_status:'paid',amount_total:2500,currency:'usd',payment_intent:'pi_verified',metadata:{reservationId:'hold',userId:'user',eventId:'event',vehicleId:'vehicle'}})});
 try {await payments.receiveWebhook._handler(ctx,{body,signature});assert.equal(mutations[0].name,'paymentWebhookRecords:record');assert.equal(mutations.find(x=>x.name==='eventBookings:recordPayment').args.amount,2500);assert.equal(mutations.at(-1).name,'paymentWebhookRecords:finish');}
 finally {stub.restore();}
});
test('refund before checkout fulfillment reuses existing provider refund and never grants paid admission',async()=>{
 const f=ctxFor({...reservation,stripeSessionId:'cs_refunded'});
 const stub=stripeStub({refundList:true,handle:({path})=>path==='/v1/refunds'?{data:[{id:'re_existing',amount:2500,status:'pending'}],has_more:false}:{id:'cs_refunded',payment_status:'paid',currency:'usd',amount_total:2500,metadata:{reservationId:'hold',eventId:'event',vehicleId:'vehicle',userId:'user'},payment_intent:{id:'pi_refunded',latest_charge:{id:'ch_paid',amount_refunded:0}}}});
 try {await payments.refreshCheckout._handler(f.ctx,{reservationId:'hold'});const payment=f.mutations.find(x=>x.name==='eventBookings:recordPayment').args;assert.equal(payment.providerRefundState,'full');assert.equal(payment.stripeRefundId,'re_existing');assert.ok(stub.calls.every(x=>x.method==='GET'));}
 finally {stub.restore();}
});
test('manual retry independently verifies terminal failed refund then uses new generation key',async()=>{
 const job={_id:'payment',stripePaymentId:'pi_paid',stripeRefundId:'re_failed',refundGeneration:1,amount:2500,currency:'usd'};const mutations=[];
 const ctx={runQuery:async ref=>getFunctionName(ref)==='paymentWebhookRecords:due'?[]:{reservations:[],refunds:[job],legacyMigrations:[]},runMutation:async(ref,args)=>{const name=getFunctionName(ref);mutations.push({name,args});return name==='eventBookings:claimRefund'?job:null;}};
 const stub=stripeStub({refundList:true,handle:({path,method})=>path==='/v1/refunds/re_failed'?{id:'re_failed',status:'failed'}:method==='GET'?{data:[{id:'re_failed',status:'failed',amount:2500}],has_more:false}:{id:'re_retry',status:'succeeded',amount:2500,currency:'usd',payment_intent:'pi_paid'}});
 try {await payments.sweep._handler(ctx,{});assert.equal(stub.calls.length,3);assert.equal(stub.calls[2].options.idempotencyKey,'event-refund:payment:1');assert.equal(mutations.at(-1).args.stripeRefundId,'re_retry');}
 finally {stub.restore();}
});
test('legacy import verifies provider session and passes original fee snapshot plus receipt refs',async()=>{
 const mutations=[];const ctx={runMutation:async(ref,args)=>{const name=getFunctionName(ref);mutations.push({name,args});return name==='eventBookings:claimLegacyMigration'?{_id:'legacy',stripePaymentId:'cs_legacy'}:null;}};
 const stub=stripeStub({handle:()=>({id:'cs_legacy',payment_status:'paid',currency:'usd',amount_total:1900,metadata:{userId:'user',eventId:'event',vehicleId:'vehicle'},payment_intent:{id:'pi_legacy',latest_charge:{id:'ch_legacy',receipt_url:'https://pay.stripe.com/receipt',amount_refunded:0}},customer:'cus_legacy'})});
 try {await payments.migrateLegacyPayment._handler(ctx,{registrationId:'legacy'});assert.equal(mutations[1].name,'eventBookings:linkLegacyPayment');assert.equal(mutations[1].args.amount,1900);assert.equal(mutations[1].args.stripePaymentId,'pi_legacy');assert.equal(mutations[1].args.metadataUserId,'user');}
 finally {stub.restore();}
});
test('legacy provider outage persists a safe retry and scheduled recovery links payment only once',async()=>{
 const mutations=[];const row={_id:'legacy-retry',stripePaymentId:'cs_legacy_retry',legacyMigrationAttempts:1};let available=true;let linked=false;let providerDown=true;
 const ctx={runQuery:async ref=>getFunctionName(ref)==='paymentWebhookRecords:due'?[]:{reservations:[],refunds:[],legacyMigrations:[row]},runMutation:async(ref,args)=>{
   const name=getFunctionName(ref);mutations.push({name,args});
   if(name==='eventBookings:claimLegacyMigration'){if(!available||linked)return null;available=false;return row;}
   if(name==='eventBookings:finishLegacyMigration')return null;
   if(name==='eventBookings:linkLegacyPayment'){linked=true;return null;}
 }};
 const stub=stripeStub({handle:()=>providerDown?new Error('provider connection token private_secret'):({id:'cs_legacy_retry',payment_status:'paid',currency:'usd',amount_total:1900,metadata:{userId:'user',eventId:'event',vehicleId:'vehicle'},payment_intent:'pi_legacy_retry'})});
 try {
   await payments.migrateLegacyPayment._handler(ctx,{registrationId:row._id});
   assert.equal(mutations.at(-1).name,'eventBookings:finishLegacyMigration');assert.equal(mutations.at(-1).args.error,'stripe_legacy_payment_reconciliation_failed');assert.equal(mutations.at(-1).args.attempt,1);
   const callsAfterFailure=stub.calls.length;
   await payments.migrateLegacyPayment._handler(ctx,{registrationId:row._id});assert.equal(stub.calls.length,callsAfterFailure);
   available=true;providerDown=false;await payments.sweep._handler(ctx,{});await payments.sweep._handler(ctx,{});
   assert.equal(mutations.filter(x=>x.name==='eventBookings:linkLegacyPayment').length,1);
 } finally {stub.restore();}
});
test('successful partial provider refund cannot complete a full registration refund or release capacity',async()=>{
 const job={_id:'partial-payment',stripePaymentId:'pi_partial',stripeRefundId:'re_partial',refundGeneration:1,amount:4900,currency:'usd'};
 const mutations=[];
 const ctx={runQuery:async ref=>getFunctionName(ref)==='paymentWebhookRecords:due'?[]:{reservations:[],refunds:[job],legacyMigrations:[]},runMutation:async(ref,args)=>{const name=getFunctionName(ref);mutations.push({name,args});return name==='eventBookings:claimRefund'?job:null;}};
 const stub=stripeStub({handle:()=>({id:'re_partial',status:'succeeded',amount:100,currency:'usd',payment_intent:'pi_partial'})});
 try {await payments.sweep._handler(ctx,{});assert.equal(mutations.at(-1).name,'eventBookings:failRefund');assert.equal(mutations.at(-1).args.error,'stripe_refund_amount_requires_operator_reconciliation');assert.ok(!mutations.some(x=>x.name==='eventBookings:completeRefund'));assert.ok(stub.calls.every(x=>x.method==='GET'));}
 finally {stub.restore();}
});
