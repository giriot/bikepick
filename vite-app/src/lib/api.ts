import { requireSupabase, errMsg } from './supabase';
import type {
  Article, BikeColour, BikeFeature, BikeImage, BikeModel, BikePro, BikeSpec, BikeVariant,
  Brand, BikeCon, DealerDocument, DealerOffer, DealerProfile, Enquiry, Faq, Report, Review,
  ScoreWeights, SearchResult, SpecDefinition, SpecGroup, UsedBike, AppNotification,
} from './types';
import { DEFAULT_WEIGHTS } from './score';

// ─── Brands ─────────────────────────────────────────────────────────────────

export async function getBrands(): Promise<Brand[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.from('brands').select('*').eq('is_active', true).order('name');
  if (error) throw new Error(errMsg(error, 'Could not load brands.'));
  return (data || []) as Brand[];
}

export async function getBrandBySlug(slug: string): Promise<Brand | null> {
  const sb = requireSupabase();
  const { data, error } = await sb.from('brands').select('*').eq('slug', slug).maybeSingle();
  if (error) throw new Error(errMsg(error));
  return (data as Brand) || null;
}

// ─── Bike models ────────────────────────────────────────────────────────────

export type ModelSort = 'price_asc' | 'price_desc' | 'mileage' | 'popular' | 'newest' | 'score';

export interface ModelQuery {
  fuel?: string;
  brand_id?: string;
  status?: string;
  price_min?: number;
  price_max?: number;
  cc_min?: number;
  cc_max?: number;
  mileage_min?: number;
  body_type?: string;
  range_min?: number;
  search?: string;
  sort?: ModelSort;
  page?: number;
  per_page?: number;
}

const MODEL_SELECT =
  'id, brand_id, name, slug, fuel_type, body_type, price_start, price_end, mileage_kmpl, top_speed_kmph, power_ps, torque_nm, engine_cc, battery_kwh, range_km, charging_time, abs_enabled, status, launch_date, is_featured, popularity, overview, seo_title, seo_description, canonical_url, og_image_path, is_published, created_at, updated_at, brands ( name, slug )';

function applyModelFilters(qb: any, q: ModelQuery) {
  if (q.fuel) qb = qb.eq('fuel_type', q.fuel);
  if (q.brand_id) qb = qb.eq('brand_id', q.brand_id);
  if (q.status) qb = qb.eq('status', q.status);
  else qb = qb.neq('status', 'discontinued');
  if (q.price_min) qb = qb.lte('price_start', q.price_min);
  if (q.price_max) qb = qb.gte('price_start', q.price_max);
  if (q.cc_min) qb = qb.gte('engine_cc', q.cc_min);
  if (q.cc_max) qb = qb.lte('engine_cc', q.cc_max);
  if (q.mileage_min) qb = qb.gte('mileage_kmpl', q.mileage_min);
  if (q.body_type) qb = qb.eq('body_type', q.body_type);
  if (q.range_min) qb = qb.gte('range_km', q.range_min);
  if (q.search) qb = qb.ilike('name', `%${q.search}%`);
  return qb;
}

export async function queryModels(q: ModelQuery): Promise<{ rows: BikeModel[]; count: number }> {
  const sb = requireSupabase();
  let query = sb.from('bike_models').select(MODEL_SELECT, { count: 'exact' }).eq('is_published', true);
  query = applyModelFilters(query, q);
  const page = q.page ?? 1;
  const per = q.per_page ?? 12;
  if (q.sort === 'price_asc') query = query.order('price_start', { ascending: true, nullsFirst: false });
  else if (q.sort === 'price_desc') query = query.order('price_start', { ascending: false, nullsFirst: true });
  else if (q.sort === 'mileage') query = query.order('mileage_kmpl', { ascending: false, nullsFirst: true });
  else if (q.sort === 'popular') query = query.order('popularity', { ascending: false, nullsFirst: true }).order('created_at', { ascending: false });
  else if (q.sort === 'score') query = query.order('popularity', { ascending: false, nullsFirst: true }); // final score sort computed client-side
  else query = query.order('created_at', { ascending: false });
  const { data, error, count } = await query.range((page - 1) * per, page * per - 1);
  if (error) throw new Error(errMsg(error, 'Could not load bikes.'));
  const rows = (data || []).map((m: any) => ({ ...m, brand_name: m.brands?.name, brand_slug: m.brands?.slug }));
  return { rows: rows as BikeModel[], count: count ?? 0 };
}

export async function getModelBySlug(brandSlug: string, modelSlug: string): Promise<BikeModel | null> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('bike_models')
    .select(MODEL_SELECT)
    .eq('slug', modelSlug)
    .eq('is_published', true)
    .eq('brands.slug', brandSlug)
    .maybeSingle();
  if (error) throw new Error(errMsg(error));
  if (!data) return null;
  return { ...data, brand_name: (data.brands as any)?.[0]?.name, brand_slug: (data.brands as any)?.[0]?.slug } as BikeModel;
}

export async function getModelById(id: string): Promise<BikeModel | null> {
  const sb = requireSupabase();
  const { data, error } = await sb.from('bike_models').select(MODEL_SELECT).eq('id', id).maybeSingle();
  if (error) throw new Error(errMsg(error));
  if (!data) return null;
  return { ...data, brand_name: (data.brands as any)?.[0]?.name, brand_slug: (data.brands as any)?.[0]?.slug } as BikeModel;
}

export async function getVariants(modelId: string): Promise<BikeVariant[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.from('bike_variants').select('*').eq('bike_model_id', modelId).order('sort_order');
  if (error) throw new Error(errMsg(error, 'Could not load variants.'));
  return (data || []) as BikeVariant[];
}

export async function getColours(modelId: string): Promise<BikeColour[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.from('bike_colours').select('*').eq('bike_model_id', modelId).order('sort_order');
  if (error) throw new Error(errMsg(error));
  return (data || []) as BikeColour[];
}

export async function getImages(modelId: string): Promise<BikeImage[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('bike_images')
    .select('*')
    .eq('bike_model_id', modelId)
    .order('is_primary', { ascending: false })
    .order('sort_order');
  if (error) throw new Error(errMsg(error));
  return (data || []) as BikeImage[];
}

