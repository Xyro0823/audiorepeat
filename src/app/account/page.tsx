import { registerRoute } from '@/lib/i18n/register/route';
registerRoute('dashboard');
import AccountCenter from '@/components/account/AccountCenter';

export default function AccountPage() {
  return <AccountCenter />;
}
