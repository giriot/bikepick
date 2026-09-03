'use client';

import { useCompare } from '@/hooks/useCompare';

export function CompareToggle({ productId, label, className = '' }: { productId: string; label: string; className?: string }) {
  const { ids, toggle, isFull } = useCompare();
  const selected = ids.includes(productId);
  const disabled = !selected && isFull;

  return (
    <button
      type="button"
      onClick={() => toggle(productId)}
      disabled={disabled}
      aria-pressed={selected}
      title={disabled ? 'You can compare up to 4 products' : `Compare ${label}`}
      className={`btn btn-sm shrink-0 border ${selected ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line bg-white text-ink-soft hover:border-brand-300'} ${className}`.trim()}
    >
      {selected ? '✓ Added' : 'Compare'}
    </button>
  );
}
