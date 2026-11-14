import { expect, test } from "@playwright/test";

test("public seller entry and inventory navigation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Cars from people who care/i })).toBeVisible();
  const sell = page.getByRole("link", { name: "Sell your vehicle" }).first();
  await expect(sell).toHaveAttribute("href", /\/sign-up\?next=/);
  await page.getByRole("link", { name: /Find cars near you or nationwide/i }).click();
  await expect(page).toHaveURL(/\/vehicles(?:\?|$)/);
  await expect(page.getByRole("heading", { name: "Find vehicles near you" })).toBeVisible();
});

test("ZIP starts a 50-mile search and can return to nationwide", async ({ page }) => {
  await page.route("https://api.zippopotam.us/us/27601", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ places: [{ latitude: "35.7796", longitude: "-78.6382" }] }),
  }));
  await page.goto("/vehicles");
  await page.getByLabel("ZIP code").fill("27601");
  await page.getByRole("button", { name: "Search nearby" }).click();
  await expect(page).toHaveURL(url => url.searchParams.get("zip") === "27601" && url.searchParams.get("radiusMiles") === "50");
  await expect(page.getByText(/Showing vehicles within 50 miles of 27601/i).first()).toBeVisible();
  await page.getByRole("button", { name: "View nationwide" }).first().click();
  await expect(page).toHaveURL(url => !url.searchParams.has("zip") && !url.searchParams.has("latitude"));
});
