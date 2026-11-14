# Listing moderation coverage and rehearsal

This is a preparation checklist, not evidence that staffing, coverage, or a
rehearsal has been completed. The founder is primary moderator and support
owner. The backup is **TBD**. Naming, training, and verifying access for a backup,
and confirming staffed holiday coverage and handoff, remain launch blockers.
Do not publish a one-business-day promise until the clock rules and staffing
below are approved and demonstrated. The target is a response to a complete
submission within one business day, with staffed holiday coverage rather than a
published holiday exception.

## Decisions and coverage to complete

| Decision or evidence | Status / owner / date |
| --- | --- |
| Business hours, time zone, business days, and submission cutoff | TBD |
| Holiday calendar, staffed holiday hours, year-end roster and handoff | TBD |
| Clock start for complete submission; treatment of incomplete submissions | TBD |
| Clock stop for decision or documented evidence request; treatment of holds and resubmissions | TBD |
| Named backup, training and least-privilege access verification | TBD |
| Founder and backup absence escalation, contact channel and response owner | TBD |
| Target language and seller-facing cutoff approved for publication | TBD |

Complete the private roster before a nationwide buyer campaign. Do not put
personal contact information in this repository. Record each coverage period,
primary, backup, handoff time, confirmation, and escalation contact in the
team's approved private roster. The founder must arrange another trained
reviewer when unavailable; if coverage fails, escalate immediately, record the
gap and affected submissions, and do not represent the target as staffed.

## Queue and operating checks

1. In a staging environment, verify that the founder and named backup can sign
   in, access `/admin/listings` and `/admin/safety`, review a listing, record an
   audited decision, and access private evidence only when authorized. Test a
   non-admin denial. Assign only the access needed by the current role model;
   note any inability to grant narrower access as a launch gap.
2. Inspect the Pending review queue at each coverage handoff. The admin listings
   page shows a pending count, oldest known submission time, unknown-time count,
   and a **Review pending queue**
   action. Its pending order uses the latest transition to `pending` from the
   listing's moderation history, including resubmission; the time is shown in
   Eastern Time. For legacy pending rows without a matching history entry, the
   page labels the submission time unavailable and uses creation time only as a
   provisional sort fallback. Verify those rows in the moderation event log
   before assigning a deadline. This is not a business-day SLA timer. Use an
   access-controlled tracker to record the confirmed submission/resubmission
   timestamp, assigned reviewer, deadline under the approved clock rules, holds,
   and next action. Check queue completeness and escalate at-risk work to the
   founder and backup through the approved internal channel; record owner,
   action, and time.
3. Record only listing reference, reviewer, event timestamps, decision/hold
   category, and next action in the tracker. Keep VINs, contact details, private
   documents and document contents out of it. Use the audited admin workflow and
   approved private evidence channel; never put private evidence in public photos,
   listing text, a seller notification, or a general chat.
4. Verify each approve/reject reason appears in listing history and the audit log.
   Confirm the seller can see understandable status and actionable correction or
   evidence-request instructions. Check in-app notification and, where enabled,
   email outbox/delivery status; retry or escalate failures without putting
   private evidence into messages. A queued email is not proof of delivery.
5. Check the admin listings page's paginated **Reservation follow-up** section
   during each handoff. Each row identifies the listing, private offer thread,
   and seven-day check time. Open the listing and contact the seller through the
   approved support channel; keep it Reserved until the seller or an authorized
   operator records Sold or Available through the offer outcome workflow. A
   queue row is a prompt for follow-up, not evidence that an agreement ended.
   The queue displays no offer price or buyer identity. Verify a non-admin
   cannot query it directly. The current admin page does not itself resolve the
   offer, so the operator must use the authorized workflow and record the result.

## Review checklist

- Confirm seller email and phone verification, ownership attestation, private
  seller eligibility, and the vehicle's identity/VIN or eligible pre-1981 serial.
  Distinguish a titled owner from someone acting under documented authority;
  request private evidence when risk or policy calls for it. Multiple listings
  from one private account are a human-review signal, not a cap or proof of
  dealer activity.
- Inspect at least five distinct ready seller-owned photos labeled front, rear,
  left, right and interior. Reject misleading, borrowed, duplicate, blurry or
  irrelevant images and private documents, even when the labels and count pass.
- Compare the seller's accident, damage and mechanical disclosures with photos,
  reports and available history. A blank means only “No issue disclosed by
  seller.” Ask for correction when evidence conflicts; it is not verification.
- Review title, liens, mileage and odometer declaration. Branded titles remain
  eligible after enhanced review and must be explicitly disclosed to buyers.
  Outstanding liens require a documented payoff and transfer path before
  approval. Keep payoff and ownership evidence private.
- Confirm category and transfer eligibility. Street-legal specialty, modified or
  kit vehicles and unclear registration need enhanced manual review; escalate
  ambiguity. A declared category does not prove road legality.
- Escalate suspected stolen vehicles, ownership inconsistencies, possible fraud,
  safety reports, branded title or lien questions the reviewer cannot resolve to
  the designated safety lead. Record factual references, the issue, next owner,
  and a specific audited reason. Do not approve pending unresolved evidence.

## Rehearsal template — not yet run

Use synthetic accounts, vehicles and evidence in the isolated hosted staging
environment. Never upload real private documents. Record the environment and
version, participants, coverage schedule, approved clock rules and start/end
before starting. Exercise enough cases to represent a realistic week of expected
cohort volume; record the assumed volume rather than presenting it as actual.
Start with a draft saved before the rehearsal, then submit it later; confirm the
queue uses submission rather than draft creation. Reject and resubmit the same
listing; confirm its queue time moves to the later resubmission. Include one
legacy pending fixture without moderation history and check that it is labeled
as an estimate rather than treated as a measured SLA start.

| Case | Submit / resubmit time and zone | Reviewer / coverage | First response and final time | Decision, hold and reason category | Target met? / issue |
| --- | --- | --- | --- | --- | --- |
| Complete ordinary titled-owner listing | TBD | TBD | TBD | TBD | TBD |
| Weekend submission and next staffed handoff | TBD | TBD | TBD | TBD | TBD |
| Primary absence and backup handoff | TBD | TBD | TBD | TBD | TBD |
| Risk case: authorized non-owner and evidence request | TBD | TBD | TBD | TBD | TBD |
| Branded title: buyer disclosure, evidence/escalation and audited reason | TBD | TBD | TBD | TBD | TBD |
| Outstanding lien: private payoff/transfer path and audited enhanced review | TBD | TBD | TBD | TBD | TBD |
| Photo/disclosure inconsistency, rejection and corrected resubmission | TBD | TBD | TBD | TBD | TBD |
| Holiday or year-end staffed handoff and notification failure | TBD | TBD | TBD | TBD | TBD |

For each case, verify seller-visible state, private-evidence boundaries, audit
entries, and notification delivery or failure handling. Measure submission to
first qualifying response and final decision separately using the approved clock
rules. Record individual durations, median, range, missed targets and reasons;
include all cases rather than excluding holds silently. Assign each gap an owner,
due date and follow-up test. The founder signs off only after coverage, access,
clock rules, rehearsal evidence and corrective actions are verified. A missed
or blocked rehearsal stays open; this template does not establish readiness.
