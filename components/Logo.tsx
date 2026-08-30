import Image from 'next/image';
import Link from 'next/link';

/**
 * Brand lockup.
 *
 * The emblem is a raster badge, so it is used at a fixed small size next to a
 * typeset wordmark rather than being scaled down as a whole — the metallic
 * "BIKEPICK" lettering inside the artwork is unreadable below about 200px and
 * disappears against a light header. The full artwork is used where it has room
 * to breathe (footer, share images, app icon) via <LogoFull />.
 */
export function Logo({ compact = false, light = false }: { compact?: boolean; light?: boolean }) {
  return (
    <Link href="/" className="group flex items-center gap-2.5" aria-label="Bikepick.IN — home">
      <span className="relative block h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-ink ring-1 ring-black/5 transition-transform group-hover:scale-[1.04]">
        <Image
          src="/brand/bikepick-mark.png"
          alt=""
          width={80}
          height={80}
          priority
          className="h-full w-full object-cover"
        />
      </span>
      <span className="leading-none">
        <span className={`block text-[19px] font-extrabold tracking-[-0.03em] ${light ? 'text-white' : 'text-ink'}`}>
          bikepick<span className="text-brand-600">.IN</span>
        </span>
        {!compact && (
          <span className={`mt-1 block text-[10.5px] font-semibold uppercase tracking-[0.09em] ${light ? 'text-white/60' : 'text-ink-mute'}`}>
            Compare Smart. Buy Better.
          </span>
        )}
      </span>
    </Link>
  );
}

/** The complete emblem, for places with room for it. */
export function LogoFull({ className = '', width = 260 }: { className?: string; width?: number }) {
  return (
    <Image
      src="/brand/bikepick-logo-full.png"
      alt="Bikepick.IN"
      width={width}
      height={Math.round((width * 607) / 900)}
      className={className}
      priority={false}
    />
  );
}
