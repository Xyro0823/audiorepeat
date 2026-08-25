export { ANNUAL_SAVINGS_PERCENT, annualSavingsPercent } from "@/lib/plans";

/**
 * Landing content structure. Display copy lives in the i18n dictionaries
 * (landing.* keys) so English and Монгол render from the same shape; the
 * AUDIO_SAMPLES phrase pairs below are LEARNING CONTENT, not UI copy, and
 * stay untranslated.
 */
export const HOW_IT_WORKS = [
  {
    step: "01",
    titleKey: "landing.how.item1.title",
    textKey: "landing.how.item1.text",
  },
  {
    step: "02",
    titleKey: "landing.how.item2.title",
    textKey: "landing.how.item2.text",
  },
  {
    step: "03",
    titleKey: "landing.how.item3.title",
    textKey: "landing.how.item3.text",
  },
] as const;

export const AUDIO_SAMPLES = [
  {
    key: "ja",
    flag: "🇯🇵",
    language: "Japanese",
    lang: "ja-JP",
    phrases: [
      { target: "こんにちは", translation: "Hello" },
      { target: "ありがとう", translation: "Thank you" },
      { target: "すみません", translation: "Excuse me" },
      { target: "お願いします", translation: "Please" },
      { target: "さようなら", translation: "Goodbye" },
    ],
  },
  {
    key: "es",
    flag: "🇪🇸",
    language: "Spanish",
    lang: "es-ES",
    phrases: [
      { target: "Buenos días", translation: "Good morning" },
      { target: "Gracias", translation: "Thank you" },
      { target: "Por favor", translation: "Please" },
      { target: "Disculpe", translation: "Excuse me" },
      { target: "Hasta luego", translation: "See you later" },
    ],
  },
  {
    key: "fr",
    flag: "🇫🇷",
    language: "French",
    lang: "fr-FR",
    phrases: [
      { target: "Bonjour", translation: "Hello" },
      { target: "Merci beaucoup", translation: "Thank you very much" },
      { target: "S’il vous plaît", translation: "Please" },
      { target: "Excusez-moi", translation: "Excuse me" },
      { target: "À bientôt", translation: "See you soon" },
    ],
  },
  {
    key: "de",
    flag: "🇩🇪",
    language: "German",
    lang: "de-DE",
    phrases: [
      { target: "Guten Morgen", translation: "Good morning" },
      { target: "Vielen Dank", translation: "Thank you very much" },
      { target: "Bitte", translation: "Please" },
      { target: "Entschuldigung", translation: "Excuse me" },
      { target: "Bis später", translation: "See you later" },
    ],
  },
] as const;

export const FAQ_ITEMS = [
  { questionKey: "landing.faq.q1", answerKey: "landing.faq.a1" },
  { questionKey: "landing.faq.q2", answerKey: "landing.faq.a2" },
  { questionKey: "landing.faq.q3", answerKey: "landing.faq.a3" },
  { questionKey: "landing.faq.q4", answerKey: "landing.faq.a4" },
  { questionKey: "landing.faq.q5", answerKey: "landing.faq.a5" },
  { questionKey: "landing.faq.q6", answerKey: "landing.faq.a6" },
  { questionKey: "landing.faq.q7", answerKey: "landing.faq.a7" },
] as const;

/**
 * English-only FAQ copy for the SEO structured data (JSON-LD). Search
 * engines always get the canonical English text; the visible page renders
 * the localized FAQ_ITEMS above.
 */
export const FAQ_ITEMS_EN = [
  {
    question: "What can I do on the free plan?",
    answer: "You can practice one active language with standard device voices and up to 300 words per day. You can upgrade whenever you need every language and the full learning toolkit.",
  },
  {
    question: "Does AudioRepeat work offline?",
    answer: "Yes. The app is designed to keep downloaded vocabulary sets available for practice when your connection drops. Voice availability depends on the voices installed on your device.",
  },
  {
    question: "Are the voices human recordings or AI voices?",
    answer: "AudioRepeat uses speech-synthesis voices available on your device. Voice quality and exact availability vary by browser, operating system and installed language packs.",
  },
  {
    question: "Which devices are supported?",
    answer: "AudioRepeat runs in modern browsers on phones, tablets and computers. You can also install it from your browser as a home-screen app on supported devices.",
  },
  {
    question: "Can I cancel Pro?",
    answer: "Yes. Pro subscriptions can be canceled through the payment-management flow. Your paid access remains available for the period you already purchased.",
  },
  {
    question: "What does Lifetime include?",
    answer: "Lifetime is a one-time purchase for the Pro feature set, including future supported languages listed in the plan. It is not a recurring subscription.",
  },
  {
    question: "How do refunds work?",
    answer: "Refund eligibility depends on the purchase and timing. Review the Refund Policy or contact support with your payment details so the request can be checked.",
  },
] as const;
