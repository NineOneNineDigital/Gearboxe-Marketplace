"use client";

import { EventCard } from "@/components/ui/event-card";
import { Footer } from "@/components/ui/footer";
import { Navbar } from "@/components/ui/navbar";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { Calendar, Car, MapPin, MessageCircle } from "lucide-react";

const expectations = [
  { icon: Car, title: "See the cars", text: "Walk the lineup and take in the details in person." },
  { icon: MessageCircle, title: "Meet the owners", text: "Ask direct questions and hear the story behind the vehicle." },
  { icon: MapPin, title: "Gather locally", text: "Weekend events built around the regional car community." },
];

export default function EventsPage() {
  const upcomingEvents = useQuery(api.events.getUpcomingEvents);

  return (
    <div className="market-page flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <section className="market-grid border-b border-white/10 bg-[hsl(var(--midnight))] py-16 text-[hsl(var(--bone))] sm:py-20">
          <div className="market-shell">
            <p className="market-eyebrow text-[hsl(var(--chrome))]">Gearboxe in person</p>
            <div className="mt-6 grid gap-7 lg:grid-cols-[1.35fr_0.65fr] lg:items-end">
              <h1 className="market-section-title max-w-3xl text-white">The marketplace is better around the cars.</h1>
              <p className="max-w-md text-sm leading-7 text-[hsl(var(--chrome))] lg:justify-self-end">
                Meet sellers, explore the lineup, and connect with the local
                Gearboxe community at our popup markets.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-[hsl(var(--bone))] py-16 text-[hsl(var(--midnight))] sm:py-24">
          <div className="market-shell">
            <div className="flex items-end justify-between gap-6 border-b border-black/10 pb-6">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[hsl(var(--gunmetal))]">On the calendar</p>
                <h2 className="mt-2 text-3xl font-semibold">Upcoming events</h2>
              </div>
              <span className="market-metric text-sm text-[hsl(var(--gunmetal))]">
                {upcomingEvents?.length ?? 0} scheduled
              </span>
            </div>

            {upcomingEvents === undefined ? (
              <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map((item) => <div key={item} className="h-96 animate-pulse rounded-xl bg-black/5" />)}
              </div>
            ) : upcomingEvents.length > 0 ? (
              <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {upcomingEvents.map((event) => <EventCard key={event._id} event={event} />)}
              </div>
            ) : (
              <div className="market-grid mt-8 rounded-2xl border border-black/10 bg-white/50 px-6 py-20 text-center">
                <Calendar className="mx-auto h-9 w-9 text-primary" />
                <h3 className="mt-5 text-2xl font-semibold">The next date is being lined up.</h3>
                <p className="mt-3 text-sm text-[hsl(var(--gunmetal))]">Check back soon for the next Gearboxe Market gathering.</p>
              </div>
            )}
          </div>
        </section>

        <section className="market-grid border-t border-border bg-background py-16 sm:py-20">
          <div className="market-shell">
            <p className="market-eyebrow">What to expect</p>
            <div className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3">
              {expectations.map(({ icon: Icon, title, text }, index) => (
                <article key={title} className="bg-card p-7 sm:p-8">
                  <div className="flex items-center justify-between">
                    <Icon className="h-5 w-5 text-primary" />
                    <span className="font-mono text-[9px] text-muted-foreground">0{index + 1}</span>
                  </div>
                  <h3 className="mt-8 text-xl font-semibold">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
