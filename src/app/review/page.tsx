import { registerRoute } from "@/lib/i18n/register/route";
registerRoute("review");
import type { Metadata } from 'next';
import ReviewSession from '@/components/review/ReviewSession';

export const metadata: Metadata = {
  title: 'Review Today',
  robots: { index: false, follow: false },
};

export default function ReviewPage() {
  return <ReviewSession />;
}
