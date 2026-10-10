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
import type * as events from "../events.js";
import type * as favorites from "../favorites.js";
import type * as http from "../http.js";
import type * as lib_authorization from "../lib/authorization.js";
import type * as lib_autoDev from "../lib/autoDev.js";
import type * as lib_environment from "../lib/environment.js";
import type * as lib_provisioning from "../lib/provisioning.js";
import type * as lib_vehicleSpecification from "../lib/vehicleSpecification.js";
import type * as lib_vehicleValidation from "../lib/vehicleValidation.js";
import type * as lib_vehicleVisibility from "../lib/vehicleVisibility.js";
import type * as messages from "../messages.js";
import type * as registrationPayments from "../registrationPayments.js";
import type * as registrations from "../registrations.js";
import type * as seed from "../seed.js";
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
  events: typeof events;
  favorites: typeof favorites;
  http: typeof http;
  "lib/authorization": typeof lib_authorization;
  "lib/autoDev": typeof lib_autoDev;
  "lib/environment": typeof lib_environment;
  "lib/provisioning": typeof lib_provisioning;
  "lib/vehicleSpecification": typeof lib_vehicleSpecification;
  "lib/vehicleValidation": typeof lib_vehicleValidation;
  "lib/vehicleVisibility": typeof lib_vehicleVisibility;
  messages: typeof messages;
  registrationPayments: typeof registrationPayments;
  registrations: typeof registrations;
  seed: typeof seed;
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
