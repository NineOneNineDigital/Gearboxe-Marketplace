"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Footer } from "@/components/ui/footer";
import { Navbar } from "@/components/ui/navbar";
import { ChevronDown, Mail } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const faq = [
  {
    question: "How do I list my vehicle?",
    answer: "Create an account, verify your email and phone, and start a listing. You can save an incomplete draft. Before submitting for manual review, add the required vehicle details and five clear photos showing the front, rear, left side, right side, and interior. You will see the review result in your account.",
  },
  {
    question: "What does Gearboxe charge at launch?",
    answer: "Standard vehicle listings, browsing, and buyer–seller messaging are free. Gearboxe does not process the purchase price of a vehicle.",
  },
  {
    question: "Who can list a vehicle?",
    answer: "Eligible private sellers in all 50 states and Washington, DC can submit without an invitation. You must be the titled owner or have documented permission from the owner. Each listing is reviewed before it becomes public.",
  },
  {
    question: "Which vehicles belong on Gearboxe?",
    answer: "The marketplace focuses on passenger cars, trucks, SUVs, and street-legal specialty vehicles. Disclose title brands, liens, damage, accidents, and known mechanical issues accurately. Branded titles and liens require additional review; a submitted listing is not guaranteed approval.",
  },
  {
    question: "How do I contact a seller?",
    answer: "Browse listings without an account. To save a vehicle or message its seller, sign in and verify your email. Messages begin inside Gearboxe, and either person can choose whether to share contact details later.",
  },
  {
    question: "How do buyers and sellers complete a sale?",
    answer: "Buyers and sellers arrange inspection, payment, and title transfer independently. Gearboxe does not hold vehicle-purchase funds or guarantee a transaction. Consider an independent inspection and check the vehicle's history before paying.",
  },
  {
    question: "What if my listing changes or the vehicle sells?",
    answer: "Keep your listing accurate and mark it sold or withdrawn promptly. Material edits may require another review. An active listing needs availability confirmation every 45 days; Gearboxe reminds you seven days before it expires. If it expires, you can reopen it as a draft and submit it for review without a fee.",
  },
];

export default function ContactPage() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="market-page flex min-h-screen flex-col">
      <Navbar />
      <main className="market-shell flex-1 py-12 sm:py-16">
        <div className="mx-auto max-w-3xl space-y-10">
          <header className="space-y-4 text-center">
            <h1 className="text-4xl font-semibold text-foreground sm:text-5xl">Contact Gearboxe</h1>
            <p className="text-base leading-7 text-muted-foreground">Questions about an account, listing, or marketplace safety? Our team can help.</p>
            <Button asChild><a href="mailto:Help@gearboxe.com"><Mail className="h-4 w-4" aria-hidden="true" /> Email Help@gearboxe.com</a></Button>
            <p className="text-xs text-muted-foreground">If a listing or message seems unsafe, use its Report action so our moderators receive the relevant context.</p>
          </header>
          <section aria-labelledby="faq-title" className="space-y-4">
            <h2 id="faq-title" className="text-2xl font-semibold text-foreground">Frequently asked questions</h2>
            {faq.map((item, index) => {
              const expanded = open === index;
              const id = `faq-answer-${index}`;
              return <Card key={item.question} className="overflow-hidden">
                <h3>
                  <button type="button" aria-expanded={expanded} aria-controls={id} onClick={() => setOpen(expanded ? null : index)} className="flex w-full items-center justify-between gap-4 p-5 text-left text-base font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                    {item.question}<ChevronDown className={`h-5 w-5 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
                  </button>
                </h3>
                {expanded && <p id={id} className="border-t px-5 py-4 text-sm leading-7 text-muted-foreground">{item.answer}</p>}
              </Card>;
            })}
          </section>
          <p className="text-center text-sm text-muted-foreground">Ready to browse? <Link href="/vehicles" className="font-semibold text-primary underline underline-offset-4">Explore vehicles</Link></p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
