# Isolated seller-to-buyer browser test plan

**Browser foundation implemented; hosted seller-to-buyer journey not yet passed.**
The workspace now pins Playwright Test and provides three read-only Chromium public
smokes: seller entry/inventory navigation, ZIP-to-nationwide search with keyword
filter preservation, and signed-out wanted-board navigation. The ZIP
lookup response is deterministic; the inventory backend is not mocked. The
runner requires an explicit loopback or exact-allowlisted staging target before
opening a browser. Current CI still runs lint, types, Node tests and builds with
nonfunctional provider fixtures; it does not run these browser tests against a
backend. These public checks do not establish real auth, uploads, moderation or
private messaging/offer coverage.

Run against a separately started local web server with isolated provider
configuration:

```sh
pnpm --filter @gearboxe/web exec playwright install chromium
E2E_TARGET_KIND=local E2E_BASE_URL=http://127.0.0.1:3105 pnpm --filter @gearboxe/web test:e2e:public
```

The default runner uses its managed Chromium. On a Mac with Chrome installed,
`E2E_BROWSER_CHANNEL=chrome` may be used for local diagnosis. The runner disables
screenshots, video and traces because browser artifacts can disclose credentials
or private content. `test-results` and `playwright-report` are gitignored.

For staging, `E2E_TARGET_KIND=staging` also requires `MARKETPLACE_ENV=staging`,
`E2E_BASE_URL`, `E2E_ALLOWED_FRONTEND_ORIGIN`, `E2E_CONVEX_URL`,
`E2E_ALLOWED_CONVEX_URL`, `E2E_CLERK_ISSUER`, and
`E2E_ALLOWED_CLERK_ISSUER`. Each actual origin must exactly match its explicit
allowlist value. The guard rejects product domains and non-HTTPS staging URLs.
The operator must still verify that the deployed frontend really uses those
Convex and Clerk targets; environment values supplied to a test command alone
cannot prove a deployed build's configuration. The guard is covered by a Node
test. No staging credentials or target values belong in this document.

The first staging Vercel project shares the existing development Convex and
Clerk resources. It is an access-protected build and browsing preview only.
Only approved testers should reach it. It may run the read-only public smokes
after the operator confirms the deployed target IDs, allowlists and authorized
test access, but it does not satisfy the signed-in seller-to-buyer journey below.
The development backend currently permits one `APP_URL` origin for several
uploads, and a local backend push can change the shared test data/functions.
Keep the full-journey gate open until multi-origin support and safe test-data
ownership are implemented and verified, or a separate isolated test environment
is provisioned.

## Full-journey isolation and prerequisites

- Before running this full journey, provide verified multi-origin upload support
  and isolated test-data ownership on the chosen shared development resources,
  or provision separate staging Convex and Clerk resources. Record the frontend,
  backend and Clerk identifiers and the candidate SHA. Never use production
  accounts, tokens, domains, purchase funds, or databases. If separate staging
  Convex is later provisioned, check project identity and
  `MARKETPLACE_ENV=staging`, not deployment type alone.
- Before seeding or deletion, the runner must compare frontend origin, Convex
  URL/site URL and Clerk issuer against an explicit staging allowlist and refuse
  absent, mismatched or production targets. Verify webhook sync and real
  processing of uploads. Use short-lived, staging-scoped credentials in a
  protected secret store; never print them or upload browser auth state.
- Provision or reuse **synthetic only** Clerk accounts: `seller-outside-triangle`
  (private seller, e.g. Austin TX, verified email and phone, no invitation),
  `moderator` (authorized admin), `buyer-a` and `buyer-b` (verified email,
  phone not required), and `unrelated` (ordinary account). Use dedicated
  non-routable test addresses or provider-approved test inboxes, and synthetic
  phone verification; confirm signed webhook records before tests. Account
  setup, OTP and access method must be approved for the isolated Clerk instance;
  do not bypass production authentication in application code.
- Prepare five distinct synthetic clear vehicle images (front, rear, left,
  right, interior), no identifying metadata, documents or real license plates.
  Use unique test run ID and a syntactically valid, non-production synthetic
  VIN/serial per run; ensure no conflict with live VINs. Use a synthetic 2020
  car, TX city/state, realistic mileage and price, required specifications,
  explicit private-seller and no-lien declarations, and blank known-issue
  details. A second synthetic vehicle has a disclosed branded title or lien,
  synthetic evidence via private upload, and a payoff/transfer plan if liened.
  Do not use actual people, vehicles, lender information or bank account numbers.
- Give each run a unique namespace, test tag and isolated dataset ownership.
  Test email delivery with an isolated sink or controlled test inbox; record
  delivery state without sending to real recipients. Offers require both matched
  staging switches; popup payments remain off. No live payments are involved.

## Browser scenarios and assertions

1. Seller signs up without an invitation, verifies contact, creates draft, enters
   required information, uploads five labeled images and waits for processed
   variants, previews, then submits. Draft and pending are unavailable to an
   anonymous public query/page; full VIN is absent there. Seller self-approval
   is denied. Blank issue details show neutral seller-disclosure wording.
