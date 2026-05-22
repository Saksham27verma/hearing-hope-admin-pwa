import { Suspense } from 'react';
import ReportsView from '@/components/reports/ReportsView';

export default function ReportsPage() {
  return (
    <Suspense fallback={null}>
      <ReportsView />
    </Suspense>
  );
}
