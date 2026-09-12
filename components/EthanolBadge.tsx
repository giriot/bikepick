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

/** Round fuel-cap style badge (as on the sticker below a fuel filler) for
 *  placing beside the price. Code = E20 / E85 / E100 / E0. */
const ROUND_META: Record<string, { code: string; label: string; note: string; cls: string }> = {
  e20: {
    code: 'E20',
    label: 'E20 ready',
    note: 'Runs on E20 — 20% ethanol (India\u2019s standard petrol)',
    cls: 'from-emerald-500 to-green-600',
  },
  e85: {
    code: 'E85',
    label: 'Flex-fuel',
    note: 'Runs on any blend from E20 up to E85',
    cls: 'from-teal-500 to-emerald-600',
  },
  e100: {
    code: 'E100',
    label: 'Flex-fuel',
    note: 'Runs on any blend from E20 up to E100',
    cls: 'from-green-500 to-emerald-700',
  },
  none: {
    code: 'E0',
    label: 'Petrol only',
    note: 'Not rated for ethanol blends',
    cls: 'from-slate-400 to-slate-500',
  },
};

export function RoundEthanolBadge({ blend }: { blend: EthanolBlend }) {
  const meta = ROUND_META[blend || ''];
  if (!meta) return null;
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br text-white shadow-md ring-2 ring-white ${meta.cls}`}
      >
        <span className="flex flex-col items-center gap-0.5 leading-none">
          <DropIcon className="h-3 w-3" />
          <span className="text-[10.5px] font-extrabold tracking-tight">{meta.code}</span>
        </span>
      </span>
      <span className="text-[11px] leading-4">
        <span className="font-semibold">{meta.label}</span>
        <span className="block text-ink-mute">{meta.note}</span>
      </span>
    </span>
  );
}