2. Moderator rejects with actionable reason; seller sees it, corrects and
   resubmits. Moderator approves; verify audit and notifications. Exercise the
   enhanced-review vehicle separately: approval fails until authorized documented
   review is complete, then the audited reason and public branded/lien disclosure
   are visible while evidence and payoff text remain private. Confirm buyer
   wording does not claim condition verification.
3. Anonymous buyer discovers the active listing in nationwide and ZIP search,
   sees full public VIN, and opens its detail page. Buyer A signs in with verified
   email and no required phone, sends an inquiry; seller receives in-app and
   email records with generic email content, and replies. Unrelated account
   cannot read the thread; preferences are respected. Use harmless synthetic
   text and never include actual conversation content in test artifacts.
   Include a synthetic legacy approved listing without mapped coordinates and
   verify it remains discoverable nationwide but is absent from the ZIP result.
   A separate nearby mapped listing must appear inside the 50-mile result.
   New submissions must reject missing approximate coordinates, and the operator
   must remediate existing approved unmapped inventory before promotion.
4. Separate fresh listing: buyer A submits whole-dollar offer, seller counters,
   buyer A accepts. Verify reserved badge in nationwide and ZIP results and
   direct detail, and structured metadata does not claim in-stock. Buyer B's
   earlier outstanding offer remains visible to participants but cannot be
   accepted after a winner; stale-version and unrelated-account actions fail.
   A second verified buyer can ask availability but cannot make a new offer.
   Verify only authorized participants see offers and generic notification
   records omit price and private text.
5. Run simultaneous accept attempts in separate browser contexts with an
   explicit barrier: exactly one accepted result and one reservation; assert
   failure on the other, not merely response order. End the accepted agreement,
   verify only the seller chooses Sold or Available, and that Available restarts
   45 days without reviving old offers. On the messaging fixture, mark Sold and
   verify public search and detail update while existing conversation remains
   accessible under privacy rules.

## Additional MVP flow checks on isolated staging

After the core GBXMRKT-3 journey is running, use the same isolated identities
and tagged records to verify the later MVP features:

6. Buyer requests private listing photos; seller replies. Confirm another buyer
   and an anonymous visitor cannot open the private images. Seller selects one
   reply image for public review; verify it remains private until a moderator
   approves it. Test request permissions while the listing is Reserved, then
   verify the seller's share post/card preview and download. A Sold shared URL
   must show only its approved summary; other inactive URLs must be generic.
7. Buyer saves two to four approved listings, creates a comparison link, and
   opens it signed out. Changing favorites must not change the link's members;
   current price and availability must update. Hide a member by withdrawing or
   removing it, then revoke the link and confirm direct URL denial. Delete the
   creator account in the isolated environment and confirm immediate denial of
   its remaining comparison links.
8. Buyer posts a wanted request with private ZIP and public general area; seller
   replies without a listing and attaches private photos. Confirm anonymous
   browsing omits ZIP and identity, unrelated accounts cannot read the thread or
   photos, and buyer dismiss/reopen controls messaging. Close or delete the
   request and confirm the participant still sees the original criteria. Delete
   either participant and confirm the survivor sees read-only history labeled
   “Deleted account,” while public wanted content disappears.

These checks require the same staging isolation, real provider wiring and safe
cleanup as the core journey. The daily inventory email digest is post-launch and
is not part of this release gate.

## Cleanup, evidence and execution

Use staging-only authorized test tooling, scoped by the unique run namespace,
for cleanup. Because published/sold listings, conversations, offers, moderation
logs and registration links have intentional retention, ordinary seller delete
is not a general reset. Prefer a disposable isolated backend per run or an
explicitly approved internal staging-only cleanup that removes only tagged test
records and associated storage. Verify counts return to baseline; on failure,
quarantine the environment, report the orphaned run ID to its owner and do not
wipe unrelated records. Do not add a public cleanup endpoint or reuse production
secrets. Define Clerk account cleanup separately and ensure delayed jobs cannot
mutate the next run.

Capture the tested SHA, frontend/backend/Clerk staging identifiers, run ID,
UTC times, scenario results and cleanup result. Disable or redact screenshot,
trace, network and video capture around authentication, private evidence,
messages and offer content; traces can contain tokens and request bodies. If a
failure cannot be safely redacted, retain a sanitized step/error summary instead
of uploading the raw artifact. Use restricted short-retention CI artifacts;
never include secrets, private documents, VINs or message bodies in Linear.

**Existing commands:** `pnpm install --frozen-lockfile`, `pnpm lint`,
`pnpm typecheck`, `pnpm test`, and `pnpm build` reproduce current CI checks; none
runs this browser journey. `pnpm --filter @gearboxe/web dev` and
`pnpm --filter @gearboxe/admin dev` start local frontends only after separately
configuring isolated providers; they do not create staging accounts or data.

**Next browser implementation:** extend the public foundation to a protected
seller/moderator/buyer suite after the shared environment can safely support
both web origins and isolated synthetic test records, or separate staging resources
exist. Add a protected CI job only for trusted
code with staging-scoped secrets, its managed Chromium and explicit target
guards; untrusted pull requests must not receive those secrets. A separate
post-deploy staging invocation must test the candidate's deployed origin and
record its SHA. The complete signed-in journey and cleanup must pass before
GBXMRKT-3 can be marked done.
