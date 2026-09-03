// ─── CSV import/export helpers (client-side, no dependencies) ───────────────

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQuotes = false;
  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cur);
      cur = '';
    } else if (ch === '\n') {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur !== '' || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

export function toCSV(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
}

export function downloadFile(filename: string, content: string, mime = 'text/csv') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function readCsvFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.readAsText(file);
  });
}

export const BIKES_CSV_TEMPLATE = `brand_name,brand_slug,name,fuel_type,body_type,price_start,price_end,status,launch_date,engine_cc,power_ps,torque_nm,top_speed_kmph,mileage_kmpl,battery_kwh,range_km,charging_time,abs_enabled,overview
Hero,hero,Splendor Plus,petrol,Commuter,92000,99000,live,2024-01-15,119.6,10,9.5,85,70,,,N,A,India's most popular commuter...
Ola Electric,ola,S1 Pro,electric,Sport,139900,169900,live,2024-03-01,,,30,42,,,3.97,172,4.5 hrs,N,Flagship electric bike...

# Rules:
# - brand_name must match an existing brand (case-insensitive); new brands are created automatically.
# - fuel_type: petrol | electric | cng_petrol | diesel
# - status: live | upcoming | outdated | discontinued
# - abs_enabled: Y/N ; prices in INR ; empty cells become N/A (never fabricated).
`;

export const BRANDS_CSV_TEMPLATE = `name,tagline,description
Hero,India's largest motorcycle maker,
Honda,Reliable Japanese engineering,
`;
