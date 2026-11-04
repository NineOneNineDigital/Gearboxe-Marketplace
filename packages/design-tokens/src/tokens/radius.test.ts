import { describe, expect, it } from "vitest";
import { radius } from "./radius.js";

describe("radius", () => {
  it("provides a progressive surface scale", () => {
    expect(radius.sm).toBe("0.5rem");
    expect(radius.md).toBe("0.625rem");
    expect(radius.lg).toBe("0.75rem");
    expect(radius.xl).toBe("1rem");
    expect(radius["2xl"]).toBe("1.5rem");
  });

  it("reserves full rounding for circles and pills", () => {
    expect(radius.full).toBe("9999px");
  });
});
