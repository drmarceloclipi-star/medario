import type { Metadata } from 'next';

import { ProDashboard } from './pro-dashboard';

export const metadata: Metadata = {
  title: 'Medário Pro',
  description: 'Área individual do médico no Medário.',
  robots: { index: false, follow: false },
};

export default function ProPage() {
  return <ProDashboard />;
}
