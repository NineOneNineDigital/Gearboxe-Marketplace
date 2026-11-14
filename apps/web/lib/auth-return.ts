// Allow only supported local return destinations.
export function listingReturnPath(search: string): string {
  const path = new URLSearchParams(search).get("next");
  if (path && (/^\/vehicles\/[a-z0-9]+(?:\?offer=1)?$/i.test(path) || /^\/myAccount\/new-listing(?:\?edit=[a-z0-9]+)?$/.test(path))) return path;
  if (path && /^\/myAccount\/messages\/[a-z0-9]+\/[a-z0-9]+$/i.test(path)) return path;
  if (path && /^\/myAccount\/messages\?offer=[a-z0-9]+$/i.test(path)) return path;
  return "/myAccount";
}
