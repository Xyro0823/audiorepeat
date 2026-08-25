/**
 * Монгол strings for the auth area. Natural phrasing over literal
 * translation; placeholders ({name}) are preserved. Error messages use the
 * polite imperative; button labels carry no trailing periods.
 */
import type { AuthKeys } from '../en/auth';

export const authMn: Record<AuthKeys, string> = {
  // Табууд / үндсэн үйлдлүүд
  'auth.tab.signIn': 'Нэвтрэх',
  'auth.tab.createAccount': 'Бүртгүүлэх',

  // AuthScreen
  'auth.subtitle.gate':
    'Ахиц, давталтын хуваариа хадгалах бол нэвтэрнэ үү. Эсвэл зочиноор үргэлжлүүлж болно.',
  'auth.subtitle.overlay': 'Ахиц, статистикаа хадгалах бол бүртгэл үүсгээрэй.',
  'auth.firebaseNotConfigured': '🔧 Firebase тохируулаагүй байна',
  'auth.setup.intro': 'Нэвтрэлт Firebase Authentication ашигладаг. Идэвхжүүлэхийн тулд',
  'auth.setup.mid': 'файлыг',
  'auth.setup.rest':
    ' руу хуулж, Firebase вэб аппын тохиргоогоо оруулаад (Firebase console → Project settings → Your apps → SDK setup and configuration), дараа нь dev серверийг дахин эхлүүлнэ үү. Тэр хүртэл апп зочин горимдоо ажиллана — данс ч алга, нэвтрэлт ч алга.',
  'auth.google.button': 'Google-оор нэвтрэх',
  'auth.google.busy': 'Ажиллаж байна…',
  'auth.orUseEmail': 'эсвэл имэйлээр',
  'auth.or': 'эсвэл',
  'auth.displayName.label': 'Харагдах нэр',
  'auth.displayName.optional': '(сонголттой)',
  'auth.displayName.placeholder': 'Амжилтын самбарт ингэж харагдана',
  'auth.email.label': 'Имэйл',
  'auth.email.placeholder': 'you@example.com',
  'auth.password.label': 'Нууц үг',
  'auth.password.placeholder.signin': 'Нууц үг',
  'auth.password.placeholder.signup': 'Дор хаяж 6 тэмдэгт',
  'auth.password.show': 'Нууц үгийг харах',
  'auth.password.hide': 'Нууц үгийг нуух',
  'auth.confirmPassword.label': 'Нууц үгээ давтах',
  'auth.confirmPassword.placeholder': 'Нууц үгээ дахин бичнэ үү',
  'auth.continueAsGuest': 'Зочиноор үргэлжлүүлэх',
  'auth.cancel': 'Цуцлах',
  'auth.privacyNote':
    '🔒 Нэвтэрсэн үед таны үгийн багц болон ахиц төхөөрөмжүүдийн хооронд синк хийгдэнэ. Зочин горимын мэдээлэл зөвхөн энэ төхөөрөмжид хадгалагдана.',
  'auth.error.passwordMismatch': 'Нууц үгс таарахгүй байна — дахин шалгана уу.',

  // ProfileDropdown
  'auth.signedInAs': '{name} нэрээр нэвтэрсэн',
  'auth.accountAndTools': 'Бүртгэл ба хэрэгслүүд',
  'auth.firebaseAccount': 'Firebase бүртгэл',
  'auth.managePlan': 'Төлөвлөгөөг удирдах',
  'auth.switchToFreePlan': 'Үнэгүй төлөвлөгөө рүү шилжих',
  'auth.upgradeToPro': 'Pro руу шинэчлэх',
  'auth.leaderboard': 'Амжилтын самбар',
  'auth.stats': 'Статистик',
  'auth.subtitlesToSet': 'Субтитраас багц үүсгэх',
  'auth.browseLibrary': 'Санг үзэх',
  'auth.adminSection': 'Админ',
  'auth.giftPro': 'Pro бэлэглэх',
  'auth.languageDiagnostics': 'Хэлний оношилгоо',
  'auth.onboardingAnalytics': 'Онбордингийн анализ',
  'auth.errorDiagnostics': 'Алдааны оношилгоо',
  'auth.signInOrCreate': 'Нэвтрэх / Бүртгүүлэх',
  'auth.signOut': 'Гарах',
  'auth.deleteAccount': 'Бүртгэл устгах',
  'auth.deleteConfirm.body':
    'Firebase бүртгэл, синк хийсэн багц болон ахицаа устгах уу? Энэ үйлдлийг буцаах боломжгүй.',
  'auth.deleteConfirm.delete': 'Устгах',

  // lib/authStore-оос буцах баталгаажуулалтын алдаанууд (non-react t()).
  'auth.error.unconfigured':
    'Firebase тохируулаагүй байна — firebaseConfig тохиргоогоо .env.local файлд нэмээрэй (.env.example-г харна уу).',
  'auth.error.invalidEmail': 'Зөв имэйл хаяг оруулна уу.',
  'auth.error.shortPassword': 'Нууц үг дор хаяж 6 тэмдэгттэй байх ёстой.',
  'auth.error.missingCredentials': 'Имэйл хаягаа нууц үгээ оруулна уу.',
  'auth.error.reSignInToDelete': 'Бүртгэлээ устгахаасаа өмнө дахин нэвтэрнэ үү.',
  'auth.error.deleteFailed': 'Бүртгэлийг устгаж чадсангүй.',
};
