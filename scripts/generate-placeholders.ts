/**
 * Generates the neutral studio-style product placeholders used until an admin
 * uploads licensed photography.
 *
 * These are ORIGINAL vector illustrations created by this project. They are
 * deliberately abstract silhouettes: they are never presented as official
 * manufacturer photographs, and every seeded image row records
 * license_status = 'owned_placeholder'.
 */
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.join(process.cwd(), 'public', 'media');

function frame(inner: string, accent: string, label: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="800" height="500" role="img" aria-label="${label} illustration placeholder">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFFFFF"/><stop offset="70%" stop-color="#F7F9FC"/><stop offset="100%" stop-color="#EDF1F7"/>
    </linearGradient>
    <radialGradient id="pad" cx="50%" cy="88%" r="42%">
      <stop offset="0%" stop-color="#C9D3E0" stop-opacity=".55"/><stop offset="100%" stop-color="#C9D3E0" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="body" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${accent}"/><stop offset="100%" stop-color="#0B1220"/>
    </linearGradient>
  </defs>
  <rect width="800" height="500" fill="url(#bg)"/>
  <ellipse cx="400" cy="430" rx="290" ry="34" fill="url(#pad)"/>
  ${inner}
  <text x="400" y="478" text-anchor="middle" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="15" fill="#8C96A6" letter-spacing=".18em">ILLUSTRATION · AWAITING LICENSED PHOTO</text>
</svg>
`;
}

const wheel = (cx: number, cy: number, r: number) => `
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="#12161D"/>
  <circle cx="${cx}" cy="${cy}" r="${r - 9}" fill="#1D242E"/>
  <circle cx="${cx}" cy="${cy}" r="${r - 26}" fill="#C6CFDA"/>
  <circle cx="${cx}" cy="${cy}" r="${r - 40}" fill="#8D99A8"/>
  ${Array.from({ length: 10 }, (_, i) => {
    const a = (i * Math.PI) / 5;
    return `<line x1="${cx + Math.cos(a) * (r - 38)}" y1="${cy + Math.sin(a) * (r - 38)}" x2="${cx + Math.cos(a) * (r - 12)}" y2="${cy + Math.sin(a) * (r - 12)}" stroke="#AFBAC7" stroke-width="5" stroke-linecap="round"/>`;
  }).join('')}`;

const motorcycle = (accent: string) => `
  ${wheel(215, 340, 84)}
  ${wheel(600, 340, 84)}
  <path d="M255 330 L330 250 L455 250 L520 300 L560 330" stroke="#2A3442" stroke-width="12" fill="none" stroke-linecap="round"/>
  <path d="M300 258 C330 205 420 190 470 205 L520 232 L470 262 L360 268 Z" fill="url(#body)"/>
  <path d="M455 214 C520 200 570 226 590 268 L536 286 C520 250 492 232 455 232 Z" fill="url(#body)" opacity=".85"/>
  <path d="M262 268 C240 236 250 208 286 196 L318 232 Z" fill="#1B2430"/>
  <rect x="286" y="188" width="118" height="16" rx="8" fill="#39445200"/>
  <path d="M300 196 L212 196" stroke="#39424F" stroke-width="11" stroke-linecap="round"/>
  <path d="M215 262 L215 200" stroke="#5A6675" stroke-width="10" stroke-linecap="round"/>
  <path d="M600 300 L640 268" stroke="#5A6675" stroke-width="10" stroke-linecap="round"/>
  <ellipse cx="480" cy="253" rx="58" ry="15" fill="#0F1520"/>
  <circle cx="207" cy="205" r="17" fill="#F3F7FC" stroke="#39424F" stroke-width="4"/>
  <rect x="546" y="286" width="66" height="13" rx="6" fill="#39424F"/>`;

const scooter = (accent: string) => `
  ${wheel(220, 348, 66)}
  ${wheel(596, 348, 66)}
  <path d="M262 352 L520 352 C560 352 566 330 560 312 L534 250 L470 250 L430 300 L300 300 Z" fill="url(#body)"/>
  <path d="M300 300 C268 296 254 268 262 232 L300 200 L336 214 L318 300 Z" fill="#1B2430"/>
  <path d="M296 206 L226 194" stroke="#39424F" stroke-width="12" stroke-linecap="round"/>
  <ellipse cx="486" cy="248" rx="66" ry="16" fill="#0F1520"/>
  <path d="M540 268 C580 268 606 296 606 320" stroke="#5A6675" stroke-width="10" fill="none" stroke-linecap="round"/>
  <circle cx="240" cy="222" r="16" fill="#F3F7FC" stroke="#39424F" stroke-width="4"/>
  <rect x="292" y="180" width="60" height="12" rx="6" fill="#59647300"/>`;

const evBadge = `
  <g transform="translate(628,150)">
    <rect x="0" y="0" width="112" height="38" rx="19" fill="#00B27A"/>
    <path d="M28 10 L18 22 H25 L22 30 L33 17 H26 Z" fill="#FFFFFF"/>
    <text x="66" y="25" text-anchor="middle" font-family="system-ui,sans-serif" font-size="15" font-weight="700" fill="#FFFFFF">ELECTRIC</text>
  </g>`;

const VARIANTS: Record<string, { art: string; accent: string; label: string }> = {
  commuter: { art: motorcycle('#3D5A80'), accent: '#3D5A80', label: 'Commuter motorcycle' },
  street: { art: motorcycle('#F0620C'), accent: '#F0620C', label: 'Street motorcycle' },
  sport: { art: motorcycle('#E11D48'), accent: '#E11D48', label: 'Sport motorcycle' },
  cruiser: { art: motorcycle('#6B4E2E'), accent: '#6B4E2E', label: 'Cruiser motorcycle' },
  adventure: { art: motorcycle('#0F766E'), accent: '#0F766E', label: 'Adventure motorcycle' },
  scooter: { art: scooter('#5B21B6'), accent: '#5B21B6', label: 'Scooter' },
  'ev-scooter': { art: scooter('#00875C') + evBadge, accent: '#00875C', label: 'Electric scooter' },
  'ev-bike': { art: motorcycle('#00875C') + evBadge, accent: '#00875C', label: 'Electric motorcycle' },
  used: { art: motorcycle('#64748B'), accent: '#64748B', label: 'Used two-wheeler' },
};

fs.mkdirSync(OUT, { recursive: true });
for (const [key, v] of Object.entries(VARIANTS)) {
  fs.writeFileSync(path.join(OUT, `${key}.svg`), frame(v.art, v.accent, v.label));
}
console.log(`✓ wrote ${Object.keys(VARIANTS).length} product placeholders to public/media`);