export async function getSpecsForModel(modelId: string): Promise<BikeSpec[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('bike_specifications')
    .select('id, bike_model_id, variant_id, value_text, value_numeric, value_boolean, sort_order, specifications ( id, name, unit, data_type, score_key, specification_groups ( name ) )')
    .eq('bike_model_id', modelId)
    .order('sort_order');
  if (error) throw new Error(errMsg(error));
  return (data || []).map((s: any) => ({
    id: s.id,
    bike_model_id: s.bike_model_id,
    variant_id: s.variant_id,
    value_text: s.value_text,
    value_numeric: s.value_numeric,
    value_boolean: s.value_boolean,
    sort_order: s.sort_order,
    specification_id: s.specifications?.id,
    spec_name: s.specifications?.name,
    spec_unit: s.specifications?.unit,
    spec_group: s.specifications?.specification_groups?.name,
    spec_score_key: s.specifications?.score_key,
    data_type: s.specifications?.data_type,
  })) as BikeSpec[];
}

export async function getFeatures(modelId: string): Promise<BikeFeature[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.from('bike_features').select('*').eq('bike_model_id', modelId).order('sort_order');
  if (error) throw new Error(errMsg(error));
  return (data || []) as BikeFeature[];
}

export async function getPros(modelId: string): Promise<BikePro[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.from('bike_pros').select('*').eq('bike_model_id', modelId).order('sort_order');
  if (error) throw new Error(errMsg(error));
  return (data || []) as BikePro[];
}

export async function getCons(modelId: string): Promise<BikeCon[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.from('bike_cons').select('*').eq('bike_model_id', modelId).order('sort_order');
  if (error) throw new Error(errMsg(error));
  return (data || []) as BikeCon[];
}

export async function getSimilarModels(modelId: string, limit = 4): Promise<BikeModel[]> {
  const sb = requireSupabase();
  const model = await getModelById(modelId);
  if (!model) return [];
  const { data, error } = await sb
    .from('bike_models')
    .select(MODEL_SELECT)
    .eq('is_published', true)
    .neq('id', modelId)
    .eq('fuel_type', model.fuel_type)
    .order('popularity', { ascending: false, nullsFirst: true })
    .limit(limit);
  if (error) throw new Error(errMsg(error));
  return (data || []).map((m: any) => ({ ...m, brand_name: m.brands?.name, brand_slug: m.brands?.slug })) as BikeModel[];
}

// ─── Reviews ────────────────────────────────────────────────────────────────

export async function getReviewsForModel(modelId: string, page = 1, per = 5) {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('reviews')
    .select('*, profiles ( full_name )', { count: 'exact' })
    .eq('bike_model_id', modelId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .range((page - 1) * per, page * per - 1);
  if (error) throw new Error(errMsg(error));
  const rows = (data || []).map((r: any) => ({ ...r, user_name: r.profiles?.full_name || 'Verified buyer' }));
  const { data: ratings } = await sb.from('reviews').select('rating').eq('bike_model_id', modelId).eq('status', 'approved');
  const list = (ratings || []) as { rating: number }[];
  const avg = list.length ? Math.round((list.reduce((a, r) => a + r.rating, 0) / list.length) * 10) / 10 : null;
  return { rows: rows as Review[], count: (data?.length || 0) + (ratings?.length || 0) > 0 ? ratings!.length : 0, avg };
}

export async function createReview(input: Partial<Review>): Promise<void> {
  const sb = requireSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error('Please log in to write a review.');
  const { error } = await sb.from('reviews').insert({ ...input, user_id: user.id, status: 'pending' });
  if (error) throw new Error(errMsg(error, 'Could not submit your review.'));
}

// ─── Dealer offers ──────────────────────────────────────────────────────────

const OFFER_SELECT =
  'id, dealer_id, bike_model_id, variant_id, location_city, location_state, ex_showroom_price, on_road_price, discount_amount, exchange_bonus, finance_offer, insurance_offer, accessories, final_offer_price, contact_phone, valid_until, status, reject_reason, approved_at, created_at, updated_at, dealer_profiles ( id, dealer_name, city, state, status ), bike_models ( id, name, slug, fuel_type, brands ( slug, name ) )';

export async function getOffersForModel(modelId: string): Promise<DealerOffer[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('dealer_offers')
    .select(OFFER_SELECT)
    .eq('bike_model_id', modelId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false });
  if (error) throw new Error(errMsg(error));
  return (data || []).map(mapOffer) as DealerOffer[];
}

export async function getFeaturedOffers(limit = 6): Promise<DealerOffer[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('dealer_offers')
    .select(OFFER_SELECT)
    .eq('status', 'approved')
    .eq('dealer_profiles.status', 'approved')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(errMsg(error));
  return (data || []).map(mapOffer) as DealerOffer[];
}

export async function queryOffers(q: { status?: string; dealer_id?: string; dealer_user_id?: string; page?: number; per_page?: number }) {
  const sb = requireSupabase();
  let query = sb.from('dealer_offers').select(OFFER_SELECT, { count: 'exact' });
  if (q.status) query = query.eq('status', q.status);
  if (q.dealer_id) query = query.eq('dealer_id', q.dealer_id);
  if (q.dealer_user_id) query = query.eq('dealer_profiles.user_id', q.dealer_user_id);
  query = query.order('created_at', { ascending: false });
  const page = q.page ?? 1;
  const per = q.per_page ?? 10;
  const { data, error, count } = await query.range((page - 1) * per, page * per - 1);
  if (error) throw new Error(errMsg(error));
  return { rows: (data || []).map(mapOffer) as DealerOffer[], count: count ?? 0 };
}

function mapOffer(o: any): any {
  return {
    ...o,
    dealer_name: o.dealer_profiles?.dealer_name,
    dealer_city: o.dealer_profiles?.city,
    dealer_state: o.dealer_profiles?.state,
    bike_name: o.bike_models?.name,
    bike_slug: o.bike_models?.slug,
    brand_name: o.bike_models?.brands?.name,
    brand_slug: o.bike_models?.brands?.slug,
  };
}

