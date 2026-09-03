import { db } from '@/lib/db';
import { getSettings, isOn } from '@/lib/settings';

/**
 * Controlled ad placement. A slot renders ONLY when:
 *   1. the admin has enabled ads globally,
 *   2. the specific slot is enabled,
 *   3. an AdSense client id is configured.
 * Otherwise nothing is rendered at all — no empty boxes, no fake placements.
 * Every rendered unit is visibly labelled "Advertisement".
 */
export async function AdSlot({ slotKey, className = '' }: { slotKey: string; className?: string }) {
  const settings = await getSettings();
  if (!isOn(settings.ads_enabled)) return null;

  const client = settings.adsense_client_id || process.env.ADSENSE_CLIENT_ID;
  if (!client) return null;

  const slot = await db.get<any>('SELECT * FROM ad_slots WHERE slot_key = ? AND enabled = 1', [slotKey]);
  // No unit ID pasted yet (Admin → Ad slots) -> nothing renders; no broken empty units.
  if (!slot || !slot.ad_unit_id) return null;

  const visibility = [slot.show_desktop ? '' : 'lg:hidden', slot.show_mobile ? '' : 'hidden lg:block'].join(' ');

  return (
    <aside aria-label="Advertisement" className={`${className} ${visibility}`}>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-mute">Advertisement</p>
      <ins
        className="adsbygoogle block w-full overflow-hidden rounded-xl border border-line bg-surface"
        style={{ display: 'block', minHeight: 90 }}
        data-ad-client={client}
        data-ad-slot={slot.ad_unit_id || ''}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
