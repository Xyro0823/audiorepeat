/**
 * ⚠️ PLACEHOLDER / EXAMPLE DATA — NOT REAL USER REVIEWS.
 *
 * These testimonials are illustrative marketing copy written for the launch
 * layout. They are NOT verified user submissions. Replace this array with
 * real, consenting learner reviews (moderated quotes from actual users)
 * before or shortly after public launch so the product never presents
 * fabricated social proof. Do not ship this file as-is in production
 * marketing.
 */
export interface Testimonial {
  name: string;
  quote: string;
  language: string;
  duration: string;
  /** 1–5 stars */
  rating: number;
  /** Tailwind gradient classes for the initial avatar circle. */
  avatarGrad: string;
}

export const TESTIMONIALS: Testimonial[] = [
  {
    name: "Sarah K.",
    quote:
      "I drilled Japanese greetings on my commute for a month and now I catch words when I watch anime raw. The loop feature is what finally made it stick.",
    language: "Japanese",
    duration: "4 months",
    rating: 5,
    avatarGrad: "from-cyan-500/70 to-sky-600/70",
  },
  {
    name: "Daniel R.",
    quote:
      "The offline packs got me through a two-week trip with zero signal. I'd walk around Barcelona with my earbuds in and the phrases came out when I needed them.",
    language: "Spanish",
    duration: "7 months",
    rating: 5,
    avatarGrad: "from-sky-500/70 to-blue-600/70",
  },
  {
    name: "Marta L.",
    quote:
      "The pronunciation coach is scary accurate. It caught my French 'r' instantly and gave me a repeat drill that actually fixed it.",
    language: "French",
    duration: "2 months",
    rating: 5,
    avatarGrad: "from-teal-500/70 to-cyan-600/70",
  },
  {
    name: "Kenji T.",
    quote:
      "I've tried flashcards for years. Hearing words at the right intervals is a completely different game — I remember words I last heard three weeks ago.",
    language: "Korean",
    duration: "5 months",
    rating: 5,
    avatarGrad: "from-blue-500/70 to-indigo-600/70",
  },
  {
    name: "Amina B.",
    quote:
      "I fall asleep to the sleep timer almost every night. Half an hour of Arabic before bed and I'm absorbing vocabulary without even trying.",
    language: "Arabic",
    duration: "6 months",
    rating: 4,
    avatarGrad: "from-cyan-600/70 to-teal-600/70",
  },
  {
    name: "Lucas P.",
    quote:
      "The streak keeps me honest. 64 days in a row and I can already hold a basic conversation at the bakery without panicking.",
    language: "German",
    duration: "3 months",
    rating: 5,
    avatarGrad: "from-sky-600/70 to-cyan-700/70",
  },
];
