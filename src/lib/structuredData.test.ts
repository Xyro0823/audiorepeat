import { describe, expect, it } from 'vitest';
import { FAQ_ITEMS, FAQ_ITEMS_EN } from '@/components/landing/landingContent';
import { PLANS } from '@/lib/plans';
import { faqStructuredData, serializeStructuredData, softwareApplicationStructuredData } from './structuredData';

describe('landing structured data', () => {
  it('publishes every visible FAQ without inventing ratings', () => {
    const faq = faqStructuredData();
    // SEO JSON-LD always mirrors the canonical English FAQ copy.
    expect(faq.mainEntity).toHaveLength(FAQ_ITEMS.length);
    expect(faq.mainEntity.map((item) => item.name)).toEqual(FAQ_ITEMS_EN.map((item) => item.question));
    expect(JSON.stringify(faq)).not.toContain('aggregateRating');
  });

  it('uses the canonical plan prices', () => {
    const app = softwareApplicationStructuredData();
    expect(app.offers.map((offer) => offer.price)).toEqual([
      PLANS.basic.priceFor(false).price,
      PLANS.pro.priceFor(false).price,
      PLANS.pro.priceFor(true).price,
      PLANS.lifetime.priceFor(false).price,
    ]);
  });

  it('escapes markup characters before embedding JSON in HTML', () => {
    expect(serializeStructuredData({ value: '</script>' })).not.toContain('</script>');
  });
});

