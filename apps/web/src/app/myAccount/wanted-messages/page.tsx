"use client";

import { Button } from "@/components/ui/button";
import { Footer } from "@/components/ui/footer";
import { Navbar } from "@/components/ui/navbar";
import { api } from "@/convex/_generated/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuery } from "convex/react";
import Link from "next/link";

const money = (amount: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);

export default function WantedMessagesPage() {
  const { user, isLoading } = useCurrentUser();
  const conversations = useQuery(api.wantedConversations.listMine, user ? {} : "skip");
  return <div className="market-page min-h-screen flex flex-col"><Navbar /><main className="market-shell flex-1 py-10 space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><Link className="text-sm underline" href="/myAccount/messages">All messages</Link><h1 className="mt-3 text-3xl font-bold">Wanted-request conversations</h1><p className="mt-2 text-muted-foreground">Private responses to requests for vehicles.</p></div><Button asChild variant="outline"><Link href="/wanted">Browse requests</Link></Button></div>
    {isLoading ? <p role="status">Loading your account…</p> : !user ? <p><Link className="underline" href="/sign-in?next=%2FmyAccount%2Fwanted-messages">Sign in</Link> to see conversations.</p> : conversations === undefined ? <p role="status">Loading conversations…</p> : conversations.length === 0 ? <p>No wanted-request conversations yet. Sellers can respond from the <Link className="underline" href="/wanted">wanted board</Link>.</p> : <div className="space-y-3">{conversations.map(thread => <Link key={thread._id} href={`/myAccount/wanted-messages/${thread._id}`} className="block rounded-xl border bg-white p-5 transition-colors hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">{thread.requestSnapshot.title}</h2><p className="mt-1 text-sm text-muted-foreground">{thread.role === "buyer" ? "Seller" : "Buyer"}: {thread.otherUserName} · {thread.sellerVehicle.year} {thread.sellerVehicle.make} {thread.sellerVehicle.model}</p></div><div className="flex gap-2">{thread.dismissed && <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">Passed</span>}{thread.unreadCount > 0 && <span className="rounded-full bg-primary px-2 py-1 text-xs text-white">{thread.unreadCount} unread</span>}</div></div>
      <p className="mt-2 text-sm">Seller asking price {money(thread.sellerVehicle.askingPrice)}</p>
      {thread.lastMessage && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{thread.lastMessage.content}</p>}
      <p className="mt-2 text-xs text-muted-foreground">Updated {new Date(thread.lastMessageAt).toLocaleString()}</p>
    </Link>)}</div>}
  </main><Footer /></div>;
}
