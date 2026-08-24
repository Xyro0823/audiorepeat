/**
 * English strings for the checkout area (keys are the source of truth).
 * Covers the plan picker, payment step, success screen and downgrade flow.
 */
export const checkoutEn = {
  // CheckoutFlow
  'checkout.canceled': 'Your checkout was canceled — nothing was charged.',
  'checkout.nav.practice': 'Practice',
  'checkout.kicker': 'Checkout',
  'checkout.choosePlan': 'Choose your plan',
  'checkout.subtitle.paddle':
    'Pick a tier to see the summary — you’ll pay securely with Paddle on the next step.',
  'checkout.subtitle.soon':
    'Pick a tier to see the summary — payments launch soon, so nothing charges today.',
  'checkout.billing.monthly': 'Monthly',
  'checkout.billing.annual': 'Annual',
  'checkout.savePercent': 'Save {percent}%',
  'checkout.mostPopular': 'Most Popular',
  'checkout.continueWith': 'Continue with {plan} — ${price}',
  'checkout.footer.secure': 'Secure payments handled by Paddle',
  'checkout.footer.soon': 'No charge today · payments coming soon',
  'checkout.backToPlans': 'Back to plans',
  'checkout.signInGate.title': 'Sign in to continue checkout',
  'checkout.signInGate.selectedPrefix': 'You’ve selected the',
  'checkout.signInGate.selectedSuffix': 'plan (${price}{note}).',
  'checkout.signInGate.needAccount':
    'We need an account to attach your purchase to — or continue with free access.',
  'checkout.signInGate.needAccountSoon':
    'We need an account to attach it to once payments launch — or keep using everything free right now.',
  'checkout.signInCta': 'Sign in / Create account',
  'checkout.continueFree': 'Continue with free access',

  // PaymentStep
  'checkout.summary.title': 'Your plan',
  'checkout.billing.line.annual': 'Annual billing',
  'checkout.billing.line.monthly': 'Monthly billing',
  'checkout.pay.opening': 'Opening secure checkout…',
  'checkout.pay.amount': 'Pay securely with Paddle — ${price}',
  'checkout.pay.error':
    'Couldn’t start checkout — please try again. You won’t be charged unless you complete payment on Paddle’s page.',
  'checkout.pay.securityNote':
    '🔒 Secure payment handled by Paddle — card details never touch AudioRepeat.',
  'checkout.basic.title': '🎉 Basic is free — no payment needed',
  'checkout.basic.body':
    'Everything on the Basic plan is yours to use right now. Upgrade to Pro or Lifetime whenever you’re ready.',
  'checkout.soon.title': '💳 Payment integration coming soon',
  'checkout.soon.body':
    'AudioRepeat doesn’t charge for anything yet. This screen is where checkout will live once payments launch — you won’t be billed today, and nothing here processes a payment.',
  'checkout.notify.idle': 'Notify me when payments launch',
  'checkout.notify.done': '✓ Thanks — we’ll let you know when payments go live',
  'checkout.notify.error':
    'Couldn’t save that right now — no problem, everything is free for the time being.',
  'checkout.changePlan': 'Change plan',

  // SuccessView
  'checkout.word.plan': 'plan',
  'checkout.success.welcome': 'Welcome to {plan}!',
  'checkout.success.active.monthly': 'Your {plan} plan is active (monthly billing)',
  'checkout.success.active.annual': 'Your {plan} plan is active (annual billing)',
  'checkout.success.active.lifetime': 'Your {plan} plan is active',
  'checkout.success.receipt': 'A receipt is on its way to {email}.',
  'checkout.success.startCta': 'Start practicing',
  'checkout.success.verifying': 'Confirming your plan…',
  'checkout.success.activating': 'Payment received — activating your plan',
  'checkout.success.verifyingBody': 'We’re confirming your {plan} with our payment provider.',
  'checkout.success.activatingBody':
    'Your payment was submitted. We’re waiting for your plan to activate — this usually takes a few seconds. It may take a moment for all your Pro features to unlock.',
  'checkout.success.goDashboard': 'Go to dashboard',
  'checkout.success.checkAgain': 'Check again',
  'checkout.success.pendingTimeout': 'We haven’t confirmed your plan yet',
  'checkout.success.submitted': 'Your payment was submitted',
  'checkout.success.timeoutBody':
    'If you completed payment, it may take a moment to appear. Everything remains free until it’s confirmed — nothing was charged incorrectly.',
  'checkout.success.pendingBody':
    'We’re waiting for your plan to activate — this usually takes a few seconds.',
  'checkout.success.thanksTitle': 'Thanks for your order',
  'checkout.success.unverifiedBody':
    'We couldn’t confirm your plan on this screen, but if you completed a checkout, it may take a moment to appear. Everything remains free until it’s confirmed.',

  // DowngradeModal
  'checkout.downgrade.aria': 'Switch to the Free plan',
  'checkout.downgrade.title': 'Switch to the Free plan',
  'checkout.downgrade.doneTitle': 'Free plan active',
  'checkout.downgrade.keptPrefix': 'You’re keeping',
  'checkout.downgrade.hiddenLangs.one': '1 other language was hidden',
  'checkout.downgrade.hiddenLangs.other': '{count} other languages were hidden',
  'checkout.downgrade.setsWrap': ' ({sets})',
  'checkout.downgrade.hiddenNote':
    ' — nothing was deleted, and they’ll come back automatically if you upgrade again.',
  'checkout.downgrade.nothingHidden': 'Nothing was hidden.',
  'checkout.downgrade.withinLimit.title': 'Already within the limit',
  'checkout.downgrade.withinLimit.body.one':
    'Your library already uses a single language, so there’s nothing to hide. The Free plan includes {limit} active language.',
  'checkout.downgrade.withinLimit.body.other':
    'Your library already uses a single language, so there’s nothing to hide. The Free plan includes {limit} active languages.',
  'checkout.downgrade.intro.one': 'Free includes {limit} active language',
  'checkout.downgrade.intro.other': 'Free includes {limit} active languages',
  'checkout.downgrade.introMiddle':
    '. Pick the language you want to keep — sets in other languages are',
  'checkout.downgrade.hiddenBold': 'hidden, not deleted',
  'checkout.downgrade.introSuffix': ', and return automatically if you upgrade again.',
  'checkout.downgrade.langMeta': '{sets} · {words}',
  'checkout.downgrade.sets.one': '{count} set',
  'checkout.downgrade.sets.other': '{count} sets',
  'checkout.downgrade.keepPrefix': 'Keep',
  'checkout.downgrade.keepSuffix.one':
    'and hide {count} other language ({sets}). Your streaks, stats and word mastery are kept.',
  'checkout.downgrade.keepSuffix.other':
    'and hide {count} other languages ({sets}). Your streaks, stats and word mastery are kept.',
  'checkout.downgrade.selectPrompt': 'Select a language to continue.',
  'checkout.downgrade.confirmCta': 'Confirm — switch to Free',
} as const;

export type CheckoutKeys = keyof typeof checkoutEn;
