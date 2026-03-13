import { describe, it, expect } from "vitest";
import { calculateProcessingFee, calculateBuyerTotal, getPricingBreakdown, calculateProcessingFeeCents } from "./processingFee";

describe("calculateProcessingFee", () => {
  it("returns 0 for free events", () => {
    expect(calculateProcessingFee(0)).toBe(0);
    expect(calculateProcessingFee(-5)).toBe(0);
  });

  it("calculates correct fees per spec examples", () => {
    expect(calculateProcessingFee(1)).toBe(0.33);
    expect(calculateProcessingFee(3)).toBe(0.39);
    expect(calculateProcessingFee(5)).toBe(0.45);
    expect(calculateProcessingFee(10)).toBe(0.59);
    expect(calculateProcessingFee(30)).toBe(1.17);
    expect(calculateProcessingFee(200)).toBe(6.10);
  });
});

describe("calculateBuyerTotal", () => {
  it("returns 0 for free", () => {
    expect(calculateBuyerTotal(0)).toBe(0);
  });

  it("adds fee on top of ticket price", () => {
    expect(calculateBuyerTotal(10)).toBe(10.59);
    expect(calculateBuyerTotal(1)).toBe(1.33);
  });
});

describe("getPricingBreakdown", () => {
  it("returns correct breakdown", () => {
    const b = getPricingBreakdown(10);
    expect(b.ticketPrice).toBe(10);
    expect(b.processingFee).toBe(0.59);
    expect(b.total).toBe(10.59);
  });
});

describe("calculateProcessingFeeCents", () => {
  it("returns correct cents values", () => {
    expect(calculateProcessingFeeCents(1000)).toBe(59); // $10 -> 59c
    expect(calculateProcessingFeeCents(100)).toBe(33);  // $1 -> 33c
    expect(calculateProcessingFeeCents(0)).toBe(0);
  });
});