export async function createOffer(input: Partial<DealerOffer>): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('dealer_offers').insert({ ...input, status: 'waiting' });
  if (error) throw new Error(errMsg(error, 'Could not save the offer.'));
}

export async function updateOffer(id: string, patch: Partial<DealerOffer>): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('dealer_offers').update(patch).eq('id', id);
  if (error) throw new Error(errMsg(error, 'Could not update the offer.'));
}

export async function setOfferStatus(id: string, status: 'approved' | 'rejected', reason: string | null): Promise<void> {
  const sb = requireSupabase();
  const patch: any = { status, reject_reason: reason || null };
  if (status === 'approved') patch.approved_at = new Date().toISOString();
  const { error } = await sb.from('dealer_offers').update(patch).eq('id', id);
  if (error) throw new Error(errMsg(error, 'Could not update offer status.'));
}

// ─── Used bikes ─────────────────────────────────────────────────────────────

export type UsedSort = 'newest' | 'price_asc' | 'price_desc' | 'km_asc';

export interface UsedQuery {
  brand_id?: string;
  price_min?: number;
  price_max?: number;
  km_max?: number;
  year_min?: number;
  year_max?: number;
  city?: string;
  state?: string;
  fuel?: string;
  condition?: string;
  verified?: boolean;
  seller_type?: 'dealer' | 'user';
  status?: string | string[];
  user_id?: string;
  search?: string;
  sort?: UsedSort;
  page?: number;
  per_page?: number;
}

export const USED_PUBLIC_SELECT =
  'id, user_id, dealer_id, brand_id, model_name, variant_name, year, price, km_driven, fuel_type, city, state, area, condition_grade, owner_count, registration_number, has_insurance, service_history, accident_history, description, status, is_verified_listing, approved_at, created_at, updated_at, brands ( name ), used_bike_images ( id, storage_path, is_primary, sort_order, bucket ), profiles ( full_name )';

function mapUsed(u: any): UsedBike {
  const imgs = (u.used_bike_images || []) as any[];
  const primary = imgs.find((i) => i.is_primary) || imgs[0];
  const sb = requireSupabase();
  return {
    ...u,
    brand_name: u.brands?.name,
    seller_name: u.profiles?.full_name,
    primary_image_url: primary ? sb.storage.from(primary.bucket || 'used-bike-images').getPublicUrl(primary.storage_path).data.publicUrl : null,
    image_count: imgs.length,
  } as UsedBike;
}

export async function queryUsedBikes(q: UsedQuery): Promise<{ rows: UsedBike[]; count: number }> {
  const sb = requireSupabase();
  let query = sb.from('used_bikes').select(USED_PUBLIC_SELECT, { count: 'exact' });
  if (q.status) query = query.in('status', Array.isArray(q.status) ? q.status as any : [q.status]);
  if (!q.status && !q.user_id) query = query.eq('status', 'approved');
  if (q.brand_id) query = query.eq('brand_id', q.brand_id);
  if (q.price_min) query = query.gte('price', q.price_min);
  if (q.price_max) query = query.lte('price', q.price_max);
  if (q.km_max) query = query.lte('km_driven', q.km_max);
  if (q.year_min) query = query.gte('year', q.year_min);
  if (q.year_max) query = query.lte('year', q.year_max);
  if (q.city) query = query.ilike('city', `%${q.city}%`);
  if (q.state) query = query.eq('state', q.state);
  if (q.fuel) query = query.eq('fuel_type', q.fuel);
  if (q.condition) query = query.eq('condition_grade', q.condition);
  if (q.verified) query = query.eq('is_verified_listing', true);
  if (q.seller_type === 'dealer') query = query.not('dealer_id', 'is', null);
  if (q.seller_type === 'user') query = query.is('dealer_id', null);
  if (q.user_id) query = query.eq('user_id', q.user_id);
  if (q.search) query = query.ilike('model_name', `%${q.search}%`);
  if (q.sort === 'price_asc') query = query.order('price', { ascending: true });
  else if (q.sort === 'price_desc') query = query.order('price', { ascending: false });
  else if (q.sort === 'km_asc') query = query.order('km_driven', { ascending: true, nullsFirst: false });
  else query = query.order('created_at', { ascending: false });
  const page = q.page ?? 1;
  const per = q.per_page ?? 12;
  const { data, error, count } = await query.range((page - 1) * per, page * per - 1);
  if (error) throw new Error(errMsg(error, 'Could not load used bikes.'));
  return { rows: (data || []).map(mapUsed), count: count ?? 0 };
}

export async function getUsedBike(id: string): Promise<UsedBike | null> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('used_bikes')
    .select(`${USED_PUBLIC_SELECT}, used_bike_documents ( id, doc_type, is_verified, storage_path, bucket )`)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(errMsg(error));
  if (!data) return null;
  const row = mapUsed(data);
  row.doc_count = (data.used_bike_documents || []).length;
  return row;
}

export async function getUsedImages(id: string) {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('used_bike_images')
    .select('*')
    .eq('used_bike_id', id)
    .order('is_primary', { ascending: false })
    .order('sort_order');
  if (error) throw new Error(errMsg(error));
  const sbc = requireSupabase();
  return (data || []).map((i: any) => ({
    ...i,
    url: sbc.storage.from(i.bucket || 'used-bike-images').getPublicUrl(i.storage_path).data.publicUrl,
  }));
}

export async function getUsedDocs(id: string): Promise<UsedBikeDocumentRaw[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('used_bike_documents')
    .select('id, used_bike_id, user_id, doc_type, label, bucket, storage_path, mime_type, file_size, is_verified, created_at')
    .eq('used_bike_id', id);
  if (error) throw new Error(errMsg(error));
  return (data || []) as UsedBikeDocumentRaw[];
}

export type UsedBikeDocumentRaw = {
  id: string;
  used_bike_id: string;
  user_id: string;
  doc_type: string;
  label: string | null;
  bucket: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  is_verified: boolean;
  created_at: string;
};

