"use client";

import { useMutation } from "convex/react";
import { makeFunctionReference } from "convex/server";
import {
  ArrowRight,
  Calendar,
  Car,
  CheckCircle2,
  Eye,
  Heart,
  Mail,
  MessageCircle,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { type FormEvent, useState } from "react";

function WaitlistForm({ variant = "light" }: { variant?: "light" | "dark" }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "already" | "error"
  >("idle");
  const joinWaitlist = useMutation(
    makeFunctionReference<
      "mutation",
      { email: string },
      { alreadyJoined: boolean }
    >("waitlist:join")
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email) return;

    setStatus("submitting");
    try {
      const result = await joinWaitlist({ email });
      setStatus(result.alreadyJoined ? "already" : "success");
      if (!result.alreadyJoined) setEmail("");
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="flex animate-fade-in-up items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-green-700">
        <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
        <span className="font-medium">
          You're on the list! We'll notify you when we launch.
        </span>
      </div>
    );
  }

  if (status === "already") {
    return (
      <div className="flex animate-fade-in-up items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/5 p-4 text-primary">
        <Mail className="h-5 w-5 flex-shrink-0" />
        <span className="font-medium">
          You're already on the waitlist. We'll be in touch!
        </span>
      </div>
    );
  }

  const isDark = variant === "dark";

  return (
    <>
      <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleSubmit}>
        <input
          className={`flex-1 rounded-lg border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring ${
            isDark
              ? "border-white/20 bg-white/10 text-white placeholder:text-white/50"
              : "border-input bg-white text-foreground placeholder:text-muted-foreground"
          }`}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === "error") setStatus("idle");
          }}
          placeholder="Enter your email"
          required
          type="email"
          value={email}
        />
        <button
          className={`group inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-6 py-3 font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
            isDark
              ? "bg-white text-primary shadow-lg hover:bg-gray-50"
              : "bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-primary/30 hover:shadow-xl"
          }`}
          disabled={status === "submitting"}
          type="submit"
        >
          {status === "submitting" ? (
            "Joining..."
          ) : (
            <>
              Join the Waitlist
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </>
          )}
        </button>
      </form>
      {status === "error" && (
        <p
          className={`mt-3 text-sm ${isDark ? "text-red-300" : "text-destructive"}`}
        >
          Something went wrong. Please try again.
        </p>
      )}
    </>
  );
}

