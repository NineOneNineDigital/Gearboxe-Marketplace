import type { Metadata } from "next";
import { PolicyDraft, PolicySection } from "../policy-draft";

export const metadata: Metadata = { title: "Privacy draft | Gearboxe", robots: { index: false, follow: false } };

export default function PrivacyPage() {
  return <PolicyDraft title="Privacy Policy draft">
    <PolicySection title="Who operates the marketplace">
      <p>Gearboxe operates this private-party vehicle marketplace. The legal entity name and mailing address must be confirmed before this policy becomes effective. Privacy requests may be sent to Help@gearboxe.com.</p>
    </PolicySection>
    <PolicySection title="Information we collect">
      <p>Account and verification information may include your name, email, phone number, account identifiers, verification status, preferences, and support requests. Sellers provide vehicle details, VIN, photos, city and state, a private vehicle ZIP or approximate coordinates for nearby search, disclosures, ownership attestations, and sometimes private ownership documents. Buyers and sellers provide messages and other marketplace actions. The site also handles basic technical and security information needed to operate accounts, detect abuse, and troubleshoot service.</p>
    </PolicySection>
    <PolicySection title="How information is used">
      <p>We use information to operate accounts, review and display listings, connect buyers and sellers, send service notifications, respond to support and safety reports, detect misuse, and maintain the service. We may use listing and engagement activity to understand whether the marketplace works. Any future marketing use or optional analytics must be reviewed against the actual implementation before this draft is approved.</p>
    </PolicySection>
    <PolicySection title="What other people can see">
      <p>Approved listings show vehicle details, photos, city and state, seller display information, and the full VIN. Draft, pending, and rejected listings are not public. Seller email, phone, vehicle ZIP, approximate coordinates, private documents, and precise location are not published in listing responses. Messages are available to their participants and authorized support staff when needed for safety or support. If you voluntarily share personal contact information in a message or photo, the recipient may see it.</p>
    </PolicySection>
    <PolicySection title="Service providers and other disclosures">
      <p>The current application uses Clerk for account authentication, Convex for application data and file storage, Autosend for transactional email when configured, and vehicle information services for VIN decoding. A ZIP lookup service may receive a buyer&apos;s search ZIP or a seller&apos;s vehicle ZIP used to place a listing in nearby results. These services process information needed for their functions. We may disclose information to respond to valid legal requests or to address safety, fraud, and abuse. The exact provider list and settings must be confirmed before approval.</p>
    </PolicySection>
    <PolicySection title="Browser storage and communications">
      <p>Authentication may use cookies or similar browser storage. The app uses browser storage for features such as recently viewed listings and keeping your place in inventory. Transactional messages may include account, listing, and conversation notices; notification preferences are available in your account where supported. This draft does not describe advertising cookies or claim that none exist until the deployed site is checked.</p>
    </PolicySection>
    <PolicySection title="Retention and security">
      <p>Private ownership documents are accessible for 30 days after upload and then expire; cleanup of storage objects may finish later. Sensitive information on inactive closed listings is scheduled for removal after 90 days of inactivity. The planned structured-offer flow has no note field and retains closed offer action history for six months; that deletion behavior must be verified before this draft becomes effective. Other account, report, moderation, and audit information may be kept longer for support and safety. Authorized staff access and private document reads are controlled and audited. No online service can promise perfect security. Retention details and provider settings need final operational review.</p>
    </PolicySection>
    <PolicySection title="Your choices and requests">
      <p>You can manage account contact details and notification preferences through your account, and update or close listings where available. For an access, correction, deletion, or other privacy request, contact Help@gearboxe.com. We will verify the request and explain any information that must be retained for safety, legal, or operational reasons. Applicable rights may vary by location.</p>
    </PolicySection>
    <PolicySection title="Changes and contact">
      <p>Before launch, this policy needs a final operator identity, effective date, version, provider and data-practice check, and founder approval. Later material changes should be dated and communicated through the site or account contact methods. Contact Help@gearboxe.com with questions.</p>
    </PolicySection>
  </PolicyDraft>;
}
