import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { PLANS } from "@/lib/plans";
import {
  ANNUAL_SAVINGS_PERCENT,
  AUDIO_SAMPLES,
  FAQ_ITEMS,
  HOW_IT_WORKS,
  annualSavingsPercent,
} from "./landingContent";

describe("landing content invariants", () => {
  it("shows the real rounded annual saving", () => {
    const monthly = PLANS.pro.priceFor(false).price;
    const annual = PLANS.pro.priceFor(true).price;
    expect(annualSavingsPercent(monthly, annual)).toBe(33);
    expect(ANNUAL_SAVINGS_PERCENT).toBe(33);
  });

  it("keeps the product explanation complete and concrete", () => {
    expect(HOW_IT_WORKS).toHaveLength(3);
    expect(new Set(HOW_IT_WORKS.map((item) => item.step)).size).toBe(3);
    expect(FAQ_ITEMS.length).toBeGreaterThanOrEqual(6);
  });

  it("provides usable, uniquely keyed speech samples", () => {
    expect(AUDIO_SAMPLES.length).toBeGreaterThanOrEqual(4);
    expect(new Set(AUDIO_SAMPLES.map((sample) => sample.key)).size).toBe(AUDIO_SAMPLES.length);
    for (const sample of AUDIO_SAMPLES) {
      expect(sample.lang).toMatch(/^[a-z]{2,3}-[A-Z]{2}$/);
      expect(sample.phrases).toHaveLength(5);
      for (const phrase of sample.phrases) {
        expect(phrase.target.trim()).not.toBe("");
        expect(phrase.translation.trim()).not.toBe("");
      }
    }
  });

  it("ships the useful landing sections without fabricated social proof", () => {
    const source = ["./LandingPage.tsx", "./AudioDemo.tsx"]
      .map((file) => readFileSync(new URL(file, import.meta.url), "utf8"))
      .join("\n");
    for (const id of ["how-it-works", "demo", "install", "faq"]) {
      expect(source).toContain(`id=\"${id}\"`);
    }
    expect(source).not.toMatch(/learners listening now|Live Session|real people|Testimonials/);
  });
});