export async function createUsedBike(input: Partial<UsedBike>): Promise<string> {
  const sb = requireSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error('Please log in to post a used bike.');
  const { data, error } = await sb.from('used_bikes').insert({ ...input, user_id: user.id }).select('id').single();
  if (error) throw new Error(errMsg(error, 'Could not save the listing.'));
  return data.id as string;
}

export async function updateUsedBike(id: string, patch: Partial<UsedBike>): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('used_bikes').update(patch).eq('id', id);
  if (error) throw new Error(errMsg(error, 'Could not update the listing.'));
}

export async function deleteUsedBike(id: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('used_bikes').delete().eq('id', id);
  if (error) throw new Error(errMsg(error, 'Could not delete the listing.'));
}

export async function setUsedStatus(id: string, status: string, reason: string | null, verify = false): Promise<void> {
  const sb = requireSupabase();
  const patch: any = { status, reject_reason: reason || null };
  if (status === 'approved') {
    patch.approved_at = new Date().toISOString();
    if (verify) patch.is_verified_listing = true;
  }
  const { error } = await sb.from('used_bikes').update(patch).eq('id', id);
  if (error) throw new Error(errMsg(error, 'Could not update listing status.'));
  if (status === 'approved' && verify) {
    await sb.from('used_bike_documents').update({ is_verified: true }).eq('used_bike_id', id);
  }
}

// ─── Dealers ────────────────────────────────────────────────────────────────

export async function getMyDealer(): Promise<DealerProfile | null> {
  const sb = requireSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data, error } = await sb.from('dealer_profiles').select('*').eq('user_id', user.id).maybeSingle();
  if (error) throw new Error(errMsg(error));
  return (data as DealerProfile) || null;
}

export async function getDealers(q: { status?: string } = {}): Promise<DealerProfile[]> {
  const sb = requireSupabase();
  let query = sb.from('dealer_profiles').select('*').order('created_at', { ascending: false }).limit(200);
  if (q.status) query = query.eq('status', q.status);
  const { data, error } = await query;
  if (error) throw new Error(errMsg(error, 'Could not load dealers.'));
  return (data || []) as DealerProfile[];
}

export async function getDealerById(id: string): Promise<DealerProfile | null> {
  const sb = requireSupabase();
  const { data, error } = await sb.from('dealer_profiles').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(errMsg(error));
  return (data as DealerProfile) || null;
}

export async function getDealerDocs(dealerId: string): Promise<DealerDocument[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.from('dealer_documents').select('*').eq('dealer_id', dealerId);
  if (error) throw new Error(errMsg(error));
  return (data || []) as DealerDocument[];
}

export async function createDealerApplication(input: Partial<DealerProfile>): Promise<void> {
  const sb = requireSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error('Please log in to apply as a dealer.');
  const { error } = await sb.from('dealer_profiles').insert({ ...input, user_id: user.id, status: 'waiting' });
  if (error) throw new Error(errMsg(error, 'Could not submit the dealer application.'));
}

export async function setDealerStatus(id: string, status: 'approved' | 'rejected' | 'suspended', reason: string | null): Promise<void> {
  const sb = requireSupabase();
  const patch: any = { status, reject_reason: reason || null };
  if (status === 'approved') patch.approved_at = new Date().toISOString();
  if (status === 'rejected') patch.rejected_at = new Date().toISOString();
  const { error } = await sb.from('dealer_profiles').update(patch).eq('id', id);
  if (error) throw new Error(errMsg(error, 'Could not update dealer status.'));
}

// ─── Global search ──────────────────────────────────────────────────────────

export async function globalSearch(q: string, limit = 6): Promise<SearchResult> {
  const sb = requireSupabase();
  const like = `%${q}%`;
  const [brands, models, variants, used, dealers] = await Promise.all([
    sb.from('brands').select('*').eq('is_active', true).ilike('name', like).limit(limit),
    sb
      .from('bike_models')
      .select(MODEL_SELECT)
      .eq('is_published', true)
      .ilike('name', like)
      .order('popularity', { ascending: false, nullsFirst: true })
      .limit(limit),
    sb
      .from('bike_variants')
      .select('id, name, bike_model_id, bike_models ( id, name, slug, fuel_type, brands ( slug ) )')
      .ilike('name', like)
      .eq('bike_models.is_published', true)
      .limit(limit),
    sb
      .from('used_bikes')
      .select('id, model_name, year, price, city, state, fuel_type, brands ( name )')
      .eq('status', 'approved')
      .ilike('model_name', like)
      .order('created_at', { ascending: false })
      .limit(limit),
    sb
      .from('dealer_profiles')
      .select('id, dealer_name, business_name, city, state')
      .eq('status', 'approved')
      .or(`dealer_name.ilike.${like},business_name.ilike.${like}`)
      .limit(limit),
  ]);
  if (models.error) throw new Error(errMsg(models.error, 'Search failed.'));
  return {
    brands: (brands.data || []) as Brand[],
    models: ((models.data || []) as any[]).map((m) => ({ ...m, brand_name: m.brands?.name, brand_slug: m.brands?.slug })) as BikeModel[],
    variants: ((variants.data || []) as any[]).map((v) => ({
      id: v.id,
      name: v.name,
      bike_model_id: v.bike_models?.id,
      model_name: v.bike_models?.name,
      brand_name: v.bike_models?.brands?.name,
      brand_slug: v.bike_models?.brands?.slug,
      model_slug: v.bike_models?.slug,
    })),
    used: ((used.data || []) as any[]).map((u) => ({ ...u, brand_name: u.brands?.name })) as UsedBike[],
    dealers: (dealers.data || []) as DealerProfile[],
  };
}

// ─── Favorites ──────────────────────────────────────────────────────────────

export interface FavoritesData {
  bikes: string[];
  used: string[];
  comparisons: string[];
}

export async function getMyFavorites(): Promise<FavoritesData> {
  const sb = requireSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { bikes: [], used: [], comparisons: [] };
  const { data, error } = await sb.from('favorites').select('item_type, item_id').eq('user_id', user.id);
  if (error) throw new Error(errMsg(error));
  const out: FavoritesData = { bikes: [], used: [], comparisons: [] };
  for (const f of data || []) {
    if (f.item_type === 'bike') out.bikes.push(f.item_id);
    else if (f.item_type === 'used_bike') out.used.push(f.item_id);
    else out.comparisons.push(f.item_id);
  }
  return out;
}

