/** Default admin-editable settings. Shared by the app and CLI scripts (no server-only import). */
export type SettingsMap = Record<string, string | null>;

export const DEFAULT_SETTINGS: Record<string, { value: string; type: string; group: string; label: string; help?: string }> = {
  site_title: { value: 'Bikepick.IN', type: 'string', group: 'brand', label: 'Site title' },
  site_tagline: { value: 'Compare Smart. Buy Better.', type: 'string', group: 'brand', label: 'Tagline' },
  site_logo_text: { value: 'bikepick', type: 'string', group: 'brand', label: 'Logo wordmark' },
  brand_color: { value: '#F0620C', type: 'string', group: 'brand', label: 'Primary colour' },
  accent_color: { value: '#00B27A', type: 'string', group: 'brand', label: 'Accent colour' },
  contact_email: { value: 'bikepick@outlook.com', type: 'string', group: 'general', label: 'Contact email' },
  owner_email: {
    value: 'bikepick@outlook.com',
    type: 'string',
    group: 'notifications',
    label: 'Owner email — receives a copy of every site event (dealer applications, new listings, leads, contact messages)',
    help: 'Every site event is emailed here in addition to in-app notifications.',
  },
  grievance_officer: { value: 'Grievance Officer, Bikepick.IN', type: 'string', group: 'general', label: 'Grievance officer' },
  show_category_chooser: { value: '1', type: 'bool', group: 'homepage', label: 'Show first-visit category chooser' },
  homepage_sections: {
    value: JSON.stringify(['popular_comparisons', 'trending_bikes', 'popular_evs', 'dealer_offers', 'price_drops', 'used_bikes', 'guides']),
    type: 'json', group: 'homepage', label: 'Homepage sections (order)',
  },
  score_weights: {
    value: JSON.stringify({ value: 20, features: 15, performance: 15, safety: 15, running_cost: 15, comfort: 10, maintenance: 10 }),
    type: 'json', group: 'scoring', label: 'Bikepick Score weights (%)',
    help: 'Must total 100. Paid placements never affect this score.',
  },
  trust_weights: {
    value: JSON.stringify({ seller_verified: 20, rc_checked: 20, insurance_checked: 12, service_history: 12, inspection: 20, photos_complete: 8, info_complete: 8 }),
    type: 'json', group: 'scoring', label: 'Used-bike Trust Score weights',
  },
  ads_enabled: { value: '0', type: 'bool', group: 'ads', label: 'Enable AdSense slots globally' },
  adsense_client_id: { value: '', type: 'string', group: 'ads', label: 'AdSense client ID (ca-pub-...)' },
  affiliate_disclosure: {
    value: 'Some links on Bikepick.IN are affiliate links. If you buy through them we may earn a commission at no extra cost to you. This never influences our comparisons or scores.',
    type: 'text', group: 'monetisation', label: 'Affiliate disclosure text',
  },
  petrol_price_default: { value: '104.5', type: 'number', group: 'calculators', label: 'Default petrol price (₹/L)' },
  electricity_price_default: { value: '8', type: 'number', group: 'calculators', label: 'Default electricity tariff (₹/unit)' },
  charging_efficiency_default: { value: '85', type: 'number', group: 'calculators', label: 'Default charging efficiency (%)' },
  used_bike_require_inspection: { value: '0', type: 'bool', group: 'verification', label: 'Require inspection before approval' },
  used_bike_min_photos: { value: '5', type: 'number', group: 'verification', label: 'Minimum photos for a used listing' },
  lead_price_default: { value: '49', type: 'number', group: 'revenue', label: 'Default dealer lead price (₹)' },
  inspection_fee_default: { value: '999', type: 'number', group: 'revenue', label: 'Used-bike inspection fee (₹)', help: 'Set to 0 to show “Request a quote” instead of a price.' },
  featured_listing_price: { value: '499', type: 'number', group: 'revenue', label: 'Featured used-listing price (₹)' },
  offer_auto_expiry_days: { value: '30', type: 'number', group: 'dealers', label: 'Auto-expire dealer offers after (days)', help: 'Applies when a dealer does not set an end date.' },
  dealer_auto_approve_offers: { value: '0', type: 'bool', group: 'dealers', label: 'Auto-approve offers from verified dealers' },
  used_bike_listing_expiry_days: { value: '60', type: 'number', group: 'verification', label: 'Auto-expire used listings after (days)' },
  maintenance_mode: { value: '0', type: 'bool', group: 'general', label: 'Maintenance mode (public site read-only notice)' },
  seo_default_title: { value: 'Bikepick.IN — Compare Smart. Buy Better.', type: 'string', group: 'seo', label: 'Default SEO title' },
  seo_default_description: {
    value: 'Compare bikes, electric scooters and used bikes in India with structured specifications, verified dealer offers, running-cost maths and transparent scoring.',
    type: 'text', group: 'seo', label: 'Default meta description',
  },
  notifications_email_enabled: { value: '0', type: 'bool', group: 'notifications', label: 'Send email notifications' },
  notifications_sms_enabled: { value: '0', type: 'bool', group: 'notifications', label: 'Send SMS/WhatsApp notifications' },
  affiliate_tags: {
    value: '{}', type: 'json', group: 'monetisation', label: 'Affiliate tracking tags',
    help: 'Your affiliate IDs per retailer, e.g. {"amazon":{"param":"tag","value":"yourid-21"}}. Applied automatically to outbound links.',
  },
  ai_assistant_enabled: { value: '0', type: 'bool', group: 'ai', label: 'Enable Bikepick AI assistant' },
};
