import AdminPageErrorBoundary from '@/components/admin/AdminPageErrorBoundary';
import AdminTranslationReports from '@/components/admin/AdminTranslationReports';

export const dynamic = 'force-dynamic';

export default function AdminTranslationReportsPage() {
  return (
    <AdminPageErrorBoundary>
      <AdminTranslationReports />
    </AdminPageErrorBoundary>
  );
}
