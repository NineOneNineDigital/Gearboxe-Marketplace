import { describe, expect, it } from "vitest";
import { colors, neutral, primary, semantic } from "./colors.js";

describe("color tokens", () => {
  it("exports primary color scale", () => {
    expect(primary[500]).toBeDefined();
    expect(primary[500]).toContain("hsl");
  });

  it("exports neutral color scale", () => {
    expect(neutral[50]).toBeDefined();
    expect(neutral[900]).toBeDefined();
  });

  it("exports semantic colors", () => {
    expect(semantic.destructive).toBeDefined();
    expect(semantic.success).toBeDefined();
    expect(semantic.warning).toBeDefined();
  });

  it("exports combined colors object", () => {
    expect(colors.primary).toBe(primary);
    expect(colors.neutral).toBe(neutral);
    expect(colors.semantic).toBe(semantic);
  });
});