export default function WaitlistPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-transparent border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between lg:h-18">
            <Link className="group flex items-center gap-2.5" href="/">
              <div className="flex flex-col">
                <span className="font-bold font-heading text-gray-900 text-lg uppercase tracking-tight">
                  Gearboxe
                </span>
                <span className="-mt-1 font-heading font-medium text-[10px] text-gray-500 uppercase tracking-widest">
                  Market
                </span>
              </div>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 via-white to-white">
          <div className="absolute inset-0 bg-grid-pattern opacity-30" />
          <div className="-top-24 -left-24 absolute h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
          <div className="-right-24 absolute top-1/2 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />

          <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-36">
            <div className="mx-auto max-w-4xl text-center">
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 font-medium text-primary text-sm">
                <Sparkles className="h-4 w-4" />
                Coming Soon
              </div>

              <h1 className="mb-6 font-bold text-4xl text-gray-900 tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
                The Smarter Way to
                <span className="relative mx-2 inline-block">
                  <span className="relative z-10 text-gradient-primary">
                    Buy & Sell
                  </span>
                  <span className="-bottom-2 -rotate-1 absolute right-0 left-0 h-3 rounded bg-primary/10" />
                </span>
                Used Cars
              </h1>

              <p className="mx-auto mb-10 max-w-2xl text-gray-600 text-lg leading-relaxed sm:text-xl">
                Gearboxe Market hosts local popup markets where used car buyers
                and sellers meet in person. Browse listings online, then show
                up, see the car, meet the seller, and drive away with
                confidence.
              </p>

              <div className="mx-auto max-w-md">
                <WaitlistForm />
              </div>

              <div className="mt-12 flex flex-col items-center justify-center gap-6 sm:flex-row sm:gap-10">
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Free to join
                </div>
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Be the first to know
                </div>
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  No spam, ever
                </div>
              </div>
            </div>
          </div>

          <div className="absolute right-0 bottom-0 left-0">
            <svg
              aria-hidden="true"
              className="h-12 w-full text-white"
              preserveAspectRatio="none"
              viewBox="0 0 1440 48"
            >
              <path
                d="M0,48L60,42.7C120,37,240,27,360,26.7C480,27,600,37,720,42.7C840,48,960,48,1080,42.7C1200,37,1320,27,1380,21.3L1440,16L1440,48L1380,48C1320,48,1200,48,1080,48C960,48,840,48,720,48C600,48,480,48,360,48C240,48,120,48,60,48L0,48Z"
                fill="currentColor"
              />
            </svg>
          </div>
        </section>

        {/* How It Works */}
        <section className="bg-white py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-16 text-center">
              <h2 className="mb-4 font-bold text-3xl text-gray-900 sm:text-4xl">
                How It Works
              </h2>
              <p className="mx-auto max-w-2xl text-gray-600 text-lg">
                List your car, sign up for a popup market, and meet buyers face
                to face
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
              {[
                {
                  icon: Car,
                  title: "List or Browse",
                  description:
                    "Sellers list their used cars with photos and details. Buyers browse verified listings and find what they're looking for.",
                  color: "bg-primary",
                },
                {
                  icon: Calendar,
                  title: "Show Up at a Popup Market",
                  description:
                    "We organize local popup markets where sellers bring their cars and buyers come to see them in person. No guessing — just show up.",
                  color: "bg-emerald-500",
                },
                {
                  icon: CheckCircle2,
                  title: "Make the Deal",
                  description:
                    "Inspect the car, talk to the seller face to face, and complete the purchase on the spot. Simple and transparent.",
                  color: "bg-violet-500",
                },
              ].map((step, index) => (
                <div className="group relative flex" key={step.title}>
                  <div className="relative flex flex-1 flex-col rounded-2xl border border-gray-100 bg-white p-8 shadow-sm transition-all duration-300 hover:border-gray-200 hover:shadow-lg">
                    <div className="-top-4 absolute left-8 flex h-8 w-8 items-center justify-center rounded-full border border-gray-100 bg-white font-bold text-gray-400 text-sm shadow-md">
                      {index + 1}
                    </div>
                    <div
                      className={`mb-6 inline-flex h-14 w-14 items-center justify-center rounded-xl ${step.color} text-white shadow-lg`}
                    >
                      <step.icon className="h-7 w-7" />
                    </div>
                    <h3 className="mb-3 font-semibold text-gray-900 text-xl">
                      {step.title}
                    </h3>
                    <p className="text-gray-600 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Why Gearboxe */}
        <section className="relative overflow-hidden border-gray-100 border-y bg-gradient-to-b from-primary/5 via-white to-white py-20 lg:py-24">
          <div className="absolute inset-0 bg-grid-pattern opacity-20" />
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-16 text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 font-medium text-primary text-sm">
                <Zap className="h-4 w-4" />
                Why Gearboxe?
              </div>
              <h2 className="mb-4 font-bold text-3xl text-gray-900 sm:text-4xl">
                Not Another Listing Site
              </h2>
              <p className="mx-auto max-w-2xl text-gray-600 text-lg">
                Online listings are full of scams and no-shows. Gearboxe Market
                brings used car buyers and sellers together at real popup
                markets — so every deal starts with a handshake.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  icon: Shield,
                  title: "Verified Sellers",
                  description:
                    "Every seller is vetted before they can list. No scams, no fake posts — just real people selling real cars.",
                  color: "text-primary",
                  bg: "bg-primary-50",
                },
                {
                  icon: Eye,
                  title: "In-Person Popup Markets",
                  description:
                    "See every car in person before you buy. Walk the lot, pop the hood, take a test drive — all at a local popup market.",
                  color: "text-emerald-600",
                  bg: "bg-emerald-50",
                },
                {
                  icon: MessageCircle,
                  title: "No Middlemen",
                  description:
                    "Message sellers directly through Gearboxe. No dealer markups, no hidden fees — just buyer and seller.",
                  color: "text-violet-600",
                  bg: "bg-violet-50",
                },
                {
                  icon: Heart,
                  title: "Local & Transparent",
                  description:
                    "Every transaction happens locally and face to face. You know exactly what you're getting and who you're buying from.",
                  color: "text-rose-600",
                  bg: "bg-rose-50",
                },
              ].map((item) => (
                <div
                  className="group relative rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-300 hover:border-primary/20 hover:shadow-lg"
                  key={item.title}
                >
                  <div
                    className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl ${item.bg}`}
                  >
                    <item.icon className={`h-6 w-6 ${item.color}`} />
                  </div>
                  <h3 className="mb-2 font-semibold text-gray-900 text-lg">
                    {item.title}
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="bg-gradient-premium py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="mb-4 font-bold text-3xl text-white sm:text-4xl">
                Be the First to Know
              </h2>
              <p className="mb-8 text-lg text-white/80">
                We're building the best way to buy and sell used cars locally.
                Join the waitlist — we'll send you one email when we launch.
              </p>
              <div className="mx-auto max-w-md">
                <WaitlistForm variant="dark" />
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="border-gray-100 border-t bg-gray-50/50">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <Link className="group flex items-center gap-2.5" href="/">
              <div className="flex flex-col">
                <span className="font-bold font-heading text-gray-900 text-lg uppercase tracking-tight">
                  Gearboxe
                </span>
                <span className="-mt-1 font-heading font-medium text-[10px] text-gray-500 uppercase tracking-widest">
                  Market
                </span>
              </div>
            </Link>
            <div className="flex items-center gap-6">
              <a
                className="flex items-center gap-1.5 text-gray-500 text-sm transition-colors hover:text-primary"
                href="mailto:hello@gearboxe.com"
              >
                <Mail className="h-3.5 w-3.5" />
                hello@gearboxe.com
              </a>
              <span className="h-4 w-px bg-gray-200" />
              <a
                className="text-gray-500 text-sm transition-colors hover:text-primary"
                href="https://gearboxe.com"
              >
                gearboxe.com
              </a>
            </div>
            <p className="text-gray-400 text-sm">
              {new Date().getFullYear()} Gearboxe
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
