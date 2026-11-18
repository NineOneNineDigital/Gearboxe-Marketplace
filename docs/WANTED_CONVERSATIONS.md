# Wanted-request conversations (GBXMRKT-44 implementation slice)

A seller may start one private conversation per active wanted request without publishing a vehicle listing. The first reply records the seller's vehicle summary and a snapshot of the request's original title, budget, general area, and vehicle criteria. It does not copy the buyer's private ZIP. Closing, expiring, or removing the public request does not remove an existing participant conversation.

Wanted threads use separate tables from listing-linked messages. Both paths consume the same per-account message and new-conversation rate limits and check recent duplicate text across both paths. Blocks and suspensions prevent new messages. The seller sees the other participant as **Buyer**, without account identity or contact details; either participant may voluntarily share details in messages.

Private reply photos have a separate upload and storage path from public listing media. The server validates and converts each photo to WebP. A message may attach at most ten. The browser fetches photos with an auth header; every download checks current thread participation and sends `private, no-store` headers. Attached photos have no automatic expiry in the MVP. Abandoned unattached uploads are cleaned up after 24 hours.

The buyer can pass on a seller response. That pauses messaging in that thread until the buyer explicitly reopens it; renewing the parent wanted request does not reopen the thread. The seller receives a generic notification without private rationale.

This slice does not implement account deletion. GBXMRKT-46 must preserve the surviving participant's read-only history and photos, label the missing participant **Deleted account**, remove public content, and handle retained request context without keeping the private ZIP. This dependency prevents GBXMRKT-44 and GBXMRKT-45 from being marked Done yet.