export async function toggleFavoriteDb(itemType: 'bike' | 'used_bike' | 'comparison', itemId: string, on: boolean): Promise<void> {
  const sb = requireSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;
  if (on) {
    const { error } = await sb.from('favorites').insert({ user_id: user.id, item_type: itemType, item_id: itemId });
    if (error && !/duplicate/i.test(error.message)) throw new Error(errMsg(error));
  } else {
    const { error } = await sb.from('favorites').delete().eq('user_id', user.id).eq('item_type', itemType).eq('item_id', itemId);
    if (error) throw new Error(errMsg(error));
  }
}

// ─── Enquiries ──────────────────────────────────────────────────────────────

export async function createEnquiry(input: Partial<Enquiry>): Promise<void> {
  const sb = requireSupabase();
  const { data: { user } } = await sb.auth.getUser();
  const row: any = { ...input };
  if (user) row.from_user_id = user.id;
  const { error } = await sb.from('enquiries').insert(row);
  if (error) throw new Error(errMsg(error, 'Could not send the enquiry.'));
}

export async function myEnquiries(): Promise<Enquiry[]> {
  const sb = requireSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return [];
  const [sent, received] = await Promise.all([
    sb.from('enquiries').select('*').eq('from_user_id', user.id).order('created_at', { ascending: false }).limit(50),
    sb.from('enquiries').select('*').eq('to_user_id', user.id).order('created_at', { ascending: false }).limit(50),
  ]);
  if (sent.error) throw new Error(errMsg(sent.error));
  const all = [...(sent.data || []), ...(received.data || [])] as Enquiry[];
  const seen = new Set<string>();
  return all.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
}

export async function listEnquiries(q: { type?: string; status?: string; page?: number } = {}) {
  const sb = requireSupabase();
  let query = sb.from('enquiries').select('*').order('created_at', { ascending: false }).limit(200);
  if (q.type) query = query.eq('type', q.type);
  if (q.status) query = query.eq('status', q.status);
  const { data, error } = await query;
  if (error) throw new Error(errMsg(error, 'Could not load enquiries.'));
  return (data || []) as Enquiry[];
}

export async function setEnquiryStatus(id: string, status: Enquiry['status']): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('enquiries').update({ status }).eq('id', id);
  if (error) throw new Error(errMsg(error));
}

// ─── Reports ────────────────────────────────────────────────────────────────

export async function createReport(input: Partial<Report>): Promise<void> {
  const sb = requireSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error('Please log in to report a listing.');
  const { error } = await sb.from('reports').insert({ ...input, user_id: user.id, status: 'open' });
  if (error) throw new Error(errMsg(error, 'Could not submit the report.'));
}

export async function listReports(q: { status?: string } = {}) {
  const sb = requireSupabase();
  let query = sb.from('reports').select('*, profiles ( email )').order('created_at', { ascending: false }).limit(200);
  if (q.status) query = query.eq('status', q.status);
  const { data, error } = await query;
  if (error) throw new Error(errMsg(error, 'Could not load reports.'));
  return (data || []).map((r: any) => ({ ...r, reporter_name: r.profiles?.email })) as (Report & { profiles?: any })[];
}

