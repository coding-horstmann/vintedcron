'use client';

import React from 'react';
import { Layout } from '@/components/Layout';
import { TrendingUp } from 'lucide-react';

export default function HistoryPage() {
  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="rounded-full bg-primary/10 p-6 mb-6">
          <TrendingUp className="h-12 w-12 text-primary" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-4">History</h1>
        <p className="text-slate-400 text-center max-w-md">
          Diese Seite ist noch in Entwicklung. Hier werden zukünftig deine gescannten Deals gespeichert.
        </p>
      </div>
    </Layout>
  );
}

