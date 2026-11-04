"use client";

import { Button } from "@/components/ui/button";
import { EditProfileDialog } from "@/components/ui/edit-profile-dialog";
import { Footer } from "@/components/ui/footer";
import { Navbar } from "@/components/ui/navbar";
import { api } from "@/convex/_generated/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuth, useClerk, useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  CarFront,
  Check,
  Heart,
  Link2,
  LockKeyhole,
  Mail,
  MessageCircle,
  Plus,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

const preferenceLabels = [
  ["messages", "Messages"],
  ["listings", "Listing updates"],
  ["favorites", "Saved vehicles"],
  ["events", "Events"],
] as const;

export default function DashboardPage() {
  const { isLoading, user } = useCurrentUser();
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const { openUserProfile } = useClerk();
  const { user: clerkUser } = useUser();
  const userVehicles = useQuery(
    api.vehicles.getVehiclesByUser,
    user?._id ? { userId: user._id } : "skip"
  );
  const unreadCount = useQuery(
    api.messages.getUnreadCount,
    user?._id ? {} : "skip"
  );
  const preferences = useQuery(
    api.notifications.preferences,
    user?._id ? {} : "skip"
  );

  if (!authLoaded || isLoading) {
    return <div className="market-page flex min-h-screen items-center justify-center" role="status">Loading your account…</div>;
  }

  if (!isSignedIn) redirect("/sign-in");

  if (!user) {
    return <div className="market-page flex min-h-screen items-center justify-center" role="status">Setting up your account…</div>;
  }

  const displayName = clerkUser?.fullName || user.name;
  const emailAddress = clerkUser?.primaryEmailAddress?.emailAddress ?? user.email;
  const phoneNumber = clerkUser?.primaryPhoneNumber?.phoneNumber ?? user.phone;
  const emailVerified = clerkUser?.primaryEmailAddress
    ? clerkUser.primaryEmailAddress.verification.status === "verified"
    : user.emailVerified;
  const phoneVerified = clerkUser?.primaryPhoneNumber
    ? clerkUser.primaryPhoneNumber.verification.status === "verified"
    : user.phoneVerified;
  const firstName = displayName.split(" ")[0] || "there";
  const initials = displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "G";
  const activeListings = userVehicles?.filter((vehicle) => vehicle.status === "active").length ?? 0;
  const joined = new Date(user.createdAt);
  const accountType = user.role === "superAdmin" ? "Super admin" : user.role === "admin" ? "Admin" : "Member";
  const emailStatus = preferences?.emailSuppressed ? "Paused" : preferences?.emailEnabled ? "On" : "Off";

  return (
    <div className="market-page flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 bg-[hsl(var(--bone))]">
        <section className="relative overflow-hidden bg-[hsl(var(--midnight))] text-[hsl(var(--bone))]">
          <div className="market-grid pointer-events-none absolute inset-0 opacity-20" />
          <div className="market-shell relative py-8 sm:py-10">
            <p className="market-eyebrow text-[hsl(var(--chrome))]">Your garage / Account</p>
            <div className="mt-4 flex flex-wrap items-end justify-between gap-5">
              <div>
                <h1 className="text-3xl font-semibold leading-tight tracking-[-0.05em] sm:text-4xl">Welcome back, <span className="text-primary">{firstName}.</span></h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-[hsl(var(--chrome))]">
                  Your profile, marketplace activity, and communication settings in one place.
                </p>
              </div>
              <Button asChild className="font-semibold text-white">
                <Link href="/myAccount/new-listing"><Plus className="mr-2 h-4 w-4" /> List a vehicle</Link>
              </Button>
            </div>
          </div>
          <div className="market-ruler relative opacity-60" />
        </section>

        <div className="market-shell space-y-8 py-10 sm:py-14">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="market-card-shadow rounded-2xl border border-[hsl(var(--midnight)/0.12)] bg-white p-6 sm:p-8" aria-labelledby="profile-heading">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div>
                  <p className="market-eyebrow">01 / Profile</p>
                  <h2 id="profile-heading" className="mt-4 text-2xl font-semibold text-[hsl(var(--midnight))]">Your details</h2>
                </div>
                <EditProfileDialog />
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-5 border-b border-black/10 pb-7">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--midnight))] text-xl font-semibold text-white" aria-hidden="true">{initials}</div>
                <div className="min-w-0">
                  <p className="break-words text-xl font-semibold text-[hsl(var(--midnight))]">{displayName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Gearboxe {accountType.toLowerCase()}</p>
                </div>
              </div>
              <dl className="grid gap-6 pt-7 sm:grid-cols-2">
                <div className="min-w-0">
                  <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">Email address</dt>
                  <dd className="mt-2 break-all text-sm font-medium text-[hsl(var(--midnight))]">{emailAddress || "Not added"}</dd>
                  <dd className="mt-1 text-xs text-muted-foreground">{emailVerified ? "Verified" : "Not verified"}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">Phone number</dt>
                  <dd className="mt-2 text-sm font-medium text-[hsl(var(--midnight))]">{phoneNumber || "Not added"}</dd>
                  <dd className="mt-1 text-xs text-muted-foreground">{phoneVerified ? "Verified" : "Not verified"}</dd>
                </div>
              </dl>
            </section>

            <section className="rounded-2xl border border-[hsl(var(--midnight)/0.12)] bg-white p-6 sm:p-8" aria-labelledby="account-heading">
              <p className="market-eyebrow">02 / Account</p>
              <h2 id="account-heading" className="mt-4 text-2xl font-semibold text-[hsl(var(--midnight))]">Account information</h2>
              <dl className="mt-8 divide-y divide-black/10 border-y border-black/10">
                <div className="flex items-center justify-between gap-4 py-4 text-sm"><dt className="text-muted-foreground">Account type</dt><dd className="font-semibold">{accountType}</dd></div>
                <div className="flex items-center justify-between gap-4 py-4 text-sm"><dt className="text-muted-foreground">Member since</dt><dd className="font-semibold"><time dateTime={joined.toISOString()}>{joined.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</time></dd></div>
                <div className="flex items-center justify-between gap-4 py-4 text-sm"><dt className="text-muted-foreground">Active listings</dt><dd className="font-semibold">{userVehicles === undefined ? "…" : activeListings}</dd></div>
              </dl>
              <Link href="/myAccount/safety" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"><ShieldCheck className="h-4 w-4" /> Verification & safety <ArrowRight className="h-4 w-4" /></Link>
            </section>
          </div>

          <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <section className="rounded-2xl border border-[hsl(var(--midnight)/0.12)] bg-white p-6 sm:p-8" aria-labelledby="preferences-heading">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div><p className="market-eyebrow">03 / Preferences</p><h2 id="preferences-heading" className="mt-4 text-2xl font-semibold">Email updates</h2></div>
                <Bell className="h-6 w-6 text-primary" aria-hidden="true" />
              </div>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">Choose what reaches your inbox. In-app notifications stay available.</p>
              {preferences === undefined ? <p className="mt-6 text-sm text-muted-foreground" role="status">Loading preferences…</p> : (
                <>
                  <div className="mt-6 flex items-center justify-between border-y border-black/10 py-4 text-sm font-semibold"><span>Email notifications</span><span className="text-primary">{emailStatus}</span></div>
                  {preferences.emailSuppressed && <p className="mt-3 text-xs leading-5 text-muted-foreground">Email delivery is paused. Contact support to review your address.</p>}
                  <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                    {preferenceLabels.map(([key, label]) => {
                      const enabled = preferences.emailEnabled && !preferences.emailSuppressed && preferences[key];
                      return <li key={key} className="flex items-center gap-2 text-xs"><span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${enabled ? "bg-primary text-white" : "bg-black/10"}`}>{enabled && <Check className="h-2.5 w-2.5" />}</span><span>{label}: {enabled ? "On" : "Off"}</span></li>;
                    })}
                  </ul>
                </>
              )}
              <Button asChild variant="outline" className="mt-7"><Link href="/myAccount/notifications">Manage preferences <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            </section>

            <section className="rounded-2xl border border-[hsl(var(--midnight)/0.12)] bg-white p-6 sm:p-8" aria-labelledby="activity-heading">
              <p className="market-eyebrow">04 / Marketplace</p>
              <h2 id="activity-heading" className="mt-4 text-2xl font-semibold">Your activity</h2>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <Link href="/myAccount/my-listings" className="group flex items-center gap-4 rounded-xl border border-black/10 p-4 transition-colors hover:border-primary/60 hover:bg-primary/5"><CarFront className="h-6 w-6 text-primary" /><span className="flex-1"><span className="block text-sm font-semibold">My listings</span><span className="text-xs text-muted-foreground">{userVehicles?.length ?? 0} total vehicles</span></span><ArrowUpRight className="h-4 w-4" /></Link>
                <Link href="/myAccount/messages" className="group flex items-center gap-4 rounded-xl border border-black/10 p-4 transition-colors hover:border-primary/60 hover:bg-primary/5"><MessageCircle className="h-6 w-6 text-primary" /><span className="flex-1"><span className="block text-sm font-semibold">Messages</span><span className="text-xs text-muted-foreground">{unreadCount ? `${unreadCount} unread` : "Open conversations"}</span></span><ArrowUpRight className="h-4 w-4" /></Link>
                <Link href="/myAccount/favorites" className="group flex items-center gap-4 rounded-xl border border-black/10 p-4 transition-colors hover:border-primary/60 hover:bg-primary/5"><Heart className="h-6 w-6 text-primary" /><span className="flex-1"><span className="block text-sm font-semibold">Saved vehicles</span><span className="text-xs text-muted-foreground">Your favorites</span></span><ArrowUpRight className="h-4 w-4" /></Link>
                <Link href="/myAccount/registrations" className="group flex items-center gap-4 rounded-xl border border-black/10 p-4 transition-colors hover:border-primary/60 hover:bg-primary/5"><CalendarDays className="h-6 w-6 text-primary" /><span className="flex-1"><span className="block text-sm font-semibold">Event registrations</span><span className="text-xs text-muted-foreground">Tickets & receipts</span></span><ArrowUpRight className="h-4 w-4" /></Link>
              </div>
            </section>
          </div>

          <section className="rounded-2xl border border-[hsl(var(--midnight)/0.12)] bg-white p-6 sm:p-8" aria-labelledby="security-heading">
            <p className="market-eyebrow">05 / Sign-in & security</p>
            <h2 id="security-heading" className="mt-4 text-2xl font-semibold">Account access</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Manage how you sign in to your Gearboxe account.</p>
            <div className="mt-7 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-black/10 p-5">
                <LockKeyhole className="h-6 w-6 text-primary" aria-hidden="true" />
                <h3 className="mt-4 font-semibold">Password</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Add or update the password for your account.</p>
                <Button type="button" variant="outline" className="mt-5" onClick={() => openUserProfile({ __experimental_startPath: "/security" })}>Manage password <ArrowUpRight className="h-4 w-4" /></Button>
              </div>
              <div className="rounded-xl border border-black/10 p-5">
                <Link2 className="h-6 w-6 text-primary" aria-hidden="true" />
                <h3 className="mt-4 font-semibold">Connected accounts</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Review and manage linked sign-in providers.</p>
                <Button type="button" variant="outline" className="mt-5" onClick={() => openUserProfile()}>Manage connections <ArrowUpRight className="h-4 w-4" /></Button>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[hsl(var(--midnight)/0.12)] bg-white p-6 sm:p-8" aria-labelledby="recent-heading">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div><p className="market-eyebrow">From your garage</p><h2 id="recent-heading" className="mt-4 text-2xl font-semibold">Recent listings</h2></div>
              <Link href="/myAccount/my-listings" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">View all listings <ArrowRight className="h-4 w-4" /></Link>
            </div>
            {userVehicles === undefined ? <p className="mt-7 text-sm text-muted-foreground" role="status">Loading listings…</p> : userVehicles.length ? (
              <ul className="mt-7 divide-y divide-black/10 border-t border-black/10">{userVehicles.slice(0, 3).map((vehicle) => <li key={vehicle._id} className="flex flex-wrap items-center justify-between gap-4 py-5"><div><p className="font-semibold">{vehicle.title}</p><p className="mt-1 text-xs text-muted-foreground">{vehicle.year} {vehicle.make} {vehicle.model} · ${vehicle.price.toLocaleString()}</p></div><div className="flex items-center gap-4"><span className="text-xs font-medium capitalize text-muted-foreground">{vehicle.status}</span><Link href={`/vehicles/${vehicle._id}`} className="text-sm font-semibold text-primary hover:underline">View <ArrowUpRight className="inline h-3.5 w-3.5" /></Link></div></li>)}</ul>
            ) : <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-black/10 pt-7"><p className="text-sm text-muted-foreground">Your garage is ready for its first listing.</p><Button asChild variant="outline"><Link href="/myAccount/new-listing">Create a listing <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div>}
          </section>
          <p className="flex items-center gap-2 text-xs text-muted-foreground"><Mail className="h-4 w-4" /> Need help with your account? <Link href="/contact" className="font-semibold text-primary hover:underline">Contact us</Link></p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
