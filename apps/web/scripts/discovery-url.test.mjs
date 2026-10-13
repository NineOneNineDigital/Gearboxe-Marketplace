import assert from "node:assert/strict";
import test from "node:test";
import {
  discoveryUrl,
  readDiscoveryUrl,
  discoverySorts,
} from "../lib/discovery-url.ts";

test("discovery URL round-trips every filter and sort", () => {
  const filters = {
    search: "Toyota wagon",
    make: "Toyota",
    model: "Prius",
    minPrice: 1000,
    maxPrice: 40000,
    minYear: 2000,
    maxYear: 2022,
    maxMileage: 90000,
    state: "NC",
    latitude: 35.78,
    longitude: -78.64,
    radiusMiles: 25,
  };
  for (const sort of discoverySorts) {
    const url = discoveryUrl(filters, sort);
    assert.deepEqual(
      readDiscoveryUrl(new URL(url, "https://example.test").searchParams),
      { filters, sort },
    );
  }
});
test("invalid URL values never reach server query arguments", () => {
  const state = readDiscoveryUrl(
    new URLSearchParams(
      "minPrice=NaN&maxPrice=-1&minYear=9&maxYear=Infinity&maxMileage=broken&state=California&latitude=91&longitude=181&radiusMiles=9&sort=unsupported",
    ),
  );
  assert.deepEqual(state, { filters: {}, sort: "newest" });
});
test("reversed ranges retain a valid lower bound", () => {
  assert.deepEqual(
    readDiscoveryUrl(
      new URLSearchParams("minPrice=100&maxPrice=50&minYear=2020&maxYear=2000"),
    ).filters,
    { minPrice: 100, minYear: 2020 },
  );
});
test("coordinates require a valid pair and default their radius", () => {
  assert.deepEqual(
    readDiscoveryUrl(new URLSearchParams("latitude=0&longitude=0")).filters,
    { latitude: 0, longitude: 0, radiusMiles: 50 },
  );
  assert.deepEqual(
    readDiscoveryUrl(new URLSearchParams("latitude=35&radiusMiles=25")).filters,
    {},
  );
  assert.deepEqual(
    readDiscoveryUrl(
      new URLSearchParams("latitude=35&longitude=-78&radiusMiles=900"),
    ).filters,
    { latitude: 35, longitude: -78, radiusMiles: 50 },
  );
});
test("empty filters use the clean browse URL and strings are normalized", () => {
  assert.equal(discoveryUrl({}), "/vehicles");
  assert.deepEqual(
    readDiscoveryUrl(
      new URLSearchParams("search=%20Honda%20&state=nc&model=%20Civic%20"),
    ).filters,
    { search: "Honda", model: "Civic", state: "NC" },
  );
  assert.equal(discoveryUrl({ maxPrice: NaN, latitude: 10 }), "/vehicles");
});
