/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as admin from "../admin.js";
import type * as cities from "../cities.js";
import type * as conversations from "../conversations.js";
import type * as crons from "../crons.js";
import type * as discovery from "../discovery.js";
import type * as emailDelivery from "../emailDelivery.js";
import type * as emailRecords from "../emailRecords.js";
import type * as eventBookings from "../eventBookings.js";
import type * as eventOperations from "../eventOperations.js";
import type * as eventWaitlist from "../eventWaitlist.js";
import type * as events from "../events.js";
import type * as favorites from "../favorites.js";
import type * as http from "../http.js";
import type * as lib_authorization from "../lib/authorization.js";
import type * as lib_autoDev from "../lib/autoDev.js";
import type * as lib_autosend from "../lib/autosend.js";
import type * as lib_discoveryIndex from "../lib/discoveryIndex.js";
import type * as lib_discoveryPolicy from "../lib/discoveryPolicy.js";
import type * as lib_emailPolicy from "../lib/emailPolicy.js";
import type * as lib_environment from "../lib/environment.js";
import type * as lib_eventOperationsPolicy from "../lib/eventOperationsPolicy.js";
import type * as lib_eventPaymentPolicy from "../lib/eventPaymentPolicy.js";
import type * as lib_eventStaff from "../lib/eventStaff.js";
import type * as lib_eventVisibility from "../lib/eventVisibility.js";
import type * as lib_imageProcessing from "../lib/imageProcessing.js";
import type * as lib_listingLifecycle from "../lib/listingLifecycle.js";
import type * as lib_mediaPolicy from "../lib/mediaPolicy.js";
import type * as lib_provisioning from "../lib/provisioning.js";
import type * as lib_trustGuards from "../lib/trustGuards.js";
import type * as lib_trustPolicy from "../lib/trustPolicy.js";
import type * as lib_vehicleMedia from "../lib/vehicleMedia.js";
import type * as lib_vehicleSpecification from "../lib/vehicleSpecification.js";
import type * as lib_vehicleValidation from "../lib/vehicleValidation.js";
import type * as lib_vehicleVisibility from "../lib/vehicleVisibility.js";
import type * as lib_vinDecoder from "../lib/vinDecoder.js";
import type * as lib_vpic from "../lib/vpic.js";
import type * as media from "../media.js";
import type * as mediaProcessing from "../mediaProcessing.js";
import type * as mediaRecords from "../mediaRecords.js";
import type * as mediaUpload from "../mediaUpload.js";
import type * as messages from "../messages.js";
import type * as notificationHttp from "../notificationHttp.js";
import type * as notifications from "../notifications.js";
import type * as paymentWebhookRecords from "../paymentWebhookRecords.js";
import type * as privacy from "../privacy.js";
import type * as recentViews from "../recentViews.js";
import type * as registrationPayments from "../registrationPayments.js";
import type * as registrations from "../registrations.js";
import type * as savedSearches from "../savedSearches.js";
import type * as seed from "../seed.js";
import type * as trust from "../trust.js";
import type * as trustDocuments from "../trustDocuments.js";
import type * as users from "../users.js";
import type * as vehicles from "../vehicles.js";
import type * as vin from "../vin.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  cities: typeof cities;
  conversations: typeof conversations;
  crons: typeof crons;
  discovery: typeof discovery;
  emailDelivery: typeof emailDelivery;
  emailRecords: typeof emailRecords;
  eventBookings: typeof eventBookings;
  eventOperations: typeof eventOperations;
  eventWaitlist: typeof eventWaitlist;
  events: typeof events;
  favorites: typeof favorites;
  http: typeof http;
  "lib/authorization": typeof lib_authorization;
  "lib/autoDev": typeof lib_autoDev;
  "lib/autosend": typeof lib_autosend;
  "lib/discoveryIndex": typeof lib_discoveryIndex;
  "lib/discoveryPolicy": typeof lib_discoveryPolicy;
  "lib/emailPolicy": typeof lib_emailPolicy;
  "lib/environment": typeof lib_environment;
  "lib/eventOperationsPolicy": typeof lib_eventOperationsPolicy;
  "lib/eventPaymentPolicy": typeof lib_eventPaymentPolicy;
  "lib/eventStaff": typeof lib_eventStaff;
  "lib/eventVisibility": typeof lib_eventVisibility;
  "lib/imageProcessing": typeof lib_imageProcessing;
  "lib/listingLifecycle": typeof lib_listingLifecycle;
  "lib/mediaPolicy": typeof lib_mediaPolicy;
  "lib/provisioning": typeof lib_provisioning;
  "lib/trustGuards": typeof lib_trustGuards;
  "lib/trustPolicy": typeof lib_trustPolicy;
  "lib/vehicleMedia": typeof lib_vehicleMedia;
  "lib/vehicleSpecification": typeof lib_vehicleSpecification;
  "lib/vehicleValidation": typeof lib_vehicleValidation;
  "lib/vehicleVisibility": typeof lib_vehicleVisibility;
  "lib/vinDecoder": typeof lib_vinDecoder;
  "lib/vpic": typeof lib_vpic;
  media: typeof media;
  mediaProcessing: typeof mediaProcessing;
  mediaRecords: typeof mediaRecords;
  mediaUpload: typeof mediaUpload;
  messages: typeof messages;
  notificationHttp: typeof notificationHttp;
  notifications: typeof notifications;
  paymentWebhookRecords: typeof paymentWebhookRecords;
  privacy: typeof privacy;
  recentViews: typeof recentViews;
  registrationPayments: typeof registrationPayments;
  registrations: typeof registrations;
  savedSearches: typeof savedSearches;
  seed: typeof seed;
  trust: typeof trust;
  trustDocuments: typeof trustDocuments;
  users: typeof users;
  vehicles: typeof vehicles;
  vin: typeof vin;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
