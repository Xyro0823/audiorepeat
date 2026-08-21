import AdminErrors from '@/components/admin/AdminErrors';
import AdminPageErrorBoundary from '@/components/admin/AdminPageErrorBoundary';

export const dynamic = 'force-dynamic';

export default function AdminErrorsPage() {
  return (
    <AdminPageErrorBoundary>
      <AdminErrors />
    </AdminPageErrorBoundary>
  );
}
