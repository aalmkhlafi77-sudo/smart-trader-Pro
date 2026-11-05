import { describe, expect, it } from "vitest";
import { parseNumber } from "./pricing";

describe("decimal amount parsing", () => {
  it("accepts dot, comma and Arabic decimal separators", () => {
    expect(parseNumber("12.50")).toBeCloseTo(12.5);
    expect(parseNumber("12,50")).toBeCloseTo(12.5);
    expect(parseNumber("12٫50")).toBeCloseTo(12.5);
  });

  it("accepts Arabic-Indic digits with decimal fractions", () => {
    expect(parseNumber("١٢٫٥٠")).toBeCloseTo(12.5);
  });
});
