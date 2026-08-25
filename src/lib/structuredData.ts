import { FAQ_ITEMS_EN } from '@/components/landing/landingContent';
import { PLANS } from '@/lib/plans';
import { SITE_URL } from '@/lib/site';

export function softwareApplicationStructuredData() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'AudioRepeat',
    url: SITE_URL,
    description: 'Offline-first, hands-free vocabulary listening and repetition for language learners.',
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Any',
    featureList: [
      'Hands-free vocabulary loops',
      'Device speech voices',
      'Offline-ready practice sets',
      'Spaced repetition and progress tracking',
    ],
    offers: [
      { '@type': 'Offer', name: 'Basic', price: PLANS.basic.priceFor(false).price, priceCurrency: 'USD' },
      { '@type': 'Offer', name: 'Pro monthly', price: PLANS.pro.priceFor(false).price, priceCurrency: 'USD' },
      { '@type': 'Offer', name: 'Pro annual', price: PLANS.pro.priceFor(true).price, priceCurrency: 'USD' },
      { '@type': 'Offer', name: 'Lifetime', price: PLANS.lifetime.priceFor(false).price, priceCurrency: 'USD' },
    ],
  };
}

export function faqStructuredData() {
  // SEO structured data always uses the canonical English copy.
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS_EN.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  };
}

export function serializeStructuredData(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

