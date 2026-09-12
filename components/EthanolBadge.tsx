/** Attractive badge for a model's ethanol-blend capability.
 *  Values live on products.ethanol_blend: e20 / e85 / e100 / none / null. */
export type EthanolBlend = 'e20' | 'e85' | 'e100' | 'none' | string | null | undefined;

const META: Record<string, { label: string; title: string; cls: string }> = {
  e20: {
    label: 'E20 Ready',
    title: "Runs on E20 petrol (20% ethanol) — India's standard petrol since 2026.",
    cls: 'from-emerald-500 to-green-600',
  },
  e85: {
    label: 'Flex-fuel E20–E85',
    title: 'Flex-fuel: runs on any ethanol blend from E20 up to E85.',
    cls: 'from-teal-500 to-emerald-600',
  },
  e100: {
    label: 'Flex-fuel E20–E100',
    title: 'Flex-fuel: runs on any ethanol blend from E20 up to E100 (100% ethanol).',
    cls: 'from-green-500 to-emerald-700',
  },
};

export function EthanolBadge({ blend, size = 'sm' }: { blend: EthanolBlend; size?: 'sm' | 'md' }) {
  const meta = META[blend || ''];
  if (!meta) return null;
  return (
    <span
      title={meta.title}
      className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r font-semibold text-white shadow-sm ring-1 ring-black/10 ${meta.cls} ${
        size === 'md' ? 'px-3 py-1 text-[12px]' : 'px-2 py-0.5 text-[10px]'
      }`}
    >
      <DropIcon className={size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3'} />
      {meta.label}
    </span>
  );
}

function DropIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2.6C12 2.6 5.4 9.3 5.4 14.2a6.6 6.6 0 0 0 13.2 0C18.6 9.3 12 2.6 12 2.6z" />
      <path
        d="M8.3 14.5c1.5 2.3 5.9 2.3 7.4 0"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
