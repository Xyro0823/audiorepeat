/**
 * English strings for the auth area (keys are the source of truth).
 * Covers AuthScreen, ProfileDropdown and the non-react validation errors
 * returned by lib/authStore.
 */
export const authEn = {
  // Tabs / primary actions ("Sign in" also serves as dialog aria + submit label)
  'auth.tab.signIn': 'Sign in',
  'auth.tab.createAccount': 'Create account',

  // AuthScreen
  'auth.subtitle.gate':
    'Sign in to keep your streaks and progress, or start fresh as a guest.',
  'auth.subtitle.overlay': 'Create an account to keep your own stats and streak.',
  'auth.firebaseNotConfigured': '🔧 Firebase not configured',
  'auth.setup.intro': 'Sign-in uses Firebase Authentication. To enable it: copy',
  'auth.setup.mid': 'to',
  'auth.setup.rest':
    ', paste your Firebase web app config (Firebase console → Project settings → Your apps → SDK setup and configuration), then restart the dev server. Until then the app runs in guest mode — no accounts, no sign-in.',
  'auth.google.button': 'Sign in with Google',
  'auth.google.busy': 'Working…',
  'auth.orUseEmail': 'or use email',
  'auth.or': 'or',
  'auth.displayName.label': 'Display name',
  'auth.displayName.optional': '(optional)',
  'auth.displayName.placeholder': 'How your leaderboard shows you',
  'auth.email.label': 'Email',
  'auth.email.placeholder': 'you@example.com',
  'auth.password.label': 'Password',
  'auth.password.placeholder.signin': 'Your password',
  'auth.password.placeholder.signup': 'At least 6 characters',
  'auth.password.show': 'Show password',
  'auth.password.hide': 'Hide password',
  'auth.confirmPassword.label': 'Confirm password',
  'auth.confirmPassword.placeholder': 'Repeat your password',
  'auth.continueAsGuest': 'Continue as guest',
  'auth.cancel': 'Cancel',
  'auth.privacyNote':
    '🔒 Firebase accounts sync your identity online — your vocabulary sets, streaks and stats stay on this device. Sign-in needs an internet connection; listening works offline.',
  'auth.error.passwordMismatch': 'Passwords do not match.',
  'auth.password.forgot': 'Forgot password?',
  'auth.password.resetSent': 'If an account uses that email, a reset link is on its way.',
  'auth.verify.sent': 'Verification email sent. Check your inbox.',
  'auth.verify.pending': 'Email not verified',
  'auth.verify.resend': 'Resend verification email',
  'auth.verify.title': 'Check your inbox',
  'auth.verify.body': 'We sent a verification link to {email}. Open it, then come back here.',
  'auth.verify.spam': 'Also check your spam or Promotions folder.',
  'auth.verify.check': "I've verified my email",
  'auth.verify.checking': 'Checking…',
  'auth.verify.notYet': 'The link has not been opened yet. Check your inbox, then try again.',
  'auth.verify.verified': 'Email verified',
  'auth.verify.ready': 'Your account is ready to go.',
  'auth.verify.continue': 'Continue',

  // ProfileDropdown
  'auth.signedInAs': 'Signed in as {name}',
  'auth.accountAndTools': 'Account & tools',
  'auth.firebaseAccount': 'Firebase account',
  'auth.managePlan': 'Manage plan',
  'auth.switchToFreePlan': 'Switch to Free plan',
  'auth.upgradeToPro': 'Upgrade to Pro',
  'auth.leaderboard': 'Leaderboard',
  'auth.stats': 'Stats',
  'auth.subtitlesToSet': 'Subtitles → set',
  'auth.browseLibrary': 'Browse library',
  'auth.adminSection': 'Admin',
  'auth.giftPro': 'Gift Pro',
  'auth.languageDiagnostics': 'Language Diagnostics',
  'auth.onboardingAnalytics': 'Onboarding Analytics',
  'auth.errorDiagnostics': 'Error Diagnostics',
  'auth.translationReports': 'Translation Reports',
  'auth.signInOrCreate': 'Sign in / Create account',
  'auth.signOut': 'Sign out',
  'auth.deleteAccount': 'Delete account',
  'auth.deleteConfirm.body':
    "Delete your Firebase account and its stats? This can't be undone.",
  'auth.deleteConfirm.delete': 'Delete',

  // Validation / API errors surfaced by lib/authStore (non-react t()).
  // English values must stay byte-identical to the original literals.
  'auth.error.unconfigured':
    'Firebase is not configured — add your firebaseConfig to .env.local (see .env.example).',
  'auth.error.invalidEmail': 'Enter a valid email address.',
  'auth.error.shortPassword': 'Password must be at least 6 characters.',
  'auth.error.missingCredentials': 'Enter your email and password.',
  'auth.error.reSignInToDelete': 'Please sign in again before deleting your account.',
  'auth.error.deleteFailed': 'Could not delete your account.',
  'auth.error.reSignInToVerify': 'Please sign in again before verifying your email.',
} as const;

export type AuthKeys = keyof typeof authEn;
