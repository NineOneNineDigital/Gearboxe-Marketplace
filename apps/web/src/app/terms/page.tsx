import type { Metadata } from "next";
import { PolicyDraft, PolicySection } from "../policy-draft";

export const metadata: Metadata = { title: "Terms draft | Gearboxe", robots: { index: false, follow: false } };

export default function TermsPage() {
  return <PolicyDraft title="Marketplace Terms draft">
    <PolicySection title="About Gearboxe">
      <p>Gearboxe provides a place for private sellers to advertise vehicles and for buyers and sellers to communicate. Gearboxe is not a party to a vehicle sale and does not act as a dealer, broker, lender, title agent, insurer, escrow provider, or holder of vehicle purchase funds. The buyer and seller are responsible for their own inspection, payment, and transfer arrangements.</p>
      <p><strong>Policy operator:</strong> legal entity name and mailing address to be confirmed before these Terms become effective.</p>
    </PolicySection>
    <PolicySection title="Accounts and eligibility">
      <p>You must be at least 18 to create an account. Public listings can be browsed without an account. Sellers must verify an email address and phone number before submitting a listing. Buyers must verify an email address before saving a listing, messaging, or making an offer where that feature is available. Keep your account information accurate and protect your sign-in credentials.</p>
    </PolicySection>
    <PolicySection title="Private-party listings">
      <p>Eligible private sellers in the 50 U.S. states and Washington, DC may submit a vehicle without an invitation. The seller must be the titled owner or have documented authority from the owner to sell. Dealers, undisclosed dealer activity, title jumping, parts-only vehicles, and vehicles without a supportable ownership path are not allowed. Each listing is reviewed before it appears publicly; submission does not guarantee approval.</p>
      <p>Sellers must provide accurate vehicle, mileage, title, lien, accident, damage, mechanical, and condition information to the best of their knowledge. Known material issues must be described. A blank accident, damage, or mechanical detail means no issue was disclosed by the seller; it is not a Gearboxe verification that the vehicle has no such issue. Branded titles and outstanding liens must be disclosed and may require enhanced review. A lien must have a documented payoff and transfer path. Gearboxe may request private ownership evidence, reject or remove a listing, or restrict an account when safety, accuracy, or policy concerns arise. The full VIN appears on approved public listings.</p>
    </PolicySection>
    <PolicySection title="Messages, offers, and purchase arrangements">
      <p>Start conversations through Gearboxe messaging. Contact information is private unless you choose to share it. Do not send spam, threats, fraud, or unlawful content. If Gearboxe offers structured offers and counteroffers, acceptance means a nonbinding agreement in principle and marks the listing reserved; it is not a completed sale or a promise by Gearboxe to process payment or transfer title. The buyer and seller arrange any final transaction independently.</p>
    </PolicySection>
    <PolicySection title="Fees and availability">
      <p>Standard vehicle listings, browsing, and marketplace messaging are free during this launch. Gearboxe may change or add paid services later only after disclosing their terms and price before use. Sellers must keep listings accurate and respond to availability confirmation requests. Gearboxe may expire or remove stale listings.</p>
    </PolicySection>
    <PolicySection title="Safety and responsibility">
      <p>Verify the vehicle and documents independently, inspect before purchase, and use care when meeting or paying another person. Gearboxe reviews listings but does not certify seller identity, ownership, vehicle condition, title status, or completion of a sale. Report suspected fraud or unsafe content through the site. We may moderate content and accounts, and users may request review through support.</p>
    </PolicySection>
    <PolicySection title="Changes and contact">
      <p>Before launch, these Terms need a final operator identity, effective date, version, and founder approval. Later material changes should be dated and communicated through the site or account contact methods. Questions can be sent to Help@gearboxe.com.</p>
    </PolicySection>
  </PolicyDraft>;
}
