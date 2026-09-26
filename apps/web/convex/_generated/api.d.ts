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
import type * as messages from "../messages.js";
import type * as registrations from "../registrations.js";
import type * as seed from "../seed.js";
import type * as users from "../users.js";
import type * as vehicles from "../vehicles.js";

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
  messages: typeof messages;
  registrations: typeof registrations;
  seed: typeof seed;
  users: typeof users;
  vehicles: typeof vehicles;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