export async function setReportStatus(id: string, status: Report['status'], note: string | null): Promise<void> {
  const sb = requireSupabase();
  const { data: { user } } = await sb.auth.getUser();
  const { error } = await sb
    .from('reports')
    .update({ status, resolution_note: note || null, resolved_by: user?.id || null, resolved_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(errMsg(error));
}

// ─── Notifications ──────────────────────────────────────────────────────────

export async function myNotifications(): Promise<AppNotification[]> {
  const sb = requireSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return [];
  const { data, error } = await sb.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
  if (error) throw new Error(errMsg(error));
  return (data || []) as AppNotification[];
}

export async function markNotificationRead(id: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('notifications').update({ is_read: true }).eq('id', id);
  if (error) throw new Error(errMsg(error));
}

export async function markAllNotificationsRead(): Promise<void> {
  const sb = requireSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;
  const { error } = await sb.from('notifications').update({ is_read: true }).eq('user_id', user.id);
  if (error) throw new Error(errMsg(error));
}

// ─── Content: articles, FAQs, settings ─────────────────────────────────────

export async function getArticles(q: { category?: string; publishedOnly?: boolean } = {}) {
  const sb = requireSupabase();
  let query = sb.from('articles').select('*').order('published_at', { ascending: false }).limit(100);
  if (q.category) query = query.eq('category', q.category);
  if (q.publishedOnly !== false) query = query.eq('is_published', true);
  const { data, error } = await query;
  if (error) throw new Error(errMsg(error, 'Could not load articles.'));
  return (data || []) as Article[];
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const sb = requireSupabase();
  const { data, error } = await sb.from('articles').select('*').eq('slug', slug).eq('is_published', true).maybeSingle();
  if (error) throw new Error(errMsg(error));
  return (data as Article) || null;
}

export async function getFaqs(): Promise<Faq[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.from('faqs').select('*').eq('is_active', true).order('sort_order');
  if (error) throw new Error(errMsg(error));
  return (data || []) as Faq[];
}

export async function getSettings(): Promise<Record<string, any>> {
  const sb = requireSupabase();
  const { data, error } = await sb.from('site_settings').select('key, value');
  if (error) throw new Error(errMsg(error));
  const out: Record<string, any> = {};
  for (const row of data || []) out[row.key] = row.value;
  return out;
}

export async function getScoreWeights(): Promise<ScoreWeights> {
  const settings = await getSettings().catch((): Record<string, any> => ({}));
  const w = settings['score_weights'];
  if (!w) return DEFAULT_WEIGHTS;
  return { ...DEFAULT_WEIGHTS, ...w };
}

export async function updateSetting(key: string, value: any): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('site_settings').upsert({ key, value }, { onConflict: 'key' });
  if (error) throw new Error(errMsg(error, 'Could not save the setting.'));
}

// ─── Specs (admin) ──────────────────────────────────────────────────────────

export async function getSpecGroups(): Promise<SpecGroup[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.from('specification_groups').select('*').order('sort_order');
  if (error) throw new Error(errMsg(error));
  return (data || []) as SpecGroup[];
}

export async function getSpecDefinitions(): Promise<SpecDefinition[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('specifications')
    .select('id, group_id, name, slug, unit, data_type, options, is_compare, score_key, sort_order, is_active, specification_groups ( name )')
    .order('sort_order');
  if (error) throw new Error(errMsg(error));
  return (data || []).map((s: any) => ({ ...s, group_name: s.specification_groups?.name })) as SpecDefinition[];
}

export async function saveSpecGroup(name: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('specification_groups').insert({ name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-') });
  if (error) throw new Error(errMsg(error, 'Could not create the group.'));
}

export async function saveSpecDefinition(input: Partial<SpecDefinition>): Promise<void> {
  const sb = requireSupabase();
  const row = { ...input, slug: input.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || null };
  if (input.id) {
    const { error } = await sb.from('specifications').update(row).eq('id', input.id);
    if (error) throw new Error(errMsg(error, 'Could not update the specification.'));
  } else {
    const { error } = await sb.from('specifications').insert(row);
    if (error) throw new Error(errMsg(error, 'Could not create the specification.'));
  }
}

// ─── Admin: models management ───────────────────────────────────────────────

export async function listModelsAdmin(q: { status?: string; search?: string } = {}) {
  const sb = requireSupabase();
  let query = sb.from('bike_models').select(MODEL_SELECT).order('created_at', { ascending: false }).limit(300);
  if (q.status) query = query.eq('status', q.status);
  if (q.search) query = query.ilike('name', `%${q.search}%`);
  const { data, error } = await query;
  if (error) throw new Error(errMsg(error, 'Could not load models.'));
  return (data || []).map((m: any) => ({ ...m, brand_name: m.brands?.name, brand_slug: m.brands?.slug })) as BikeModel[];
}

export async function saveModel(input: Partial<BikeModel>): Promise<string> {
  const sb = requireSupabase();
  const row = { ...input };
  if (row.id) {
    const { error } = await sb.from('bike_models').update(row).eq('id', row.id);
    if (error) throw new Error(errMsg(error, 'Could not save the model.'));
    return row.id;
  }
  const { data, error } = await sb.from('bike_models').insert(row).select('id').single();
  if (error) throw new Error(errMsg(error, 'Could not create the model.'));
  return data.id as string;
}

export async function deleteModel(id: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('bike_models').delete().eq('id', id);
  if (error) throw new Error(errMsg(error, 'Could not delete the model.'));
}

export async function duplicateModel(id: string): Promise<string> {
  const sb = requireSupabase();
  const { data: src, error } = await sb.from('bike_models').select('*').eq('id', id).maybeSingle();
  if (error || !src) throw new Error('Source model not found.');
  const { data: created, error: cErr } = await sb
    .from('bike_models')
    .insert({
      ...src,
      id: undefined,
      name: `${src.name} (Copy)`,
      slug: `${src.slug}-copy-${Date.now().toString(36)}`,
      is_published: false,
    })
    .select('id')
    .single();
  if (cErr) throw new Error(errMsg(cErr, 'Could not duplicate the model.'));
  const newId = created.id as string;
  const [variants, colours, specs, features, pros, cons] = await Promise.all([
    sb.from('bike_variants').select('*').eq('bike_model_id', id),
    sb.from('bike_colours').select('*').eq('bike_model_id', id),
    sb.from('bike_specifications').select('*').eq('bike_model_id', id),
    sb.from('bike_features').select('*').eq('bike_model_id', id),
    sb.from('bike_pros').select('*').eq('bike_model_id', id),
    sb.from('bike_cons').select('*').eq('bike_model_id', id),
  ]);
  if (variants.data?.length) await sb.from('bike_variants').insert(variants.data!.map((v: any) => ({ ...v, id: undefined, bike_model_id: newId })));
  if (colours.data?.length) await sb.from('bike_colours').insert(colours.data!.map((c: any) => ({ ...c, id: undefined, bike_model_id: newId })));
  if (specs.data?.length) await sb.from('bike_specifications').insert(specs.data!.map((s: any) => ({ ...s, id: undefined, bike_model_id: newId, variant_id: null })));
  if (features.data?.length) await sb.from('bike_features').insert(features.data!.map((f: any) => ({ ...f, id: undefined, bike_model_id: newId, variant_id: null })));
  if (pros.data?.length) await sb.from('bike_pros').insert(pros.data!.map((p: any) => ({ ...p, id: undefined, bike_model_id: newId })));
  if (cons.data?.length) await sb.from('bike_cons').insert(cons.data!.map((c: any) => ({ ...c, id: undefined, bike_model_id: newId })));
  return newId;
}

export async function saveVariant(input: Partial<BikeVariant>): Promise<void> {
  const sb = requireSupabase();
  const row = { ...input, slug: input.name ? input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : input.slug };
  if (input.id) {
    const { error } = await sb.from('bike_variants').update(row).eq('id', input.id);
    if (error) throw new Error(errMsg(error, 'Could not save the variant.'));
  } else {
    const { error } = await sb.from('bike_variants').insert(row);
    if (error) throw new Error(errMsg(error, 'Could not add the variant.'));
  }
}

export async function deleteVariant(id: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('bike_variants').delete().eq('id', id);
  if (error) throw new Error(errMsg(error));
}

export async function saveColour(input: Partial<BikeColour>): Promise<void> {
  const sb = requireSupabase();
  if (input.id) {
    const { error } = await sb.from('bike_colours').update(input).eq('id', input.id);
    if (error) throw new Error(errMsg(error, 'Could not save the colour.'));
  } else {
    const { error } = await sb.from('bike_colours').insert(input);
    if (error) throw new Error(errMsg(error, 'Could not add the colour.'));
  }
}

export async function deleteColour(id: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('bike_colours').delete().eq('id', id);
  if (error) throw new Error(errMsg(error));
}

export async function saveImageRow(input: Partial<BikeImage>): Promise<void> {
  const sb = requireSupabase();
  if (input.id) {
    const { error } = await sb.from('bike_images').update(input).eq('id', input.id);
    if (error) throw new Error(errMsg(error, 'Could not save the image record.'));
  } else {
    const { error } = await sb.from('bike_images').insert(input);
    if (error) throw new Error(errMsg(error, 'Could not add the image record.'));
  }
}

export async function deleteImageRow(id: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('bike_images').delete().eq('id', id);
  if (error) throw new Error(errMsg(error));
}

export async function reorderImages(modelId: string, orderedIds: string[]): Promise<void> {
  const sb = requireSupabase();
  for (let i = 0; i < orderedIds.length; i++) {
    await sb.from('bike_images').update({ sort_order: i, is_primary: i === 0 }).eq('id', orderedIds[i]).eq('bike_model_id', modelId);
  }
}

export async function setSpecValue(modelId: string, specId: string, values: { value_text?: string; value_numeric?: number | null; value_boolean?: boolean | null }, variantId: string | null = null): Promise<void> {
  const sb = requireSupabase();
  const { data: existing, error: fErr } = await sb
    .from('bike_specifications')
    .select('id')
    .eq('bike_model_id', modelId)
    .eq('specification_id', specId)
    .is('variant_id', null)
    .maybeSingle();
  if (fErr) throw new Error(errMsg(fErr));
  if (existing) {
    const { error } = await sb.from('bike_specifications').update(values).eq('id', existing.id);
    if (error) throw new Error(errMsg(error, 'Could not save the specification.'));
  } else {
    const { error } = await sb.from('bike_specifications').insert({ bike_model_id: modelId, specification_id: specId, variant_id: variantId, ...values });
    if (error) throw new Error(errMsg(error, 'Could not save the specification.'));
  }
}

export async function deleteSpecValue(id: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('bike_specifications').delete().eq('id', id);
  if (error) throw new Error(errMsg(error));
}

export async function setProsCons(modelId: string, kind: 'pros' | 'cons', texts: string[]): Promise<void> {
  const sb = requireSupabase();
  const table = kind === 'pros' ? 'bike_pros' : 'bike_cons';
  await sb.from(table).delete().eq('bike_model_id', modelId);
  if (texts.length) {
    const rows = texts.map((t, i) => ({ bike_model_id: modelId, text: t, sort_order: i }));
    const { error } = await sb.from(table).insert(rows);
    if (error) throw new Error(errMsg(error, 'Could not save pros/cons.'));
  }
}

export async function setFeatures(modelId: string, rows: { name: string; included: boolean }[]): Promise<void> {
  const sb = requireSupabase();
  await sb.from('bike_features').delete().eq('bike_model_id', modelId).is('variant_id', null);
  if (rows.length) {
    const insertRows = rows.map((r, i) => ({ bike_model_id: modelId, variant_id: null, name: r.name, included: r.included, sort_order: i }));
    const { error } = await sb.from('bike_features').insert(insertRows);
    if (error) throw new Error(errMsg(error, 'Could not save features.'));
  }
}

// ─── Admin: stats & logs ────────────────────────────────────────────────────

export interface AdminStats {
  users: number;
  dealers_total: number;
  dealers_waiting: number;
  dealers_approved: number;
  models_total: number;
  models_live: number;
  models_upcoming: number;
  models_outdated: number;
  used_total: number;
  used_pending: number;
  used_approved: number;
  offers_pending: number;
  offers_approved: number;
  reports_open: number;
  enquiries_total: number;
}

export async function getAdminStats(): Promise<AdminStats> {
  const sb = requireSupabase();
  const cnt = (table: string, filter?: (q: any) => any) => {
    let q = sb.from(table).select('id', { count: 'exact', head: true });
    if (filter) q = filter(q);
    return q;
  };
  const [users, dealers, dealersW, dealersA, models, live, up, out, used, usedP, usedA, offersP, offersA, reports, enquiries] = await Promise.all([
    cnt('profiles'),
    cnt('dealer_profiles'),
    cnt('dealer_profiles', (q) => q.eq('status', 'waiting')),
    cnt('dealer_profiles', (q) => q.eq('status', 'approved')),
    cnt('bike_models'),
    cnt('bike_models', (q) => q.eq('status', 'live')),
    cnt('bike_models', (q) => q.eq('status', 'upcoming')),
    cnt('bike_models', (q) => q.eq('status', 'outdated')),
    cnt('used_bikes'),
    cnt('used_bikes', (q) => q.in('status', ['submitted', 'waiting_approval', 'changes_required'])),
    cnt('used_bikes', (q) => q.eq('status', 'approved')),
    cnt('dealer_offers', (q) => q.eq('status', 'waiting')),
    cnt('dealer_offers', (q) => q.eq('status', 'approved')),
    cnt('reports', (q) => q.eq('status', 'open')),
    cnt('enquiries'),
  ]);
  const pick = (r: any) => r.count ?? 0;
  return {
    users: pick(users),
    dealers_total: pick(dealers),
    dealers_waiting: pick(dealersW),
    dealers_approved: pick(dealersA),
    models_total: pick(models),
    models_live: pick(live),
    models_upcoming: pick(up),
    models_outdated: pick(out),
    used_total: pick(used),
    used_pending: pick(usedP),
    used_approved: pick(usedA),
    offers_pending: pick(offersP),
    offers_approved: pick(offersA),
    reports_open: pick(reports),
    enquiries_total: pick(enquiries),
  };
}

export async function getAdminLogs(q: { record_type?: string; action?: string; page?: number } = {}) {
  const sb = requireSupabase();
  let query = sb
    .from('admin_logs')
    .select('id, admin_id, action, record_type, record_id, previous_data, new_data, meta, created_at, profiles ( email )')
    .order('created_at', { ascending: false });
  if (q.record_type) query = query.eq('record_type', q.record_type);
  if (q.action) query = query.eq('action', q.action);
  const page = q.page ?? 1;
  const { data, error } = await query.range((page - 1) * 25, page * 25 - 1);
  if (error) throw new Error(errMsg(error, 'Could not load the audit log.'));
  return (data || []).map((l: any) => ({ ...l, admin_email: l.profiles?.email })) as any[];
}

// ─── Storage helpers ────────────────────────────────────────────────────────

export function publicImageUrl(bucket: string, path: string | null): string | null {
  if (!path) return null;
  const sb = requireSupabase();
  return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export async function signedImageUrl(bucket: string, path: string, expiresIn = 600): Promise<string | null> {
  const sb = requireSupabase();
  const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) return null;
  return data.signedUrl;
}

export async function deleteStorageObject(bucket: string, path: string): Promise<void> {
  const sb = requireSupabase();
  await sb.storage.from(bucket).remove([path]).catch(() => null);
}

// ─── Image processing ───────────────────────────────────────────────────────

/** Ask the image-process Edge Function to process a bike image asynchronously. */
export async function triggerImageProcessing(imageId: string): Promise<void> {
  const sb = requireSupabase();
  await sb.functions.invoke('image-process', { body: { image_id: imageId } }).catch(() => {
    // Function not deployed or temporarily unavailable — the original image
    // remains fully usable, so this never blocks the listing.
  });
}

// ─── Articles / FAQs admin CRUD ─────────────────────────────────────────────

export async function saveArticle(input: Partial<Article>): Promise<void> {
  const sb = requireSupabase();
  const row = { ...input, slug: input.slug || (input.title ? input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') : undefined) };
  if (input.id) {
    const { error } = await sb.from('articles').update(row).eq('id', input.id);
    if (error) throw new Error(errMsg(error, 'Could not save the article.'));
  } else {
    const { error } = await sb.from('articles').insert(row);
    if (error) throw new Error(errMsg(error, 'Could not create the article.'));
  }
}

export async function deleteArticle(id: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('articles').delete().eq('id', id);
  if (error) throw new Error(errMsg(error));
}

export async function saveFaq(input: Partial<Faq>): Promise<void> {
  const sb = requireSupabase();
  if (input.id) {
    const { error } = await sb.from('faqs').update(input).eq('id', input.id);
    if (error) throw new Error(errMsg(error, 'Could not save the FAQ.'));
  } else {
    const { error } = await sb.from('faqs').insert(input);
    if (error) throw new Error(errMsg(error, 'Could not add the FAQ.'));
  }
}

export async function deleteFaq(id: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('faqs').delete().eq('id', id);
  if (error) throw new Error(errMsg(error));
}

// ─── Profile ────────────────────────────────────────────────────────────────

export async function getMyProfile() {
  const sb = requireSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data, error } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (error) throw new Error(errMsg(error));
  return (data as import('./types').Profile) || null;
}

export async function updateMyProfile(patch: { full_name?: string; phone?: string | null }): Promise<void> {
  const sb = requireSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error('Not signed in.');
  const { error } = await sb.from('profiles').update(patch).eq('id', user.id);
  if (error) throw new Error(errMsg(error, 'Could not update your profile.'));
}

// ─── Admin helpers: reviews, reports, enquiries, SEO pages, settings ──────

export async function queryReviews(q: { status?: Review['status'] } = {}): Promise<{ rows: Review[]; count: number }> {
  const sb = requireSupabase();
  let query = sb.from('reviews').select('*, profiles ( full_name, email ), bike_models ( name, brand_slug, slug, brand_id, brands ( name, slug ) )').order('created_at', { ascending: false }).limit(300);
  if (q.status) query = query.eq('status', q.status);
  const { data, error } = await query;
  if (error) throw new Error(errMsg(error, 'Could not load reviews.'));
  const rows = ((data || []) as any[]).map((r) => ({ ...r, bike_name: r.bike_models?.name, bike_brand_name: r.bike_models?.brands?.[0]?.name || r.bike_models?.brands?.name, user_name: r.profiles?.full_name || r.profiles?.email || null, profiles: undefined, bike_models: undefined })) as Review[];
  return { rows, count: rows.length };
}

export async function setReviewStatus(id: string, status: Review['status']): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('reviews').update({ status, approved_at: status === 'approved' ? new Date().toISOString() : null }).eq('id', id);
  if (error) throw new Error(errMsg(error));
}

export async function deleteReview(id: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('reviews').delete().eq('id', id);
  if (error) throw new Error(errMsg(error));
}

export async function queryReports(q: { status?: string } = {}): Promise<{ rows: (Report & { reporter_name?: string | null })[]; count: number }> {
  const rows = await listReports(q);
  return { rows, count: rows.length };
}

export async function queryEnquiries(q: { type?: string; status?: string } = {}): Promise<{ rows: Enquiry[]; count: number }> {
  const rows = await listEnquiries(q);
  return { rows, count: rows.length };
}

// ─── SEO pages (legal & static content) ─────────────────────────────────────

export interface SeoPageRow {
  id: string;
  slug: string;
  title: string;
  meta_title: string | null;
  meta_description: string | null;
  body: string;
  updated_at: string;
}

export async function getSeoPages(): Promise<SeoPageRow[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.from('seo_pages').select('*').order('slug');
  if (error) throw new Error(errMsg(error, 'Could not load SEO pages.'));
  return (data || []) as SeoPageRow[];
}

export async function saveSeoPage(input: Partial<SeoPageRow>): Promise<void> {
  const sb = requireSupabase();
  const { error } = input.id
    ? await sb.from('seo_pages').update(input).eq('id', input.id)
    : await sb.from('seo_pages').insert({ ...input, updated_at: new Date().toISOString() });
  if (error) throw new Error(errMsg(error, 'Could not save the SEO page.'));
}

export async function deleteRow(table: 'articles' | 'faqs' | 'seo_pages', id: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from(table).delete().eq('id', id);
  if (error) throw new Error(errMsg(error, 'Could not delete the record.'));
}

// ─── Setting helpers (single key) ───────────────────────────────────────────

export async function getSetting(key: string): Promise<any> {
  const all = await getSettings();
  return all[key] ?? null;
}

export async function saveSetting(key: string, value: any): Promise<void> {
  await updateSetting(key, value);
}

export async function saveScoreWeights(weights: ScoreWeights): Promise<void> {
  await updateSetting('score_weights', weights);
}
