import type { Metadata } from 'next';
import '@/lib/i18n/register/review';
import '@/lib/i18n/register/dashboard';
import '@/lib/i18n/register/stats';
import ReviewSession from '@/components/review/ReviewSession';

export const metadata: Metadata = {
  title: 'Review Today',
  robots: { index: false, follow: false },
};

export default function ReviewPage() {
  return <ReviewSession />;
}
