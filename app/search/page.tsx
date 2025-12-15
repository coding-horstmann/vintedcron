'use client';

import React from 'react';
import { Layout } from '@/components/Layout';
import { Search } from 'lucide-react';

export default function SearchPage() {
  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="rounded-full bg-primary/10 p-6 mb-6">
          <Search className="h-12 w-12 text-primary" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-4">Search Deals</h1>
        <p className="text-slate-400 text-center max-w-md">
          Diese Seite ist noch in Entwicklung. Verwende das Dashboard, um nach Arbitrage-Möglichkeiten zu suchen.
        </p>
      </div>
    </Layout>
  );
}

