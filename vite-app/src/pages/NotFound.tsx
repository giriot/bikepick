import React from 'react';
import { Link } from 'react-router-dom';
import { useSEO } from '../lib/seo';

/** 404 — friendly, with the most useful starting points. */
export default function NotFoundPage() {
  useSEO({ title: 'Page not found', noIndex: true });
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="text-6xl font-black text-ink-200">404</p>
      <h1 className="mt-3 text-2xl font-black text-ink-900">We couldn't find that page</h1>
      <p className="mt-2 text-sm text-ink-500">It may have moved, or the link was typed wrong. Try one of these instead:</p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link to="/" className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-black text-white hover:bg-primary-700">Home</Link>
        <Link to="/new-bikes" className="rounded-xl border border-ink-300 bg-white px-5 py-2.5 text-sm font-black text-ink-700 hover:bg-ink-50">New bikes</Link>
        <Link to="/used-bikes" className="rounded-xl border border-ink-300 bg-white px-5 py-2.5 text-sm font-black text-ink-700 hover:bg-ink-50">Used bikes</Link>
        <Link to="/compare" className="rounded-xl border border-ink-300 bg-white px-5 py-2.5 text-sm font-black text-ink-700 hover:bg-ink-50">Compare</Link>
      </div>
    </div>
  );
}
