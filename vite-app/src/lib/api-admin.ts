import { queryModels } from './api';
import type { BikeModel } from './types';
import { publicImageUrl } from './api';

export interface AdminModelRow extends BikeModel {
  primary_image_url: string | null;
}

/**
 * Admin-side model fetches (all statuses) — kept separate from public queries
 * so admin screens can always see drafts/unpublished records.
 */
export async function getModelsAdmin(q: { status?: string; search?: string; ids?: string[] } = {}): Promise<AdminModelRow[]> {
  const sb = (await import('./supabase')).requireSupabase();
  let query = sb
    .from('bike_models')
    .select('id, brand_id, name, slug, fuel_type, body_type, price_start, price_end, mileage_kmpl, top_speed_kmph, power_ps, torque_nm, engine_cc, battery_kwh, range_km, charging_time, abs_enabled, status, launch_date, is_featured, popularity, overview, seo_title, seo_description, canonical_url, og_image_path, is_published, created_at, updated_at, brands ( name, slug ), bike_images ( id, storage_path, original_path, processed_path, bucket, is_primary, sort_order )')
    .order('created_at', { ascending: false })
    .limit(300);
  if (q.status) query = query.eq('status', q.status);
  if (q.search) query = query.ilike('name', `%${q.search}%`);
  if (q.ids?.length) query = query.in('id', q.ids);
  const { data, error } = await query;
  if (error) throw new Error(error.message || 'Could not load models.');
  return (data || []).map((m: any) => {
    const imgs = (m.bike_images || []) as any[];
    const primary = imgs.find((i) => i.is_primary) || imgs[0];
    const path = primary ? (primary.processed_path || primary.original_path || primary.storage_path) : null;
    return {
      ...m,
      brand_name: m.brands?.name,
      brand_slug: m.brands?.slug,
      primary_image_url: path ? publicImageUrl(primary.bucket || 'bike-images', path) : null,
    };
  }) as AdminModelRow[];
}
