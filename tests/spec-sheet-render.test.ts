import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { FullSpecSheet } from '@/components/FullSpecSheet';

/**
 * Every spec column that the admin form or the CSV sheet can fill has to have a
 * row here, or the value is stored and simply never shown. This renders the real
 * component and asserts each such column reaches the HTML — plus that a blank is
 * omitted rather than printed as "N/A", which is the documented behaviour.
 */
function renderBike(bike: Record<string, unknown>) {
  return renderToStaticMarkup(createElement(FullSpecSheet, { bike, ev: null, isEv: false } as any));
}

describe('FullSpecSheet renders what is recorded', () => {
  it('shows the columns that used to be stored invisibly', () => {
    const html = renderBike({
      hill_hold: 1, reverse_mode: 0, est_service_cost: 1250, accessories: 'Engine Guard, Seat Cover',
      warranty: '5 Years', colours: 'Red',
    });
    expect(html).toContain('Hill hold assist');
    expect(html).toContain('Accessories');
    expect(html).toContain('Engine Guard');
    expect(html).toContain('Typical service cost');
    expect(html).toMatch(/1,250/);            // rupee-formatted, not a bare integer
    expect(html).toContain('Reverse assist'); // a recorded 0 is an answer, not a gap
  });

  it('omits blank fields instead of printing N/A', () => {
    const html = renderBike({ headlight: 'LED', accessories: null, est_service_cost: null, hill_hold: null });
    expect(html).toContain('Headlight');
    expect(html).not.toMatch(/Accessories|Typical service cost|Hill hold/);
    expect(html).not.toContain('N/A');
  });

  it('shows the EV range basis next to the range figures', () => {
    const html = renderToStaticMarkup(createElement(FullSpecSheet, {
      bike: null, isEv: true,
      ev: { claimed_range_km: 102, real_world_range_km: 80, range_basis: 'IDC' },
    } as any));
    expect(html).toContain('Range basis');
    expect(html).toContain('IDC');
  });

  it('covers every spec column the sheet can carry', async () => {
    const { specSheetKeys } = await import('@/lib/spec-sheet');
    const src = await import('fs').then((m) => m.readFileSync('components/FullSpecSheet.tsx', 'utf8'));
    const missing = specSheetKeys().filter((k) => !new RegExp(`\\bs?\\.?\\b${k}\\b`).test(src));
    expect(missing, `no row displays these recorded columns: ${missing.join(', ')}`).toEqual([]);
  });
});
