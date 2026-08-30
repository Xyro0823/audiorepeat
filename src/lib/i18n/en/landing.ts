/**
 * English strings for the public landing/marketing experience.
 * Plan names, prices and plan feature bullets come from lib/plans and stay
 * untranslated; AUDIO_SAMPLES phrase pairs are learning content.
 */
export const landingEn = {
  // Navbar
  'landing.nav.skip': 'Skip to main content',
  'landing.nav.home': 'AudioRepeat home',
  'landing.nav.how': 'How it works',
  'landing.nav.demo': 'Demo',
  'landing.nav.features': 'Features',
  'landing.nav.pricing': 'Pricing',
  'landing.nav.faq': 'FAQ',
  'landing.nav.signIn': 'Sign in',
  'landing.nav.dashboard': 'Dashboard',
  'landing.nav.startPractice': 'Start Practice',
  'landing.nav.uiLangAria': 'Interface language',

  // Hero
  'landing.hero.badge': 'Hands-free audio drilling',
  'landing.hero.titlePrefix': 'Master Any Language with',
  'landing.hero.titleAccent': 'Hands-Free Audio Repeat',
  'landing.hero.subtitle':
    'Loop, repeat and retain vocabulary while you commute, cook or wind down. Speech audio, spaced repetition and {count} languages — no screen required.',
  'landing.hero.ctaPrimary': 'Start Learning Now',
  'landing.hero.ctaSecondary': 'Explore Library',
  'landing.hero.tagline': 'No pressure · No commitment · Just listening',
  'landing.hero.loop.pick': 'Pick a 12-minute set',
  'landing.hero.loop.listen': 'Hear target → meaning → target',
  'landing.hero.loop.return': 'Review difficult words tomorrow',
  'landing.trust.title': 'Privacy-first',
  'landing.trust.body': 'Uses voices available on your device',

  // How it works
  'landing.how.kicker': 'How it works',
  'landing.how.title': 'From a word list to a listening habit',
  'landing.how.sub':
    'Get started in minutes. No complicated course setup and no need to stare at a screen.',
  'landing.how.item1.title': 'Choose a language',
  'landing.how.item1.text':
    'Start with a ready-made pack or choose the language for your own vocabulary set.',
  'landing.how.item2.title': 'Build your listening loop',
  'landing.how.item2.text':
    'Pick words, set the speed and repetition pattern, then press play.',
  'landing.how.item3.title': 'Listen and retain',
  'landing.how.item3.text':
    'Practice hands-free, revisit difficult words and follow your progress over time.',

  // Demo
  'landing.demo.kicker': 'Try it now',
  'landing.demo.title': 'Try a five-phrase lesson before you sign up',
  'landing.demo.body':
    'This sample lesson uses a speech voice installed on your device. Choose a language, adjust the speed and hear every phrase in a target → translation → target loop.',
  'landing.demo.note':
    'Voice quality and availability vary by device, browser and installed language pack.',
  'landing.demo.sampleLegend': 'Sample language',
  'landing.demo.idle': 'Ready to play a five-phrase sample lesson.',
  'landing.demo.stopped': 'Lesson stopped. Choose a phrase or play the lesson again.',
  'landing.demo.unsupported':
    'Speech playback is not available in this browser. Try a current version of Edge, Chrome or Safari.',
  'landing.demo.playing': 'Playing a five-phrase {language} sample lesson.',
  'landing.demo.complete': 'Loop complete. Play it again or try another language.',
  'landing.demo.voiceError':
    'This voice could not play. Install the language voice on your device or choose another sample.',
  'landing.demo.selected': '{language} selected. Five phrases ready to play.',
  'landing.demo.phraseAria': 'Phrase {current} of {total}',
  'landing.demo.phraseLabel': 'Phrase {current} of {total}',
  'landing.demo.prevAria': 'Previous phrase',
  'landing.demo.nextAria': 'Next phrase',
  'landing.demo.speedAria': 'Playback speed',
  'landing.demo.normal': 'Normal',
  'landing.demo.slow': 'Slow',
  'landing.demo.stop': 'Stop',
  'landing.demo.playLesson': 'Play 5-Phrase Lesson',

  // Features
  'landing.features.kicker': 'Why AudioRepeat',
  'landing.features.title': 'An audio engine built for retention',
  'landing.features.sub':
    'Every feature is engineered around one idea: your ears are the fastest path to fluency.',
  'landing.features.item1.title': 'Spaced Repetition Audio Loop',
  'landing.features.item1.text':
    'Words resurface at the right intervals — hear them, then test yourself, until they stick for good.',
  'landing.features.item2.title': 'Offline Audio Player',
  'landing.features.item2.text':
    'Download your sets and drill anywhere. Plane, train, subway — zero bars, zero interruptions.',
  'landing.features.item3.title': 'Pronunciation Practice',
  'landing.features.item3.text':
    'Use available speech voices to hear each word, slow it down, loop it and shadow it back.',
  'landing.features.item4.title': 'Curated Vocabulary Packs',
  'landing.features.item4.text':
    'Ready-made starter packs from A1 to C2 across widely studied languages.',

  // Languages section
  'landing.languages.titlePrefix': '{count} languages.',
  'landing.languages.titleAccent': 'One tap away.',
  'landing.languages.sub':
    'From Arabic to Zulu — device-compatible speech voices, real word packs, zero setup.',
  'landing.languages.more': '+ {count} more',
  'landing.languages.depth': 'Full A1–C2 vocabulary packs are currently available in {full} languages. Every supported language has starter content so you can begin immediately.',

  // Install section
  'landing.install.kicker': 'Installable web app',
  'landing.install.title': 'Keep AudioRepeat one tap away',
  'landing.install.body':
    'Install from your browser for a full-screen home-screen experience. Downloaded vocabulary stays ready for supported offline practice—no app-store account required.',
  'landing.install.bullet1': 'Home-screen access',
  'landing.install.bullet2': 'Offline-ready sets',
  'landing.install.bullet3': 'Hands-free playback',
  'landing.install.openWithout': 'Open without installing',

  // Pricing
  'landing.pricing.kicker': 'Pricing',
  'landing.pricing.title': 'Learn at your pace, pay your way',
  'landing.pricing.billingAria': 'Pro billing period',
  'landing.pricing.monthly': 'Monthly',
  'landing.pricing.annual': 'Annual',
  'landing.pricing.save': 'Save {percent}%',
  'landing.pricing.mostPopular': 'Most Popular',

  // Plan card copy (names/prices/feature bullets stay authoritative in lib/plans)
  'landing.plan.basic.tagline': 'For curious beginners',
  'landing.plan.pro.tagline': 'The full learning engine',
  'landing.plan.lifetime.tagline': 'One payment, forever',
  'landing.plan.basic.cta': 'Start free',
  'landing.plan.pro.cta': 'Go Pro',
  'landing.plan.lifetime.cta': 'Get Lifetime',

  // Plan feature bullets + price notes (canonical strings live in lib/plans;
  // this display layer localizes them without touching entitlements/prices).
  'landing.plan.bullet.activeLanguage': '{limit} active language',
  'landing.plan.bullet.standardTts': 'Standard TTS audio',
  'landing.plan.bullet.dailyWords': '{limit} words / day',
  'landing.plan.bullet.allLanguages': 'All {count} languages',
  'landing.plan.bullet.pronunciation': 'Pronunciation practice tools',
  'landing.plan.bullet.offlinePacks': 'Offline audio packs',
  'landing.plan.bullet.spacedQuiz': 'Spaced repetition + quiz mode',
  'landing.plan.bullet.speedStats': 'Speed challenges & stats',
  'landing.plan.bullet.everythingInPro': 'Everything in Pro',
  'landing.plan.bullet.futureLanguages': 'Future languages included',
  'landing.plan.bullet.prioritySupport': 'Priority support',
  'landing.plan.note.foreverFree': 'forever free',
  'landing.plan.note.perYear': '/year',
  'landing.plan.note.perMonth': '/mo',
  'landing.plan.note.oneTime': 'one-time payment',

  // Audio transparency
  'landing.audio.kicker': 'Clear about the audio',
  'landing.audio.title': 'Your device provides the voice',
  'landing.audio.body':
    'AudioRepeat uses speech-synthesis voices available through your browser and operating system. It does not present generated voices as human recordings.',
  'landing.audio.card1.title': 'Installed voices first',
  'landing.audio.card1.text':
    'When a matching local voice is installed, AudioRepeat prefers it for reliable playback.',
  'landing.audio.card2.title': 'You control the loop',
  'landing.audio.card2.text':
    'Adjust speed, repetition and ordering to fit the vocabulary you are practicing.',
  'landing.audio.card3.title': 'No fabricated speakers',
  'landing.audio.card3.text':
    'Names, portraits and testimonials are never used to imply recordings that do not exist.',

  // FAQ
  'landing.faq.kicker': 'FAQ',
  'landing.faq.title': 'Know before you start',
  'landing.faq.sub': 'Straight answers about plans, voices, offline use and payments.',
  'landing.faq.q1': 'What can I do on the free plan?',
  'landing.faq.a1':
    'You can practice one active language with standard device voices and up to 300 words per day. You can upgrade whenever you need every language and the full learning toolkit.',
  'landing.faq.q2': 'Does AudioRepeat work offline?',
  'landing.faq.a2':
    'Yes. The app is designed to keep downloaded vocabulary sets available for practice when your connection drops. Voice availability depends on the voices installed on your device.',
  'landing.faq.q3': 'Are the voices human recordings or AI voices?',
  'landing.faq.a3':
    'AudioRepeat uses speech-synthesis voices available on your device. Voice quality and exact availability vary by browser, operating system and installed language packs.',
  'landing.faq.q4': 'Which devices are supported?',
  'landing.faq.a4':
    'AudioRepeat runs in modern browsers on phones, tablets and computers. You can also install it from your browser as a home-screen app on supported devices.',
  'landing.faq.q5': 'Can I cancel Pro?',
  'landing.faq.a5':
    'Yes. Pro subscriptions can be canceled through the payment-management flow. Your paid access remains available for the period you already purchased.',
  'landing.faq.q6': 'What does Lifetime include?',
  'landing.faq.a6':
    'Lifetime is a one-time purchase for the Pro feature set, including future supported languages listed in the plan. It is not a recurring subscription.',
  'landing.faq.q7': 'How do refunds work?',
  'landing.faq.a7':
    'Refund eligibility depends on the purchase and timing. Review the Refund Policy or contact support with your payment details so the request can be checked.',
  'landing.faq.helpPrefix': 'Still need help?',
  'landing.faq.contactSupport': 'Contact support',

  // Footer
  'landing.footer.blurb':
    'Hands-free audio drilling for auditory learners in {count} languages.',
  'landing.footer.product': 'Product',
  'landing.footer.howItWorks': 'How It Works',
  'landing.footer.audioDemo': 'Audio Demo',
  'landing.footer.pricing': 'Pricing',
  'landing.footer.faq': 'FAQ',
  'landing.footer.contactSupport': 'Contact Support',
  'landing.footer.newsletter': 'Join Newsletter',
  'landing.footer.newsletterBlurb': 'Weekly language-learning tips, zero spam.',
  'landing.footer.copyright': '© 2026 AudioRepeat · Loop, repeat, retain.',
  'landing.footer.install': 'Install',
  'landing.footer.practice': 'Practice',
  'landing.footer.privacy': 'Privacy Policy',
  'landing.footer.terms': 'Terms',
  'landing.footer.refunds': 'Refund Policy',
  'landing.footer.support': 'Support',

  // Newsletter form
  'landing.newsletter.emailRequired': 'Please enter your email address.',
  'landing.newsletter.emailInvalid': "That doesn't look like a valid email address.",
  'landing.newsletter.error': 'Something went wrong, try again.',
  'landing.newsletter.success': "You're in — check your inbox soon.",
  'landing.newsletter.placeholder': 'you@example.com…',
  'landing.newsletter.emailAria': 'Email address for newsletter',
  'landing.newsletter.subscribeAria': 'Subscribe to newsletter',
  'landing.newsletter.subscribingAria': 'Subscribing',
} as const;

export type LandingKeys = keyof typeof landingEn;
