import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
crons.interval("clean abandoned vehicle uploads", { minutes: 15 }, internal.mediaRecords.cleanup, {});
crons.interval("clean old listing view sessions", { hours: 1 }, internal.vehicles.cleanupViews, {});
crons.interval("purge closed listing sensitive data", { hours: 24 }, internal.privacy.cleanup, { cursor: null });
crons.interval("purge VIN decode cache", { hours: 24 }, internal.privacy.cleanupVinCache, {});
crons.interval("purge expired ownership documents", { hours: 1 }, internal.trust.cleanupDocuments, {});
crons.interval("recover pending email deliveries", { minutes: 1 }, internal.emailRecords.sweep, {});
crons.interval("purge old email delivery metadata", { hours: 24 }, internal.emailRecords.cleanup, {});
crons.interval("recover event checkout and refunds", { minutes: 1 }, internal.registrationPayments.sweep, {});
crons.interval("promote eligible event waitlists", { minutes: 1 }, internal.eventWaitlist.sweep, {});
export default crons;
