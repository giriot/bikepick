import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getFaqs } from '../lib/api';
import type { Faq } from '../lib/types';
import { useSEO } from '../lib/seo';
import { EmptyState, ErrorBlock, LoadingBlock } from '../components/ui';

/**
 * /faq — Frequently asked questions (managed from the admin panel).
 */
export default function FaqPage() {
  const [rows, setRows] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useSEO({ title: 'Frequently Asked Questions', description: 'Answers about comparing bikes, pricing, used-bike verification, dealer offers and the CompareBike Score.' });

  useEffect(() => {
    (async () => {
      try {
        const all = await getFaqs();
        setRows(all.filter((f) => f.is_active));
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} />;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-2 text-3xl font-black text-ink-900">Frequently Asked Questions</h1>
      <p className="mb-8 text-sm text-ink-500">Quick answers. For anything else, <Link to="/contact" className="font-bold text-primary-600 hover:underline">contact us</Link>.</p>

      {rows.length ? (
        <div className="divide-y divide-ink-100 overflow-hidden rounded-2xl border border-ink-200 bg-white">
          {rows.map((f) => (
            <div key={f.id}>
              <button
                onClick={() => setOpen(open === f.id ? null : f.id)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-ink-50"
              >
                <span className="font-bold text-ink-900">{f.question}</span>
                <span className={`shrink-0 text-lg font-black text-primary-600 transition-transform ${open === f.id ? 'rotate-45' : ''}`}>+</span>
              </button>
              {open === f.id && <p className="whitespace-pre-line px-5 pb-5 text-sm leading-relaxed text-ink-600">{f.answer}</p>}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="No FAQs yet" desc="Common questions and answers will appear here." />
      )}
    </div>
  );
}
