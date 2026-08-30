/**
 * Demo seed data for Bikepick.IN
 * ------------------------------
 * IMPORTANT: every row created here is flagged `is_demo = 1` and rendered in
 * the UI with a "Demo data" badge. Prices are ILLUSTRATIVE placeholders for
 * layout and workflow testing — they are not live market prices, and the
 * product pages state this explicitly. Replace with authorised feeds or admin
 * CSV imports before going live (see docs/DATA-SOURCES.md).
 */
import crypto from 'node:crypto';
import { config } from 'dotenv';
import { db, insert, nowIso, uid } from '../lib/db';
import { normalizeKey, slugify } from '../lib/slug';
import { computeScore, DEFAULT_WEIGHTS } from '../lib/score';
import { computeTrust } from '../lib/trust';
import { estimateUsedPrice, judgeAskingPrice } from '../lib/calculators';
import { DEFAULT_SETTINGS } from '../lib/settings-defaults';

config({ path: '.env.local' });
config({ path: '.env' });

const hash = (pw: string) => {
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt$${salt}$${crypto.scryptSync(pw, salt, 64).toString('hex')}`;
};

type Bike = {
  brand: string; model: string; body: string; year: number; price: number; art: string;
  specs: Record<string, any>; pros: string[]; cons: string[]; bestFor: string;
  variants: { name: string; price: number }[];
};

const PETROL: Bike[] = [
  { brand: 'Honda', model: 'Shine 125', body: 'commuter', year: 2025, price: 84000, art: 'commuter',
    specs: { engine_type: 'Air-cooled, 4-stroke, SI engine', engine_capacity_cc: 123.94, max_power_bhp: 10.59, max_power_rpm: 7500, max_torque_nm: 11, max_torque_rpm: 6000, transmission: '5-speed', clutch: 'Wet multi-plate', gearbox: 'Constant mesh', top_speed_kmph: 100, mileage_kmpl: 55, fuel_tank_l: 10.5, length_mm: 2019, width_mm: 754, height_mm: 1103, wheelbase_mm: 1285, seat_height_mm: 791, ground_clearance_mm: 162, kerb_weight_kg: 114, front_tyre: '80/100-18', rear_tyre: '80/100-18', front_brake: 'Disc', rear_brake: 'Drum', abs_type: '', cbs: 1, suspension_front: 'Telescopic', suspension_rear: 'Twin shock', wheel_type: 'Alloy', headlight: 'LED', tail_light: 'LED', drl: 1, instrument_cluster: 'Semi-digital', usb_charging: 0, warranty: '3 years / 36,000 km', service_interval_km: 6000, est_service_cost: 550, colours: 'Black, Grey, Blue, Red' },
    pros: ['Outstanding real-world fuel economy', 'Light and easy in traffic', 'Very low service costs'],
    cons: ['No ABS option', 'Basic suspension over broken roads'],
    bestFor: 'Daily city commuting on a tight running budget',
    variants: [{ name: 'Drum', price: 84000 }, { name: 'Disc', price: 88500 }] },

  { brand: 'Hero', model: 'Splendor Plus', body: 'commuter', year: 2025, price: 79000, art: 'commuter',
    specs: { engine_type: 'Air-cooled, 4-stroke, OHC', engine_capacity_cc: 97.2, max_power_bhp: 7.91, max_power_rpm: 8000, max_torque_nm: 8.05, max_torque_rpm: 6000, transmission: '4-speed', clutch: 'Wet multi-plate', top_speed_kmph: 87, mileage_kmpl: 60, fuel_tank_l: 9.8, wheelbase_mm: 1236, seat_height_mm: 785, ground_clearance_mm: 165, kerb_weight_kg: 112, front_tyre: '80/100-18', rear_tyre: '80/100-18', front_brake: 'Drum', rear_brake: 'Drum', cbs: 1, suspension_front: 'Telescopic', suspension_rear: 'Twin shock', wheel_type: 'Alloy', headlight: 'Halogen', drl: 1, instrument_cluster: 'Analogue', warranty: '5 years', service_interval_km: 6000, est_service_cost: 480, colours: 'Black, Blue, Red' },
    pros: ['Cheapest running cost in the range', 'Parts available in every town', 'Excellent resale'],
    cons: ['Only 4 gears', 'Drum brakes on the base variant'],
    bestFor: 'First-time buyers and rural/semi-urban use',
    variants: [{ name: 'Kick Drum', price: 79000 }, { name: 'Self Drum', price: 83000 }] },

  { brand: 'Bajaj', model: 'Pulsar N160', body: 'street', year: 2025, price: 128000, art: 'street',
    specs: { engine_type: 'Oil-cooled, 4-valve, SOHC', engine_capacity_cc: 164.82, max_power_bhp: 15.68, max_power_rpm: 8750, max_torque_nm: 14.65, max_torque_rpm: 6750, transmission: '5-speed', clutch: 'Assist & slipper', top_speed_kmph: 118, mileage_kmpl: 45, fuel_tank_l: 14, wheelbase_mm: 1358, seat_height_mm: 795, ground_clearance_mm: 165, kerb_weight_kg: 152, front_tyre: '100/80-17', rear_tyre: '130/70-17', front_brake: 'Disc', rear_brake: 'Disc', abs_type: 'Dual channel', suspension_front: 'Telescopic', suspension_rear: 'Monoshock', wheel_type: 'Alloy', headlight: 'LED', drl: 1, instrument_cluster: 'Semi-digital', bluetooth: 1, navigation: 0, usb_charging: 1, warranty: '2 years', service_interval_km: 5000, est_service_cost: 850, colours: 'Racing Red, Brooklyn Black, Caribbean Blue' },
    pros: ['Dual-channel ABS at this price', 'Wide rear tyre and monoshock', 'Strong mid-range pull'],
    cons: ['Heavier than 150cc rivals', 'Vibrations at high revs'],
    bestFor: 'Riders who want sporty commuting with real braking hardware',
    variants: [{ name: 'Single ABS', price: 122000 }, { name: 'Dual ABS', price: 128000 }] },

  { brand: 'TVS', model: 'Apache RTR 160 4V', body: 'street', year: 2025, price: 131000, art: 'street',
    specs: { engine_type: 'Oil-cooled, 4-valve', engine_capacity_cc: 159.7, max_power_bhp: 17.55, max_power_rpm: 9250, max_torque_nm: 14.73, max_torque_rpm: 7250, transmission: '5-speed', clutch: 'Assist & slipper', top_speed_kmph: 120, mileage_kmpl: 45, fuel_tank_l: 12, wheelbase_mm: 1357, seat_height_mm: 800, ground_clearance_mm: 180, kerb_weight_kg: 147, front_tyre: '90/90-17', rear_tyre: '130/70-17', front_brake: 'Disc', rear_brake: 'Disc', abs_type: 'Single channel', suspension_front: 'Telescopic', suspension_rear: 'Monoshock', wheel_type: 'Alloy', headlight: 'LED', drl: 1, instrument_cluster: 'Digital', bluetooth: 1, navigation: 1, usb_charging: 0, ride_modes: 'Sport, Urban, Rain', warranty: '2 years / 30,000 km', service_interval_km: 5000, est_service_cost: 900, colours: 'Pearl White, Matte Black, Racing Red' },
    pros: ['Three ride modes with real mapping changes', 'Best-in-class power for 160cc', 'Bluetooth cluster with navigation'],
    cons: ['Single-channel ABS only', 'Firm ride on bad roads'],
    bestFor: 'Enthusiasts wanting performance without a big bike budget',
    variants: [{ name: 'Drum', price: 122000 }, { name: 'Disc', price: 131000 }] },

  { brand: 'Yamaha', model: 'MT-15 V2', body: 'street', year: 2025, price: 169000, art: 'street',
    specs: { engine_type: 'Liquid-cooled, SOHC, 4-valve, VVA', engine_capacity_cc: 155, max_power_bhp: 18.1, max_power_rpm: 10000, max_torque_nm: 14.1, max_torque_rpm: 7500, transmission: '6-speed', clutch: 'Assist & slipper', top_speed_kmph: 131, mileage_kmpl: 45, fuel_tank_l: 10, wheelbase_mm: 1325, seat_height_mm: 810, ground_clearance_mm: 170, kerb_weight_kg: 141, front_tyre: '100/80-17', rear_tyre: '140/70-17', front_brake: 'Disc', rear_brake: 'Disc', abs_type: 'Dual channel', suspension_front: 'Upside down forks', suspension_rear: 'Monoshock', wheel_type: 'Alloy', headlight: 'LED', drl: 1, instrument_cluster: 'Digital LCD', bluetooth: 1, navigation: 0, usb_charging: 0, warranty: '2 years', service_interval_km: 5000, est_service_cost: 950, colours: 'Cyan Storm, Metallic Black, Ice Fluo' },
    pros: ['USD forks and dual-channel ABS', 'Liquid-cooled VVA engine revs cleanly', 'Lightest in class at 141 kg'],
    cons: ['Small 10-litre tank', 'Tall 810 mm seat for shorter riders'],
    bestFor: 'Sporty riders who value handling over outright comfort',
    variants: [{ name: 'Standard', price: 169000 }] },

  { brand: 'Honda', model: 'SP125', body: 'commuter', year: 2025, price: 92000, art: 'commuter',
    specs: { engine_type: 'Air-cooled, eSP, 4-stroke', engine_capacity_cc: 123.94, max_power_bhp: 10.72, max_power_rpm: 7500, max_torque_nm: 10.9, max_torque_rpm: 6000, transmission: '5-speed', top_speed_kmph: 100, mileage_kmpl: 60, fuel_tank_l: 11.2, wheelbase_mm: 1285, seat_height_mm: 790, ground_clearance_mm: 160, kerb_weight_kg: 117, front_tyre: '80/100-18', rear_tyre: '80/100-18', front_brake: 'Disc', rear_brake: 'Drum', cbs: 1, suspension_front: 'Telescopic', suspension_rear: 'Twin shock', wheel_type: 'Alloy', headlight: 'LED', drl: 1, instrument_cluster: 'Digital', warranty: '3 years', service_interval_km: 6000, est_service_cost: 600, colours: 'Black, Blue, Grey' },
    pros: ['Silent start with ACG starter', 'Fully digital cluster', 'Very refined engine'],
    cons: ['Rear drum brake only', 'No ABS'],
    bestFor: 'Commuters who want refinement over outright value',
    variants: [{ name: 'Drum', price: 88000 }, { name: 'Disc', price: 92000 }] },

  { brand: 'Royal Enfield', model: 'Classic 350', body: 'cruiser', year: 2025, price: 199000, art: 'cruiser',
    specs: { engine_type: 'Air-oil cooled, single cylinder, J-series', engine_capacity_cc: 349, max_power_bhp: 20.2, max_power_rpm: 6100, max_torque_nm: 27, max_torque_rpm: 4000, transmission: '5-speed', top_speed_kmph: 115, mileage_kmpl: 35, fuel_tank_l: 13, wheelbase_mm: 1390, seat_height_mm: 805, ground_clearance_mm: 170, kerb_weight_kg: 195, front_tyre: '100/90-19', rear_tyre: '120/80-18', front_brake: 'Disc', rear_brake: 'Disc', abs_type: 'Dual channel', suspension_front: 'Telescopic', suspension_rear: 'Twin shock', wheel_type: 'Spoke / Alloy', headlight: 'Halogen', drl: 0, instrument_cluster: 'Analogue with LCD', usb_charging: 1, navigation: 1, warranty: '3 years / unlimited km', service_interval_km: 5000, est_service_cost: 1600, colours: 'Redditch, Halcyon, Signals, Chrome' },
    pros: ['Effortless torque from low revs', 'Genuine long-distance comfort', 'Huge accessory ecosystem'],
    cons: ['Heavy at 195 kg in city traffic', 'Mileage around 35 kmpl'],
    bestFor: 'Relaxed highway cruising and weekend touring',
    variants: [{ name: 'Redditch', price: 199000 }, { name: 'Halcyon', price: 207000 }, { name: 'Chrome', price: 227000 }] },

  { brand: 'Royal Enfield', model: 'Hunter 350', body: 'street', year: 2025, price: 175000, art: 'street',
    specs: { engine_type: 'Air-oil cooled, J-series', engine_capacity_cc: 349, max_power_bhp: 20.2, max_power_rpm: 6100, max_torque_nm: 27, max_torque_rpm: 4000, transmission: '5-speed', top_speed_kmph: 114, mileage_kmpl: 36, fuel_tank_l: 13, wheelbase_mm: 1370, seat_height_mm: 790, ground_clearance_mm: 150, kerb_weight_kg: 181, front_tyre: '110/70-17', rear_tyre: '140/70-17', front_brake: 'Disc', rear_brake: 'Disc', abs_type: 'Dual channel', suspension_front: 'Telescopic', suspension_rear: 'Twin shock', wheel_type: 'Alloy', headlight: 'Halogen', instrument_cluster: 'Semi-digital', usb_charging: 1, warranty: '3 years', service_interval_km: 5000, est_service_cost: 1500, colours: 'Rebel Black, Dapper Grey, Factory Silver' },
    pros: ['Most agile Royal Enfield in the city', '17-inch wheels with wide tyres', 'Approachable 790 mm seat'],
    cons: ['Low 150 mm ground clearance', 'Firm rear suspension'],
    bestFor: 'City riders who want RE character without the bulk',
    variants: [{ name: 'Retro', price: 175000 }, { name: 'Metro', price: 185000 }] },

  { brand: 'Bajaj', model: 'Pulsar NS200', body: 'street', year: 2025, price: 158000, art: 'sport',
    specs: { engine_type: 'Liquid-cooled, 4-valve, triple spark', engine_capacity_cc: 199.5, max_power_bhp: 24.13, max_power_rpm: 9750, max_torque_nm: 18.74, max_torque_rpm: 8000, transmission: '6-speed', clutch: 'Assist & slipper', top_speed_kmph: 136, mileage_kmpl: 38, fuel_tank_l: 12, wheelbase_mm: 1363, seat_height_mm: 805, ground_clearance_mm: 168, kerb_weight_kg: 158, front_tyre: '100/80-17', rear_tyre: '130/70-17', front_brake: 'Disc', rear_brake: 'Disc', abs_type: 'Dual channel', suspension_front: 'Telescopic', suspension_rear: 'Monoshock', wheel_type: 'Alloy', headlight: 'LED', drl: 1, instrument_cluster: 'Semi-digital', bluetooth: 1, usb_charging: 1, warranty: '2 years', service_interval_km: 5000, est_service_cost: 1100, colours: 'Pewter Grey, Burnt Red, Metallic Pearl White' },
    pros: ['24 bhp liquid-cooled engine', 'Perimeter frame handles well', 'Dual-channel ABS standard'],
    cons: ['Mileage drops quickly when ridden hard', 'Tall seat'],
    bestFor: 'Budget performance riding and occasional track days',
    variants: [{ name: 'Standard', price: 158000 }] },

  { brand: 'Honda', model: 'CB200X', body: 'adventure', year: 2025, price: 152000, art: 'adventure',
    specs: { engine_type: 'Oil-cooled, 4-valve', engine_capacity_cc: 184.4, max_power_bhp: 17.03, max_power_rpm: 8500, max_torque_nm: 15.9, max_torque_rpm: 6000, transmission: '5-speed', top_speed_kmph: 122, mileage_kmpl: 42, fuel_tank_l: 12, wheelbase_mm: 1355, seat_height_mm: 810, ground_clearance_mm: 167, kerb_weight_kg: 147, front_tyre: '100/80-17', rear_tyre: '130/70-17', front_brake: 'Disc', rear_brake: 'Disc', abs_type: 'Single channel', suspension_front: 'Telescopic', suspension_rear: 'Monoshock', wheel_type: 'Alloy', headlight: 'LED', drl: 1, instrument_cluster: 'Digital', usb_charging: 1, warranty: '3 years', service_interval_km: 6000, est_service_cost: 950, colours: 'Pearl Nightstar Black, Sports Red' },
    pros: ['Upright adventure-style ergonomics', 'Honda refinement and service network', 'Comfortable for two'],
    cons: ['Road-biased tyres, not a true off-roader', 'Single-channel ABS'],
    bestFor: 'Comfortable commuting with weekend highway runs',
    variants: [{ name: 'Standard', price: 152000 }] },

  { brand: 'Suzuki', model: 'Gixxer SF 250', body: 'sport', year: 2025, price: 213000, art: 'sport',
    specs: { engine_type: 'Oil-cooled, SOHC', engine_capacity_cc: 249, max_power_bhp: 26.13, max_power_rpm: 9300, max_torque_nm: 22.2, max_torque_rpm: 7300, transmission: '6-speed', clutch: 'Assist & slipper', top_speed_kmph: 140, mileage_kmpl: 38, fuel_tank_l: 12, wheelbase_mm: 1345, seat_height_mm: 800, ground_clearance_mm: 165, kerb_weight_kg: 161, front_tyre: '110/70-17', rear_tyre: '150/60-17', front_brake: 'Disc', rear_brake: 'Disc', abs_type: 'Dual channel', suspension_front: 'Telescopic', suspension_rear: 'Monoshock', wheel_type: 'Alloy', headlight: 'LED', drl: 1, instrument_cluster: 'Digital', bluetooth: 1, warranty: '5 years', service_interval_km: 6000, est_service_cost: 1300, colours: 'Metallic Triton Blue, Glass Sparkle Black' },
    pros: ['Full fairing with genuine wind protection', 'Smooth quarter-litre engine', '5-year warranty'],
    cons: ['Heaviest in the 250 class', 'Committed riding posture'],
    bestFor: 'Highway touring on a quarter-litre budget',
    variants: [{ name: 'Standard', price: 213000 }] },

  { brand: 'KTM', model: 'Duke 250', body: 'street', year: 2025, price: 239000, art: 'sport',
    specs: { engine_type: 'Liquid-cooled, DOHC', engine_capacity_cc: 248.8, max_power_bhp: 30.5, max_power_rpm: 9250, max_torque_nm: 25, max_torque_rpm: 7250, transmission: '6-speed', clutch: 'PASC slipper', top_speed_kmph: 145, mileage_kmpl: 32, fuel_tank_l: 13.4, wheelbase_mm: 1357, seat_height_mm: 822, ground_clearance_mm: 175, kerb_weight_kg: 163, front_tyre: '110/70-17', rear_tyre: '150/60-17', front_brake: 'Disc', rear_brake: 'Disc', abs_type: 'Dual channel', traction_control: 1, suspension_front: 'Upside down forks', suspension_rear: 'Monoshock', wheel_type: 'Alloy', headlight: 'LED', drl: 1, instrument_cluster: 'Digital LCD', bluetooth: 1, warranty: '2 years', service_interval_km: 7500, est_service_cost: 2200, colours: 'Electronic Orange, Atlantic Blue' },
    pros: ['30.5 bhp, sharpest performance here', 'USD forks and dual-channel ABS', 'Traction control'],
    cons: ['Highest service costs in the comparison set', '822 mm seat height'],
    bestFor: 'Experienced riders who want maximum performance per rupee',
    variants: [{ name: 'Standard', price: 239000 }] },

  { brand: 'Hero', model: 'Xpulse 200 4V', body: 'adventure', year: 2025, price: 156000, art: 'adventure',
    specs: { engine_type: 'Oil-cooled, 4-valve', engine_capacity_cc: 199.6, max_power_bhp: 18.9, max_power_rpm: 8500, max_torque_nm: 17.35, max_torque_rpm: 6500, transmission: '5-speed', top_speed_kmph: 118, mileage_kmpl: 40, fuel_tank_l: 13, wheelbase_mm: 1410, seat_height_mm: 825, ground_clearance_mm: 220, kerb_weight_kg: 158, front_tyre: '90/90-21', rear_tyre: '120/80-18', front_brake: 'Disc', rear_brake: 'Disc', abs_type: 'Single channel', suspension_front: 'Telescopic', suspension_rear: 'Monoshock', wheel_type: 'Spoke', headlight: 'LED', drl: 1, instrument_cluster: 'Digital', bluetooth: 1, navigation: 1, usb_charging: 1, warranty: '5 years', service_interval_km: 6000, est_service_cost: 900, colours: 'Red Raw, Blitz Blue, Matte Grey' },
    pros: ['220 mm ground clearance and 21-inch front wheel', 'Genuinely capable off-road', 'Turn-by-turn navigation'],
    cons: ['Modest power on highways', 'Tall 825 mm seat'],
    bestFor: 'Trail riding and rough-road touring',
    variants: [{ name: 'Standard', price: 156000 }, { name: 'Rally Kit', price: 179000 }] },

  { brand: 'TVS', model: 'Jupiter 125', body: 'scooter', year: 2025, price: 89000, art: 'scooter',
    specs: { engine_type: 'Air-cooled, CVTi-REVV', engine_capacity_cc: 124.8, max_power_bhp: 8.15, max_power_rpm: 6500, max_torque_nm: 10.5, max_torque_rpm: 4500, transmission: 'CVT automatic', top_speed_kmph: 85, mileage_kmpl: 57, fuel_tank_l: 5.1, wheelbase_mm: 1275, seat_height_mm: 765, ground_clearance_mm: 163, kerb_weight_kg: 105, front_tyre: '90/90-12', rear_tyre: '90/90-12', front_brake: 'Disc', rear_brake: 'Drum', cbs: 1, suspension_front: 'Telescopic', suspension_rear: 'Monoshock', wheel_type: 'Alloy', headlight: 'LED', drl: 1, instrument_cluster: 'Semi-digital', bluetooth: 1, usb_charging: 1, warranty: '3 years', service_interval_km: 5000, est_service_cost: 600, colours: 'Titanium Grey, Starlight Blue, Pristine White' },
    pros: ['Largest-in-class 33-litre underseat storage', 'Light 105 kg kerb weight', 'External fuel filler'],
    cons: ['Small 5.1-litre tank', 'Rear drum brake'],
    bestFor: 'Family scooter duty and short city runs',
    variants: [{ name: 'Drum', price: 84000 }, { name: 'Disc SmartXonnect', price: 89000 }] },

  { brand: 'Honda', model: 'Activa 125', body: 'scooter', year: 2025, price: 92000, art: 'scooter',
    specs: { engine_type: 'Air-cooled, eSP, 4-stroke', engine_capacity_cc: 123.92, max_power_bhp: 8.19, max_power_rpm: 6250, max_torque_nm: 10.4, max_torque_rpm: 5000, transmission: 'CVT automatic', top_speed_kmph: 85, mileage_kmpl: 50, fuel_tank_l: 5.3, wheelbase_mm: 1260, seat_height_mm: 770, ground_clearance_mm: 162, kerb_weight_kg: 111, front_tyre: '90/90-12', rear_tyre: '90/100-10', front_brake: 'Disc', rear_brake: 'Drum', cbs: 1, suspension_front: 'Telescopic', suspension_rear: 'Spring loaded', wheel_type: 'Alloy', headlight: 'LED', drl: 1, instrument_cluster: 'Digital', usb_charging: 1, warranty: '3 years', service_interval_km: 6000, est_service_cost: 620, colours: 'Pearl Precious White, Matte Grey, Black' },
    pros: ['Silent ACG start and smooth CVT', 'Strong resale value', 'Idling stop system saves fuel'],
    cons: ['Small 10-inch rear wheel', 'Storage smaller than rivals'],
    bestFor: 'Reliable everyday family scooter use',
    variants: [{ name: 'Drum', price: 87000 }, { name: 'Disc', price: 92000 }] },

  { brand: 'Suzuki', model: 'Access 125', body: 'scooter', year: 2025, price: 90000, art: 'scooter',
    specs: { engine_type: 'Air-cooled, SEP', engine_capacity_cc: 124, max_power_bhp: 8.31, max_power_rpm: 6750, max_torque_nm: 10.2, max_torque_rpm: 5500, transmission: 'CVT automatic', top_speed_kmph: 90, mileage_kmpl: 52, fuel_tank_l: 5.3, wheelbase_mm: 1265, seat_height_mm: 773, ground_clearance_mm: 160, kerb_weight_kg: 104, front_tyre: '90/90-12', rear_tyre: '90/100-10', front_brake: 'Disc', rear_brake: 'Drum', cbs: 1, suspension_front: 'Telescopic', suspension_rear: 'Swing arm', wheel_type: 'Alloy', headlight: 'LED', drl: 1, instrument_cluster: 'Digital', bluetooth: 1, usb_charging: 1, warranty: '3 years', service_interval_km: 6000, est_service_cost: 640, colours: 'Metallic Matte Black, Pearl Grace White' },
    pros: ['Quickest 125cc scooter off the line', 'Bluetooth cluster with call alerts', 'Light and stable'],
    cons: ['Small 10-inch rear wheel', 'Underseat storage fits only a half-face helmet'],
    bestFor: 'Zippy urban riding with a bit of extra pace',
    variants: [{ name: 'Standard', price: 86000 }, { name: 'Ride Connect', price: 90000 }] },

  { brand: 'Yamaha', model: 'FZ-S Fi V4', body: 'street', year: 2025, price: 133000, art: 'street',
    specs: { engine_type: 'Air-cooled, SOHC, 2-valve', engine_capacity_cc: 149, max_power_bhp: 12.4, max_power_rpm: 7250, max_torque_nm: 13.3, max_torque_rpm: 5500, transmission: '5-speed', top_speed_kmph: 110, mileage_kmpl: 48, fuel_tank_l: 13, wheelbase_mm: 1330, seat_height_mm: 790, ground_clearance_mm: 165, kerb_weight_kg: 137, front_tyre: '100/80-17', rear_tyre: '140/60-17', front_brake: 'Disc', rear_brake: 'Disc', abs_type: 'Single channel', traction_control: 1, suspension_front: 'Telescopic', suspension_rear: 'Monoshock', wheel_type: 'Alloy', headlight: 'LED', drl: 1, instrument_cluster: 'Digital LCD', bluetooth: 1, navigation: 1, warranty: '2 years', service_interval_km: 5000, est_service_cost: 850, colours: 'Racing Blue, Metallic Black, Cyan Storm' },
    pros: ['Traction control at 150cc', 'Wide 140-section rear tyre', 'Very refined air-cooled motor'],
    cons: ['Least powerful in its price bracket', 'Single-channel ABS'],
    bestFor: 'Style-conscious commuters wanting refinement',
    variants: [{ name: 'Standard', price: 133000 }] },

  { brand: 'Bajaj', model: 'Platina 110', body: 'commuter', year: 2025, price: 72000, art: 'commuter',
    specs: { engine_type: 'Air-cooled, DTS-i', engine_capacity_cc: 115.45, max_power_bhp: 8.48, max_power_rpm: 7000, max_torque_nm: 9.81, max_torque_rpm: 5000, transmission: '4-speed', top_speed_kmph: 90, mileage_kmpl: 70, fuel_tank_l: 11, wheelbase_mm: 1255, seat_height_mm: 807, ground_clearance_mm: 200, kerb_weight_kg: 118, front_tyre: '80/100-17', rear_tyre: '80/100-17', front_brake: 'Drum', rear_brake: 'Drum', cbs: 1, suspension_front: 'Telescopic', suspension_rear: 'Spring in spring', wheel_type: 'Alloy', headlight: 'LED', drl: 1, instrument_cluster: 'Semi-digital', warranty: '5 years', service_interval_km: 10000, est_service_cost: 450, colours: 'Ebony Black, Cocktail Wine Red' },
    pros: ['Claimed 70 kmpl — cheapest per kilometre here', '10,000 km service interval', 'Softest ride in the segment'],
    cons: ['Drum brakes front and rear', 'Modest performance'],
    bestFor: 'Maximum economy for long daily distances',
    variants: [{ name: 'Drum', price: 72000 }, { name: 'ES Alloy', price: 76000 }] },

  { brand: 'TVS', model: 'Raider 125', body: 'commuter', year: 2025, price: 96000, art: 'commuter',
    specs: { engine_type: 'Air-cooled, 3-valve', engine_capacity_cc: 124.8, max_power_bhp: 11.38, max_power_rpm: 7500, max_torque_nm: 11.2, max_torque_rpm: 6000, transmission: '5-speed', top_speed_kmph: 99, mileage_kmpl: 55, fuel_tank_l: 10, wheelbase_mm: 1326, seat_height_mm: 780, ground_clearance_mm: 180, kerb_weight_kg: 123, front_tyre: '80/100-17', rear_tyre: '100/90-17', front_brake: 'Disc', rear_brake: 'Drum', cbs: 1, suspension_front: 'Telescopic', suspension_rear: 'Monoshock', wheel_type: 'Alloy', headlight: 'LED', drl: 1, instrument_cluster: 'Digital LCD', bluetooth: 1, navigation: 1, usb_charging: 1, ride_modes: 'Eco, Power', warranty: '3 years', service_interval_km: 5000, est_service_cost: 620, colours: 'Wicked Black, Fiery Yellow, Striking Red' },
    pros: ['Two ride modes on a 125', 'Most powerful 125cc commuter here', 'Bluetooth cluster with navigation'],
    cons: ['Rear drum brake', 'Firm seat on long rides'],
    bestFor: 'Young commuters wanting features and pace on a budget',
    variants: [{ name: 'Drum', price: 91000 }, { name: 'Disc SmartXonnect', price: 96000 }] },

  { brand: 'Royal Enfield', model: 'Himalayan 450', body: 'adventure', year: 2025, price: 299000, art: 'adventure',
    specs: { engine_type: 'Liquid-cooled, DOHC, Sherpa 450', engine_capacity_cc: 452, max_power_bhp: 39.5, max_power_rpm: 8000, max_torque_nm: 40, max_torque_rpm: 5500, transmission: '6-speed', clutch: 'Slip and assist', top_speed_kmph: 155, mileage_kmpl: 30, fuel_tank_l: 17, wheelbase_mm: 1510, seat_height_mm: 825, ground_clearance_mm: 230, kerb_weight_kg: 196, front_tyre: '90/90-21', rear_tyre: '140/80-17', front_brake: 'Disc', rear_brake: 'Disc', abs_type: 'Dual channel', suspension_front: 'Upside down forks', suspension_rear: 'Monoshock', wheel_type: 'Spoke', headlight: 'LED', drl: 1, instrument_cluster: 'TFT touchscreen', bluetooth: 1, navigation: 1, usb_charging: 1, ride_modes: 'Performance, Eco', warranty: '3 years', service_interval_km: 10000, est_service_cost: 2500, colours: 'Kaza Brown, Slate Himalayan Salt, Hanle Black' },
    pros: ['Full TFT with Google Maps navigation', 'Switchable rear ABS for off-road', '230 mm ground clearance'],
    cons: ['196 kg is heavy for technical trails', 'Highest purchase price in this set'],
    bestFor: 'Serious adventure touring and Himalayan trips',
    variants: [{ name: 'Base', price: 285000 }, { name: 'Pass', price: 299000 }, { name: 'Summit', price: 320000 }] },
];

const EVS: Bike[] = [
  { brand: 'Ola Electric', model: 'S1 Pro', body: 'ev-scooter', year: 2025, price: 148000, art: 'ev-scooter',
    specs: { motor_power_kw: 5.5, peak_power_kw: 11, torque_nm: 58, battery_capacity_kwh: 4, battery_chemistry: 'NMC lithium-ion', battery_warranty: '3 years / 40,000 km', claimed_range_km: 195, real_world_range_km: 140, range_basis: 'Bikepick estimate at 60% of IDC figure adjusted for city riding', charging_time_hours: 6.5, fast_charging: 1, fast_charge_time_min: 90, charging_connector: 'Proprietary 750 W charger', home_charging: 1, portable_charger: 1, top_speed_kmph: 120, regen_braking: 1, ride_modes: 'Eco, Normal, Sport, Hyper', battery_ip_rating: 'IP67', motor_ip_rating: 'IP66', kerb_weight_kg: 116, warranty: '3 years', running_cost_per_km: 0.24, est_battery_replacement_cost: 60000, front_brake: 'Disc', rear_brake: 'Disc', abs_type: '', cbs: 1, suspension_front: 'Single fork', suspension_rear: 'Monoshock', wheel_type: 'Alloy', headlight: 'LED', drl: 1, instrument_cluster: '7-inch touchscreen', bluetooth: 1, navigation: 1, keyless_start: 1, reverse_mode: 1, seat_height_mm: 792, ground_clearance_mm: 165 },
    pros: ['Fastest acceleration in the mass-market EV scooter class', '7-inch connected touchscreen', 'Hyper mode with 120 km/h top speed'],
    cons: ['Real-world range well below the claimed IDC figure', 'Service network still expanding'],
    bestFor: 'Tech-first riders doing 40-60 km a day in the city',
    variants: [{ name: '3 kWh', price: 130000 }, { name: '4 kWh', price: 148000 }] },

  { brand: 'Ather', model: '450X', body: 'ev-scooter', year: 2025, price: 152000, art: 'ev-scooter',
    specs: { motor_power_kw: 4.2, peak_power_kw: 6.4, torque_nm: 26, battery_capacity_kwh: 3.7, battery_chemistry: 'Lithium-ion', battery_warranty: '3 years / 30,000 km', claimed_range_km: 161, real_world_range_km: 110, range_basis: 'Bikepick estimate from Ather true-range mode', charging_time_hours: 5.7, fast_charging: 1, fast_charge_time_min: 40, charging_connector: 'Ather Grid / portable', home_charging: 1, portable_charger: 1, top_speed_kmph: 90, regen_braking: 1, ride_modes: 'Eco, Ride, Sport, Warp', battery_ip_rating: 'IP67', motor_ip_rating: 'IP66', kerb_weight_kg: 111, warranty: '3 years', running_cost_per_km: 0.26, est_battery_replacement_cost: 58000, front_brake: 'Disc', rear_brake: 'Disc', cbs: 1, suspension_front: 'Telescopic', suspension_rear: 'Monoshock', wheel_type: 'Alloy', headlight: 'LED', drl: 1, instrument_cluster: '7-inch TFT touchscreen', bluetooth: 1, navigation: 1, keyless_start: 1, reverse_mode: 1, seat_height_mm: 780, ground_clearance_mm: 165 },
    pros: ['Best-in-class fast-charging network access', 'Sharpest handling EV scooter here', 'Regular over-the-air software updates'],
    cons: ['Premium pricing', 'Smaller boot than petrol rivals'],
    bestFor: 'City riders with access to a fast-charging network',
    variants: [{ name: '2.9 kWh', price: 139000 }, { name: '3.7 kWh', price: 152000 }] },

  { brand: 'TVS', model: 'iQube S', body: 'ev-scooter', year: 2025, price: 129000, art: 'ev-scooter',
    specs: { motor_power_kw: 3, peak_power_kw: 4.4, torque_nm: 33, battery_capacity_kwh: 3.4, battery_chemistry: 'Lithium-ion', battery_warranty: '3 years / 50,000 km', claimed_range_km: 145, real_world_range_km: 100, range_basis: 'Bikepick estimate for mixed city riding', charging_time_hours: 4.5, fast_charging: 1, fast_charge_time_min: 120, charging_connector: '950 W on-board charger', home_charging: 1, portable_charger: 1, top_speed_kmph: 82, regen_braking: 1, ride_modes: 'Eco, Power', battery_ip_rating: 'IP67', kerb_weight_kg: 118, warranty: '3 years', running_cost_per_km: 0.27, est_battery_replacement_cost: 55000, front_brake: 'Disc', rear_brake: 'Drum', cbs: 1, suspension_front: 'Telescopic', suspension_rear: 'Twin shock', wheel_type: 'Alloy', headlight: 'LED', drl: 1, instrument_cluster: '7-inch TFT', bluetooth: 1, navigation: 1, usb_charging: 1, reverse_mode: 1, seat_height_mm: 770, ground_clearance_mm: 157 },
    pros: ['TVS service network coverage', 'Comfortable flat floorboard and seat', '50,000 km battery warranty'],
    cons: ['Rear drum brake', 'Slower top speed than rivals'],
    bestFor: 'Buyers who want an EV but need an established service network',
    variants: [{ name: '2.2 kWh', price: 115000 }, { name: '3.4 kWh', price: 129000 }] },

  { brand: 'Bajaj', model: 'Chetak 3202', body: 'ev-scooter', year: 2025, price: 136000, art: 'ev-scooter',
    specs: { motor_power_kw: 3.4, peak_power_kw: 4.2, torque_nm: 20, battery_capacity_kwh: 3.2, battery_chemistry: 'Lithium-ion', battery_warranty: '3 years / 50,000 km', claimed_range_km: 137, real_world_range_km: 95, range_basis: 'Bikepick estimate in Eco mode city use', charging_time_hours: 4.5, fast_charging: 0, charging_connector: 'On-board charger', home_charging: 1, portable_charger: 1, top_speed_kmph: 73, regen_braking: 1, ride_modes: 'Eco, Sport', battery_ip_rating: 'IP67', kerb_weight_kg: 134, warranty: '3 years', running_cost_per_km: 0.28, est_battery_replacement_cost: 52000, front_brake: 'Disc', rear_brake: 'Drum', cbs: 1, suspension_front: 'Single sided leading link', suspension_rear: 'Monoshock', wheel_type: 'Alloy', headlight: 'LED', drl: 1, instrument_cluster: 'Digital', bluetooth: 1, reverse_mode: 1, seat_height_mm: 765, ground_clearance_mm: 160 },
    pros: ['All-metal body — most solid build here', 'Quietest and smoothest ride', 'Bajaj dealer network'],
    cons: ['No fast charging', 'Heaviest EV scooter in this set'],
    bestFor: 'Buyers prioritising build quality and refinement',
    variants: [{ name: '3201', price: 122000 }, { name: '3202', price: 136000 }] },

  { brand: 'Hero', model: 'Vida V1 Pro', body: 'ev-scooter', year: 2025, price: 139000, art: 'ev-scooter',
    specs: { motor_power_kw: 3.9, peak_power_kw: 6, torque_nm: 25, battery_capacity_kwh: 3.94, battery_chemistry: 'Lithium-ion (removable)', battery_warranty: '3 years / 30,000 km', claimed_range_km: 165, real_world_range_km: 110, range_basis: 'Bikepick estimate for mixed riding', charging_time_hours: 5.9, fast_charging: 1, fast_charge_time_min: 65, charging_connector: 'Removable battery + portable charger', home_charging: 1, portable_charger: 1, top_speed_kmph: 80, regen_braking: 1, ride_modes: 'Eco, Ride, Sport, Custom', battery_ip_rating: 'IP67', kerb_weight_kg: 125, warranty: '3 years', running_cost_per_km: 0.26, est_battery_replacement_cost: 56000, front_brake: 'Disc', rear_brake: 'Disc', cbs: 1, suspension_front: 'Telescopic', suspension_rear: 'Monoshock', wheel_type: 'Alloy', headlight: 'LED', drl: 1, instrument_cluster: '7-inch TFT', bluetooth: 1, navigation: 1, keyless_start: 1, reverse_mode: 1, seat_height_mm: 780, ground_clearance_mm: 155 },
    pros: ['Two removable batteries — charge them indoors', 'Customisable ride mode', 'Disc brakes at both ends'],
    cons: ['Batteries are heavy to carry upstairs', 'Range drops noticeably in Sport mode'],
    bestFor: 'Apartment dwellers without dedicated parking charging points',
    variants: [{ name: 'V1 Plus', price: 125000 }, { name: 'V1 Pro', price: 139000 }] },

  { brand: 'Ather', model: 'Rizta S', body: 'ev-scooter', year: 2025, price: 125000, art: 'ev-scooter',
    specs: { motor_power_kw: 3.3, peak_power_kw: 4.3, torque_nm: 22, battery_capacity_kwh: 2.9, battery_chemistry: 'Lithium-ion', battery_warranty: '3 years / 30,000 km', claimed_range_km: 123, real_world_range_km: 90, range_basis: 'Bikepick estimate, true-range mode', charging_time_hours: 6.5, fast_charging: 1, fast_charge_time_min: 55, charging_connector: 'Ather Grid', home_charging: 1, portable_charger: 1, top_speed_kmph: 80, regen_braking: 1, ride_modes: 'Smart Eco, Zip', battery_ip_rating: 'IP67', kerb_weight_kg: 119, warranty: '3 years', running_cost_per_km: 0.25, est_battery_replacement_cost: 50000, front_brake: 'Disc', rear_brake: 'Drum', cbs: 1, suspension_front: 'Telescopic', suspension_rear: 'Monoshock', wheel_type: 'Alloy', headlight: 'LED', drl: 1, instrument_cluster: 'Deck display', bluetooth: 1, navigation: 1, reverse_mode: 1, seat_height_mm: 780, ground_clearance_mm: 165 },
    pros: ['Longest seat in the class — genuinely comfortable for two', '34-litre underseat storage', 'Ather software and charging network'],
    cons: ['Modest 123 km claimed range', 'Rear drum brake'],
    bestFor: 'Families wanting a practical, comfortable electric scooter',
    variants: [{ name: 'Rizta S 2.9', price: 125000 }, { name: 'Rizta Z 3.7', price: 147000 }] },

  { brand: 'Revolt', model: 'RV400 BRZ', body: 'ev-bike', year: 2025, price: 138000, art: 'ev-bike',
    specs: { motor_power_kw: 3, peak_power_kw: 5, torque_nm: 54, battery_capacity_kwh: 3.24, battery_chemistry: 'Lithium-ion (removable)', battery_warranty: '5 years / 75,000 km', claimed_range_km: 150, real_world_range_km: 100, range_basis: 'Bikepick estimate in Normal mode', charging_time_hours: 4.5, fast_charging: 0, charging_connector: 'Removable battery, standard socket', home_charging: 1, portable_charger: 1, top_speed_kmph: 85, regen_braking: 1, ride_modes: 'Eco, Normal, Sport', battery_ip_rating: 'IP67', kerb_weight_kg: 108, warranty: '5 years', running_cost_per_km: 0.24, est_battery_replacement_cost: 48000, front_brake: 'Disc', rear_brake: 'Disc', cbs: 1, suspension_front: 'Upside down forks', suspension_rear: 'Monoshock', wheel_type: 'Alloy', headlight: 'LED', drl: 1, instrument_cluster: 'Digital', bluetooth: 1, keyless_start: 1, seat_height_mm: 814, ground_clearance_mm: 215 },
    pros: ['Motorcycle format with removable battery', '5-year battery warranty', 'USD forks and disc brakes'],
    cons: ['85 km/h top speed limits highway use', 'Limited dealer coverage'],
    bestFor: 'Riders who want an electric motorcycle rather than a scooter',
    variants: [{ name: 'BRZ', price: 138000 }] },

  { brand: 'Ola Electric', model: 'S1 X+', body: 'ev-scooter', year: 2025, price: 105000, art: 'ev-scooter',
    specs: { motor_power_kw: 4, peak_power_kw: 6, torque_nm: 40, battery_capacity_kwh: 3, battery_chemistry: 'Lithium-ion', battery_warranty: '3 years / 40,000 km', claimed_range_km: 151, real_world_range_km: 105, range_basis: 'Bikepick estimate for mixed city use', charging_time_hours: 5, fast_charging: 1, fast_charge_time_min: 100, charging_connector: 'Proprietary charger', home_charging: 1, portable_charger: 1, top_speed_kmph: 90, regen_braking: 1, ride_modes: 'Eco, Normal, Sport', battery_ip_rating: 'IP67', kerb_weight_kg: 110, warranty: '3 years', running_cost_per_km: 0.23, est_battery_replacement_cost: 45000, front_brake: 'Drum', rear_brake: 'Drum', cbs: 1, suspension_front: 'Twin telescopic', suspension_rear: 'Monoshock', wheel_type: 'Steel', headlight: 'LED', drl: 1, instrument_cluster: 'LCD', bluetooth: 1, reverse_mode: 1, seat_height_mm: 792, ground_clearance_mm: 165 },
    pros: ['Lowest entry price for a 3 kWh battery', 'Good claimed range for the money', 'Reverse mode standard'],
    cons: ['Drum brakes front and rear', 'Steel wheels and basic display'],
    bestFor: 'Budget-first EV buyers replacing a 110cc petrol scooter',
    variants: [{ name: '2 kWh', price: 85000 }, { name: '3 kWh', price: 105000 }] },

  { brand: 'Ampere', model: 'Nexus ST', body: 'ev-scooter', year: 2025, price: 112000, art: 'ev-scooter',
    specs: { motor_power_kw: 2.7, peak_power_kw: 4, torque_nm: 20, battery_capacity_kwh: 3, battery_chemistry: 'LFP lithium', battery_warranty: '3 years', claimed_range_km: 136, real_world_range_km: 92, range_basis: 'Bikepick estimate for city use', charging_time_hours: 5, fast_charging: 0, charging_connector: 'On-board charger', home_charging: 1, portable_charger: 1, top_speed_kmph: 75, regen_braking: 1, ride_modes: 'Eco, City, Power', battery_ip_rating: 'IP67', kerb_weight_kg: 108, warranty: '3 years', running_cost_per_km: 0.27, est_battery_replacement_cost: 46000, front_brake: 'Disc', rear_brake: 'Drum', cbs: 1, suspension_front: 'Telescopic', suspension_rear: 'Twin shock', wheel_type: 'Alloy', headlight: 'LED', drl: 1, instrument_cluster: 'TFT', bluetooth: 1, usb_charging: 1, reverse_mode: 1, seat_height_mm: 770, ground_clearance_mm: 170 },
    pros: ['LFP chemistry tolerates heat and fast cycling better', 'Large 34-litre boot', 'Competitive pricing'],
    cons: ['Lowest top speed here', 'No fast charging'],
    bestFor: 'Short-distance city commuting in hot climates',
    variants: [{ name: 'Nexus EX', price: 100000 }, { name: 'Nexus ST', price: 112000 }] },

  { brand: 'Ultraviolette', model: 'F77 Mach 2', body: 'ev-bike', year: 2025, price: 299000, art: 'ev-bike',
    specs: { motor_power_kw: 20, peak_power_kw: 29.8, torque_nm: 100, battery_capacity_kwh: 10.3, battery_chemistry: 'Lithium-ion', battery_warranty: '8 years / 800,000 km', claimed_range_km: 323, real_world_range_km: 210, range_basis: 'Bikepick estimate for mixed highway and city riding', charging_time_hours: 7, fast_charging: 1, fast_charge_time_min: 90, charging_connector: 'Boost charger', home_charging: 1, portable_charger: 1, top_speed_kmph: 155, regen_braking: 1, ride_modes: 'Glide, Combat, Ballistic', battery_ip_rating: 'IP67', motor_ip_rating: 'IP67', kerb_weight_kg: 207, warranty: '5 years', running_cost_per_km: 0.38, est_battery_replacement_cost: 180000, front_brake: 'Disc', rear_brake: 'Disc', abs_type: 'Dual channel', traction_control: 1, suspension_front: 'Upside down forks', suspension_rear: 'Monoshock', wheel_type: 'Alloy', headlight: 'LED', drl: 1, instrument_cluster: '5-inch TFT', bluetooth: 1, navigation: 1, keyless_start: 1, seat_height_mm: 800, ground_clearance_mm: 160 },
    pros: ['Genuine highway-capable electric motorcycle', '8-year battery warranty', 'Traction control and dual-channel ABS'],
    cons: ['Highest price in the EV set', '207 kg kerb weight'],
    bestFor: 'Performance riders making the switch to electric',
    variants: [{ name: 'Recon', price: 299000 }, { name: 'Laser', price: 320000 }] },
];

async function main() {
  const already = await db.get<any>('SELECT COUNT(*) AS n FROM products');
  if (Number(already?.n || 0) > 0 && !process.argv.includes('--force')) {
    console.log('Products already exist. Re-run with --force to add seed data anyway.');
    return;
  }

  /* ------------------------------- settings ------------------------------ */
  for (const [key, def] of Object.entries(DEFAULT_SETTINGS)) {
    const exists = await db.get<any>('SELECT id FROM settings WHERE key = ?', [key]);
    if (!exists) {
      await insert('settings', {
        id: uid('set'), key, value: def.value, value_type: def.type,
        group_name: def.group, label: def.label, help_text: def.help || null,
      });
    }
  }

  /* -------------------------------- roles -------------------------------- */
  const ROLES = [
    ['admin', 'Full platform control'], ['moderator', 'Content and listing moderation'],
    ['verifier', 'Document and listing verification'], ['dealer', 'Dealer dashboard access'],
    ['user', 'Standard buyer account'],
  ];
  for (const [name, description] of ROLES) {
    const exists = await db.get<any>('SELECT id FROM roles WHERE name = ?', [name]);
    if (!exists) await insert('roles', { id: uid('rol'), name, description, permissions: '[]' });
  }

  /* ------------------------------ categories ----------------------------- */
  const CATS = [
    { name: 'Bikes & Scooters', slug: 'bikes', kind: 'vehicle', spec_schema: 'bike_specs', icon: 'bike', sort_order: 1, active: 1 },
    { name: 'Electric', slug: 'electric', kind: 'vehicle', spec_schema: 'ev_specs', icon: 'bolt', sort_order: 2, active: 1 },
    { name: 'Used Bikes', slug: 'used-bikes', kind: 'marketplace', spec_schema: 'bike_specs', icon: 'tag', sort_order: 3, active: 1 },
    { name: 'Mobile & Electronics', slug: 'mobile', kind: 'product', spec_schema: 'mobile_specs', icon: 'phone', sort_order: 4, active: 0 },
  ];
  const catIds: Record<string, string> = {};
  for (const c of CATS) catIds[c.slug] = await insert('categories', { id: uid('cat'), ...c });

  /* -------------------------------- brands ------------------------------- */
  const BRANDS = [
    ['Honda', 'https://www.honda2wheelersindia.com'], ['Hero', 'https://www.heromotocorp.com'],
    ['Bajaj', 'https://www.bajajauto.com'], ['TVS', 'https://www.tvsmotor.com'],
    ['Yamaha', 'https://www.yamaha-motor-india.com'], ['Royal Enfield', 'https://www.royalenfield.com'],
    ['Suzuki', 'https://www.suzukimotorcycle.co.in'], ['KTM', 'https://www.ktmindia.com'],
    ['Ola Electric', 'https://olaelectric.com'], ['Ather', 'https://www.atherenergy.com'],
    ['Revolt', 'https://www.revoltmotors.com'], ['Ampere', 'https://ampere.greaveselectricmobility.com'],
    ['Ultraviolette', 'https://www.ultraviolette.com'],
  ];
  const brandIds: Record<string, string> = {};
  for (const [name, site] of BRANDS) {
    brandIds[name] = await insert('brands', {
      id: uid('brd'), name, slug: slugify(name), official_website: site,
      logo_url: null, logo_license_status: 'not_provided', country: 'India', active: 1,
      about: `${name} two-wheeler range listed on Bikepick.IN. Logo not uploaded — an administrator must add an authorised logo file before it appears.`,
    });
  }

  /* ------------------------------- products ------------------------------ */
  const created: { id: string; price: number; fuel: string }[] = [];
  const allBikes = [...PETROL.map((b) => ({ ...b, fuel: 'petrol' })), ...EVS.map((b) => ({ ...b, fuel: 'electric' }))];
  const medianPrice = [...allBikes].sort((a, b) => a.price - b.price)[Math.floor(allBikes.length / 2)].price;

  for (const b of allBikes) {
    const isEv = b.fuel === 'electric';
    const categoryId = isEv ? catIds.electric : catIds.bikes;
    const specs = b.specs as Record<string, any>;

    const bikeSpecKeys = ['engine_type', 'engine_capacity_cc', 'max_power_bhp', 'max_power_rpm', 'max_torque_nm', 'max_torque_rpm', 'transmission', 'clutch', 'gearbox', 'top_speed_kmph', 'mileage_kmpl', 'fuel_tank_l', 'length_mm', 'width_mm', 'height_mm', 'wheelbase_mm', 'seat_height_mm', 'ground_clearance_mm', 'kerb_weight_kg', 'front_tyre', 'rear_tyre', 'front_brake', 'rear_brake', 'abs_type', 'cbs', 'traction_control', 'suspension_front', 'suspension_rear', 'wheel_type', 'headlight', 'tail_light', 'drl', 'instrument_cluster', 'bluetooth', 'navigation', 'usb_charging', 'keyless_start', 'cruise_control', 'ride_modes', 'hill_hold', 'reverse_mode', 'warranty', 'service_interval_km', 'est_service_cost', 'accessories', 'colours'];
    const evSpecKeys = ['motor_power_kw', 'peak_power_kw', 'torque_nm', 'battery_capacity_kwh', 'battery_chemistry', 'battery_warranty', 'claimed_range_km', 'real_world_range_km', 'range_basis', 'charging_time_hours', 'fast_charging', 'fast_charge_time_min', 'charging_connector', 'home_charging', 'portable_charger', 'top_speed_kmph', 'regen_braking', 'ride_modes', 'battery_ip_rating', 'motor_ip_rating', 'kerb_weight_kg', 'warranty', 'running_cost_per_km', 'est_battery_replacement_cost'];

    const bikePart = Object.fromEntries(Object.entries(specs).filter(([k]) => bikeSpecKeys.includes(k)));
    const evPart = Object.fromEntries(Object.entries(specs).filter(([k]) => evSpecKeys.includes(k)));

    const scored = computeScore(
      { price: b.price, fuelType: b.fuel, bike: bikePart as any, ev: isEv ? (evPart as any) : null, segment: { medianPrice } },
      DEFAULT_WEIGHTS,
    );

    const productId = await insert('products', {
      id: uid('prd'),
      brand_id: brandIds[b.brand],
      category_id: categoryId,
      name: b.model,
      slug: slugify(b.model),
      normalized_key: normalizeKey(b.brand, b.model),
      description: `${b.brand} ${b.model} — ${b.bestFor}. Specifications on this page are structured demo data supplied for platform testing.`,
      generation: `${b.year}`,
      model_year: b.year,
      body_type: b.body,
      fuel_type: b.fuel,
      status: 'published',
      verification_status: 'demo_data',
      is_demo: 1,
      featured: ['MT-15 V2', '450X', 'Classic 350', 'S1 Pro'].includes(b.model) ? 1 : 0,
      price_min: b.variants[0].price,
      price_max: b.variants[b.variants.length - 1].price,
      score: scored.total,
      score_breakdown: JSON.stringify(scored),
      popularity: Math.floor(Math.random() * 500) + 100,
      pros: JSON.stringify(b.pros),
      cons: JSON.stringify(b.cons),
      best_for: b.bestFor,
      who_should_buy: `Buyers who prioritise ${b.pros[0].toLowerCase()}.`,
      who_should_avoid: `Riders who need to avoid ${b.cons[0].toLowerCase()}.`,
      published_at: nowIso(),
    });
    created.push({ id: productId, price: b.variants[0].price, fuel: b.fuel });

    for (let i = 0; i < b.variants.length; i++) {
      await insert('product_variants', {
        id: uid('var'), product_id: productId, name: b.variants[i].name,
        variant_code: slugify(`${b.model}-${b.variants[i].name}`), model_year: b.year,
        price: b.variants[i].price, on_road_price: Math.round(b.variants[i].price * 1.17),
        status: 'active', is_base: i === 0 ? 1 : 0, colours: specs.colours || null, sort_order: i,
      });
    }

    if (Object.keys(bikePart).length) await insert('bike_specs', { id: uid('bks'), product_id: productId, ...bikePart });
    if (isEv) await insert('ev_specs', { id: uid('evs'), product_id: productId, ...evPart });

    await insert('product_images', {
      id: uid('img'), product_id: productId,
      image_url: `/media/${b.art}.svg`, thumbnail_url: `/media/${b.art}.svg`,
      source_name: 'Bikepick original illustration', license_status: 'owned_placeholder',
      alt_text: `${b.brand} ${b.model} — neutral illustration placeholder. Licensed photography has not been uploaded for this model.`,
      width: 800, height: 500, sort_order: 0, approved: 1, is_primary: 1,
    });

    await insert('product_sources', {
      id: uid('src'), product_id: productId, source_name: 'Bikepick demo dataset',
      source_url: null, field_scope: 'all specifications and price',
      confidence: 0.5, extracted_at: nowIso(),
    });

    await insert('product_prices', {
      id: uid('prc'), product_id: productId, city: 'India', price_type: 'ex_showroom',
      price: b.variants[0].price, insurance: Math.round(b.variants[0].price * 0.06),
      registration: Math.round(b.variants[0].price * 0.08), retailer: 'Demo dataset', verified: 0,
      effective_from: nowIso(),
    });

    // 12 months of price history so the chart has something real to draw.
    let p = b.variants[0].price * 0.94;
    for (let m = 11; m >= 0; m--) {
      const d = new Date(); d.setMonth(d.getMonth() - m); d.setDate(1);
      p = Math.round((p * (1 + (Math.random() * 0.018 - 0.004))) / 100) * 100;
      await insert('price_history', {
        id: uid('ph'), product_id: productId, city: 'India', price: p, price_type: 'ex_showroom',
        source_name: 'Bikepick demo dataset', verified: 0, recorded_at: d.toISOString(),
      });
    }
  }
  console.log(`✓ ${created.length} demo products (${PETROL.length} petrol, ${EVS.length} electric)`);

  /* -------------------------------- users -------------------------------- */
  const adminId = await insert('users', {
    id: uid('usr'), email: 'admin@bikepick.in', full_name: 'Platform Owner',
    password_hash: hash('Admin@12345'), role: 'admin', status: 'active',
    email_verified: 1, phone: '9876500001', phone_verified: 1, city: 'Coimbatore', state: 'Tamil Nadu',
  });
  await insert('users', {
    id: uid('usr'), email: 'moderator@bikepick.in', full_name: 'Content Moderator',
    password_hash: hash('Mod@12345'), role: 'moderator', status: 'active', email_verified: 1,
  });
  await insert('users', {
    id: uid('usr'), email: 'verifier@bikepick.in', full_name: 'Listing Verifier',
    password_hash: hash('Verify@12345'), role: 'verifier', status: 'active', email_verified: 1,
  });
  const buyerId = await insert('users', {
    id: uid('usr'), email: 'rider@example.com', full_name: 'Demo Rider',
    password_hash: hash('Rider@12345'), role: 'user', status: 'active', email_verified: 1,
    phone: '9876500010', phone_verified: 1, city: 'Coimbatore', state: 'Tamil Nadu',
  });

  /* ---------------------------- dealer plans ----------------------------- */
  const PLANS = [
    { name: 'Free', code: 'FREE', price: 0, duration_days: 365, lead_limit: 10, offer_limit: 2, featured_placement: 0, features: JSON.stringify(['Verified dealer badge', 'Up to 2 live offers', '10 leads per month', 'Basic dashboard']) },
    { name: 'Pro', code: 'PRO', price: 1499, duration_days: 30, lead_limit: 100, offer_limit: 15, featured_placement: 0, features: JSON.stringify(['Everything in Free', 'Up to 15 live offers', '100 leads per month', 'Lead export', 'Priority support']) },
    { name: 'Premium', code: 'PREMIUM', price: 3999, duration_days: 30, lead_limit: 500, offer_limit: 50, featured_placement: 1, features: JSON.stringify(['Everything in Pro', 'Featured placement in city results', 'Unlimited offer edits', '500 leads per month', 'Dedicated account manager']) },
  ];
  const planIds: Record<string, string> = {};
  for (let i = 0; i < PLANS.length; i++) planIds[PLANS[i].code] = await insert('subscription_plans', { id: uid('pln'), ...PLANS[i], active: 1, sort_order: i });

  /* -------------------------------- dealers ------------------------------ */
  const DEALERS = [
    { business: 'Kovai Wheels Honda', name: 'S. Ramesh', city: 'Coimbatore', state: 'Tamil Nadu', pin: '641012', brands: ['Honda', 'Hero'], plan: 'PRO' },
    { business: 'Metro Motors TVS', name: 'A. Priya', city: 'Coimbatore', state: 'Tamil Nadu', pin: '641004', brands: ['TVS', 'Bajaj'], plan: 'PREMIUM' },
    { business: 'Southern Royal Motors', name: 'K. Vignesh', city: 'Chennai', state: 'Tamil Nadu', pin: '600042', brands: ['Royal Enfield', 'Yamaha'], plan: 'FREE' },
    { business: 'GreenRide EV Hub', name: 'M. Fathima', city: 'Bengaluru', state: 'Karnataka', pin: '560076', brands: ['Ather', 'Ola Electric', 'TVS'], plan: 'PRO' },
    { business: 'Deccan Two Wheelers', name: 'R. Sathish', city: 'Hyderabad', state: 'Telangana', pin: '500081', brands: ['Bajaj', 'KTM', 'Suzuki'], plan: 'FREE' },
  ];
  const dealerIds: string[] = [];
  for (let i = 0; i < DEALERS.length; i++) {
    const d = DEALERS[i];
    const userId = await insert('users', {
      id: uid('usr'), email: `dealer${i + 1}@bikepick.in`, full_name: d.name,
      password_hash: hash('Dealer@12345'), role: 'dealer', status: 'active',
      email_verified: 1, phone: `98765001${10 + i}`, phone_verified: 1, city: d.city, state: d.state,
    });
    const dealerId = await insert('dealer_profiles', {
      id: uid('dlr'), user_id: userId, business_name: d.business, dealer_name: d.name,
      phone: `98765001${10 + i}`, email: `dealer${i + 1}@bikepick.in`, whatsapp: `98765001${10 + i}`,
      gstin: `33ABCDE${1000 + i}F1Z5`, address: `${12 + i}, Trunk Road, ${d.city}`,
      city: d.city, state: d.state, pincode: d.pin, brands: JSON.stringify(d.brands),
      about: `Demo dealer profile created by the seed script for workflow testing.`,
      status: 'verified', verified_at: nowIso(), verified_by: adminId,
      plan_id: planIds[d.plan], featured: d.plan === 'PREMIUM' ? 1 : 0, is_demo: 1,
    });
    dealerIds.push(dealerId);
    await insert('subscriptions', {
      id: uid('sub'), dealer_id: dealerId, plan_id: planIds[d.plan], status: 'active',
      starts_at: nowIso(), ends_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    });
    await insert('dealer_documents', {
      id: uid('doc'), dealer_id: dealerId, doc_type: 'gst_certificate',
      storage_key: `demo/dealer-${i + 1}/gst.pdf`, private: 1, status: 'approved',
      reviewed_by: adminId, reviewed_at: nowIso(), note: 'Demo record — no real document stored.',
    });
    if (d.brands.length) {
      await insert('service_centres', {
        id: uid('svc'), name: `${d.business} Service`, dealer_id: dealerId,
        phone: `98765001${10 + i}`, address: `${12 + i}, Trunk Road, ${d.city}`,
        city: d.city, state: d.state, pincode: d.pin,
        services: JSON.stringify(['Periodic service', 'Accident repair', 'EV diagnostics']),
        verified: 1, status: 'approved', is_demo: 1,
      });
    }
  }
  console.log(`✓ ${dealerIds.length} verified demo dealers`);

  /* -------------------------------- offers ------------------------------- */
  const today = new Date();
  const end = new Date(Date.now() + 25 * 86400000).toISOString().slice(0, 10);
  for (let i = 0; i < 10; i++) {
    const product = created[i % created.length];
    const dealerId = dealerIds[i % dealerIds.length];
    const dealer = await db.get<any>('SELECT city FROM dealer_profiles WHERE id = ?', [dealerId]);
    const discount = [2000, 3500, 5000, 1500, 7000][i % 5];
    await insert('dealer_offers', {
      id: uid('ofr'), dealer_id: dealerId, product_id: product.id, city: dealer.city,
      ex_showroom: product.price, on_road: Math.round(product.price * 1.17),
      insurance: Math.round(product.price * 0.06), registration: Math.round(product.price * 0.08),
      discount, exchange_bonus: i % 3 === 0 ? 3000 : 0,
      finance_offer: i % 2 === 0 ? '8.99% p.a. starting rate, subject to lender approval' : null,
      accessories_offer: i % 4 === 0 ? 'Free helmet and tank cover' : null,
      offer_text: `Demo offer: ₹${discount.toLocaleString('en-IN')} off plus exchange support. Confirm final pricing with the dealer before purchase.`,
      start_date: today.toISOString().slice(0, 10), end_date: end,
      status: 'approved', approved_by: adminId, approved_at: nowIso(),
      featured: i < 2 ? 1 : 0, is_demo: 1,
    });
  }
  console.log('✓ 10 approved demo dealer offers');

  /* ------------------------------ used bikes ----------------------------- */
  const USED = [
    { brand: 'Honda', model: 'Shine 125', year: 2021, km: 24000, owners: 1, city: 'Coimbatore', price: 58000, cond: 'good' as const, ins: 'comprehensive' as const, sh: 'full_authorised' as const, base: 84000, abs: 0 },
    { brand: 'Yamaha', model: 'MT-15 V2', year: 2022, km: 18500, owners: 1, city: 'Chennai', price: 132000, cond: 'excellent' as const, ins: 'comprehensive' as const, sh: 'full_authorised' as const, base: 169000, abs: 1 },
    { brand: 'Royal Enfield', model: 'Classic 350', year: 2019, km: 41000, owners: 2, city: 'Bengaluru', price: 128000, cond: 'good' as const, ins: 'third_party' as const, sh: 'partial' as const, base: 199000, abs: 1 },
    { brand: 'Bajaj', model: 'Pulsar N160', year: 2023, km: 9800, owners: 1, city: 'Coimbatore', price: 104000, cond: 'excellent' as const, ins: 'comprehensive' as const, sh: 'full_authorised' as const, base: 128000, abs: 1 },
    { brand: 'TVS', model: 'Jupiter 125', year: 2020, km: 31000, owners: 1, city: 'Madurai', price: 52000, cond: 'good' as const, ins: 'third_party' as const, sh: 'local' as const, base: 89000, abs: 0 },
    { brand: 'Hero', model: 'Splendor Plus', year: 2018, km: 56000, owners: 2, city: 'Salem', price: 34000, cond: 'fair' as const, ins: 'expired' as const, sh: 'local' as const, base: 79000, abs: 0 },
    { brand: 'Ather', model: '450X', year: 2022, km: 14200, owners: 1, city: 'Bengaluru', price: 98000, cond: 'excellent' as const, ins: 'comprehensive' as const, sh: 'full_authorised' as const, base: 152000, abs: 0, fuel: 'electric' },
    { brand: 'Suzuki', model: 'Access 125', year: 2021, km: 22000, owners: 1, city: 'Hyderabad', price: 61000, cond: 'good' as const, ins: 'comprehensive' as const, sh: 'partial' as const, base: 90000, abs: 0 },
    { brand: 'KTM', model: 'Duke 250', year: 2020, km: 27500, owners: 2, city: 'Chennai', price: 148000, cond: 'good' as const, ins: 'comprehensive' as const, sh: 'partial' as const, base: 239000, abs: 1 },
    { brand: 'Honda', model: 'Activa 125', year: 2019, km: 38000, owners: 1, city: 'Coimbatore', price: 48000, cond: 'fair' as const, ins: 'third_party' as const, sh: 'none' as const, base: 92000, abs: 0 },
  ];

  const ANGLES = ['front', 'rear', 'left', 'right', 'odometer', 'engine', 'tyres'];
  for (let i = 0; i < USED.length; i++) {
    const u = USED[i];
    const valuation = estimateUsedPrice({
      basePrice: u.base, manufactureYear: u.year, kmDriven: u.km, owners: u.owners,
      condition: u.cond, insuranceStatus: u.ins, serviceHistory: u.sh, accidentHistory: 'none', cityTier: 2,
    });
    const verdict = judgeAskingPrice(u.price, valuation);
    const usedId = uid('usd');

    // Verification checks actually performed vary by listing — nothing assumed.
    const performed: [string, string][] = i < 3
      ? [['seller_identity', 'passed'], ['rc_verification', 'passed'], ['insurance_verification', 'passed'], ['service_history', 'passed'], ['physical_inspection', 'passed']]
      : i < 6
        ? [['seller_identity', 'passed'], ['rc_verification', 'passed'], ['insurance_verification', 'passed']]
        : i < 8
          ? [['seller_identity', 'passed'], ['rc_verification', 'passed']]
          : [['seller_identity', 'passed']];

    const angles = i < 6 ? ANGLES : ANGLES.slice(0, 5);
    const infoFields = {
      insurance_status: u.ins, rc_available: 'original', loan_status: 'no_loan',
      service_history: u.sh, accident_history: 'none', tyre_condition: 'good',
      description: 'Demo listing created by the seed script.',
    };
    const trust = computeTrust({ checks: performed.map(([check_type, result]) => ({ check_type, result })), photoAngles: angles, infoFields });

    await insert('used_bikes', {
      id: usedId, seller_id: buyerId, seller_type: i % 4 === 0 ? 'dealer' : 'individual',
      dealer_id: i % 4 === 0 ? dealerIds[i % dealerIds.length] : null,
      brand_id: brandIds[u.brand] || null, brand_name: u.brand, model_name: u.model,
      slug: slugify(`${u.brand}-${u.model}-${u.year}-${u.city}-${i + 1}`),
      manufacture_year: u.year, registration_year: u.year, km_driven: u.km, owners: u.owners,
      fuel_type: (u as any).fuel || 'petrol', city: u.city, state: 'Tamil Nadu',
      asking_price: u.price, estimated_price_min: valuation.min, estimated_price_max: valuation.max,
      price_verdict: verdict.verdict, condition_grade: u.cond, insurance_status: u.ins,
      rc_available: 'original', loan_status: 'no_loan', service_history: u.sh,
      accident_history: 'none', tyre_condition: 'good', abs_equipped: u.abs,
      description: `Demo used-bike listing for workflow testing. ${u.owners} owner, ${u.km.toLocaleString('en-IN')} km, ${u.city}.`,
      status: 'approved', trust_score: trust.score, trust_band: trust.band,
      trust_breakdown: JSON.stringify(trust), is_demo: 1,
      submitted_at: nowIso(), approved_at: nowIso(), approved_by: adminId,
    });

    for (let a = 0; a < angles.length; a++) {
      await insert('used_bike_images', {
        id: uid('uim'), used_bike_id: usedId, angle: angles[a],
        image_url: '/media/used.svg', thumbnail_url: '/media/used.svg',
        approved: 1, sort_order: a,
      });
    }
    for (const [check_type, result] of performed) {
      await insert('verification_records', {
        id: uid('vrf'), entity_type: 'used_bike', entity_id: usedId, check_type, result,
        method: check_type === 'physical_inspection' ? 'partner_inspection' : 'document_review',
        evidence_note: 'Demo verification record created by the seed script.',
        performed_by: adminId, performed_at: nowIso(),
      });
    }
  }
  console.log('✓ 10 approved demo used-bike listings');

  /* ------------------------------- articles ------------------------------ */
  const ARTICLES = [
    { title: 'How to choose your first bike in India: a practical 7-step checklist', slug: 'choose-first-bike-india', category: 'buying_guide',
      excerpt: 'Budget, body type, seat height, running cost, service network, resale and paperwork — the seven things that actually decide whether you enjoy your bike.',
      body: `Buying your first two-wheeler is mostly an exercise in honesty about how you will actually use it.\n\n## 1. Fix a true budget, not an ex-showroom budget\nEx-showroom price is never what you pay. Add roughly 15-18% for insurance, registration and mandatory accessories. A bike listed at ₹1,20,000 typically lands near ₹1,40,000 on-road. Use our EMI calculator to test whether the monthly figure survives contact with your other expenses.\n\n## 2. Match the body type to your real commute\nA 220 mm ground clearance adventure bike is wonderful on bad roads and tiring in stop-go traffic. A 105 kg scooter is effortless in traffic and nervous at 90 km/h. Ride the honest 90% of your week, not the aspirational 10%.\n\n## 3. Check seat height against your inseam\nAnything above 800 mm starts excluding riders under about 5'6" from flat-footing at a signal. This single number causes more buyer regret than power or mileage.\n\n## 4. Compute cost per kilometre, not mileage\nAt ₹104.5 per litre, a 55 kmpl commuter costs about ₹1.90/km. A 35 kmpl 350cc costs about ₹2.99/km. Over 15,000 km a year that difference is roughly ₹16,000 — real money.\n\n## 5. Weigh the service network\nA brand with a workshop 3 km away beats a slightly better bike serviced 40 km away, every single time.\n\n## 6. Look at resale before you buy\nCommuters from established brands typically retain 55-65% of value after three years. Niche models fall faster. Our used-bike price estimator shows what three-year-old examples of the same model are being listed for today.\n\n## 7. Verify the paperwork\nInsist on the invoice, Form 20/21/22, insurance and a temporary registration receipt. Never take delivery against a verbal promise of paperwork.\n\nRun any shortlist through the Bikepick comparison tool — it flags the best value in each measured attribute rather than simply crowning the biggest number.` },
    { title: 'Electric scooter vs petrol scooter: the honest cost maths for 2026', slug: 'ev-vs-petrol-scooter-cost', category: 'ev_guide',
      excerpt: 'Where the break-even really sits once you include the price premium, charging losses and battery replacement risk.',
      body: `The EV pitch usually stops at "₹0.25 per kilometre". That number is true and incomplete.\n\n## Energy cost is genuinely much lower\nA 3 kWh scooter doing a realistic 95 km per charge uses about 0.032 kWh/km. At ₹8 per unit and 85% charging efficiency that is roughly ₹0.30/km. A 50 kmpl petrol scooter at ₹104.5/litre costs about ₹2.09/km. Over 800 km a month the saving is around ₹1,430.\n\n## The purchase premium is the real variable\nA comparable electric scooter often costs ₹35,000-₹50,000 more than the petrol equivalent. At ₹1,430 a month saved, that premium takes roughly 25-35 months to recover — sooner if you ride more than 800 km, later if you ride less.\n\n## Maintenance favours electric\nNo engine oil, no air filter, no clutch, no spark plug. Budget around ₹1,500 a year against ₹3,000-₹4,000 for petrol.\n\n## Battery replacement is the risk you must price in\nMost warranties cover 3 years or 30,000-50,000 km. A replacement pack is commonly ₹45,000-₹60,000. If you plan to keep the scooter eight years, put that into your maths honestly.\n\n## Charging access decides everything\nIf you can charge where you park, an EV is excellent. If you cannot, a removable-battery model is the only sensible electric choice.\n\nUse the Bikepick EV vs Petrol calculator with your own tariff, mileage and monthly distance. Every figure it produces is labelled as an estimate, because it is one.` },
    { title: 'Buying a used bike safely: the 12 checks that matter most', slug: 'used-bike-buying-checklist', category: 'used_bike_guide',
      excerpt: 'Chassis number matching, hypothecation status, insurance history and the odometer tells that experienced buyers look for.',
      body: `A used bike is only a bargain if the paperwork is clean and the wear is honest.\n\n## Documents\n1. **RC in the seller's name.** If not, walk away or complete the transfer first.\n2. **Chassis and engine number** physically matched against the RC — not photographed, matched.\n3. **Hypothecation.** If a loan was taken, insist on the bank NOC and Form 35.\n4. **Insurance** with claim history. Repeated claims suggest accident damage.\n5. **PUC certificate**, valid on the day of sale.\n6. **Service book** with stamps and dates that align with the odometer.\n\n## Mechanical\n7. **Cold start.** Always inspect a bike that has not been warmed up beforehand.\n8. **Chain and sprocket** wear — replacement is ₹2,000-₹4,000.\n9. **Tyre date codes**; rubber older than five years should be replaced regardless of tread.\n10. **Fork seals and rear shock** for leaks.\n11. **Frame alignment.** Look down the bike from behind for a twisted rear.\n12. **Battery and electricals**, especially on electric two-wheelers where a degraded pack is the single biggest cost.\n\n## What Bikepick verification does and does not mean\nA Trust Score on our used-bike listings reflects only checks that were actually performed and recorded. If a physical inspection has not happened, the listing says so. We never imply mechanical condition we have not verified.` },
    { title: 'ABS, CBS and combined braking explained for Indian riders', slug: 'abs-cbs-explained', category: 'technology_guide',
      excerpt: 'What single-channel actually protects, why dual-channel matters on wet roads, and when CBS is enough.',
      body: `## CBS (Combined Braking System)\nMandatory on Indian two-wheelers under 125cc. Pressing the rear brake also applies partial front braking. It shortens stopping distance for riders who instinctively grab only the rear lever. It cannot prevent a wheel from locking.\n\n## Single-channel ABS\nAlmost always fitted to the front wheel only. The front does 70-80% of stopping work, so this prevents the most dangerous type of lock-up. The rear can still lock and slide.\n\n## Dual-channel ABS\nBoth wheels monitored independently. This is what you want if you ride in rain, on diesel-slicked city roads, or at highway speeds. On bikes above 150cc it is worth paying for.\n\n## Switchable rear ABS\nFound on adventure bikes. Off-road, a locked rear wheel actually helps you stop on loose gravel, so being able to disable it is genuinely useful.\n\nIn the Bikepick comparison table, ABS is ranked qualitatively — dual-channel beats single-channel beats CBS beats none — rather than treated as a yes/no box.` },
    { title: 'Bike service costs in India: what you should actually budget', slug: 'bike-service-cost-guide', category: 'maintenance_guide',
      excerpt: 'Service intervals, consumables, and the five-year ownership figure nobody quotes you in the showroom.',
      body: `## Service intervals\nMost commuters call for service every 5,000-6,000 km; some now stretch to 10,000 km. Bigger engines usually mean shorter intervals and pricier consumables.\n\n## Typical periodic service cost\n- 100-125cc commuter: ₹450-₹650\n- 150-200cc: ₹850-₹1,200\n- 250-400cc: ₹1,500-₹2,500\n\n## Consumables over five years (approximate)\n- Tyres, one set: ₹4,000-₹9,000\n- Chain and sprocket kit: ₹2,000-₹4,500\n- Brake pads, two sets: ₹1,200-₹3,000\n- Battery: ₹1,500-₹3,000\n\n## Five-year total\nFor a 125cc commuter riding 12,000 km a year, budget roughly ₹28,000-₹35,000 in service and consumables. For a 350cc, ₹55,000-₹70,000 is realistic.\n\nThe maintenance pillar of the Bikepick Score uses the recorded service interval and estimated service cost, so a bike with a 10,000 km interval and ₹450 service scores above one needing ₹2,500 every 5,000 km.` },
    { title: 'How the Bikepick Score is calculated', slug: 'how-bikepick-score-works', category: 'buying_guide',
      excerpt: 'Seven weighted pillars, computed only from structured specifications and price. No advertiser can move it.',
      body: `Every product page shows a score out of 100. Here is exactly how it is produced.\n\n## The seven pillars and their default weights\n- Value for money — 20%\n- Features and technology — 15%\n- Performance — 15%\n- Safety — 15%\n- Running cost — 15%\n- Comfort and ergonomics — 10%\n- Maintenance — 10%\n\nAn administrator can change these weights, and the change applies to every product equally.\n\n## What feeds each pillar\nOnly structured database fields. Value compares price against the segment median and against power delivered per rupee. Safety ranks braking hardware and rider aids. Running cost uses recorded mileage or battery capacity against usable range. Nothing is hand-tuned per product.\n\n## Missing data is never invented\nIf a pillar has no supporting data it is dropped and the remaining weights are re-normalised. We also publish a coverage percentage so you can see how complete the underlying record is.\n\n## What can never influence the score\nAdvertising, featured placement, dealer subscription tier and affiliate relationships. There is no code path connecting monetisation to scoring, by design. Sponsored and featured content is always labelled as such.` },
  ];
  for (const a of ARTICLES) {
    await insert('articles', {
      id: uid('art'), title: a.title, slug: a.slug, excerpt: a.excerpt, content: a.body,
      category: a.category, author_id: adminId, author_name: 'Bikepick Editorial',
      reading_minutes: Math.max(3, Math.round(a.body.split(/\s+/).length / 200)),
      published: 1, published_at: nowIso(),
    });
  }
  console.log(`✓ ${ARTICLES.length} published guides`);

  /* ----------------------------- comparisons ----------------------------- */
  const findId = async (brand: string, model: string) =>
    (await db.get<any>(
      'SELECT p.id FROM products p JOIN brands b ON b.id = p.brand_id WHERE b.name = ? AND p.name = ?',
      [brand, model],
    ))?.id as string | undefined;

  const COMPARISONS = [
    { title: 'Yamaha MT-15 V2 vs TVS Apache RTR 160 4V vs Bajaj Pulsar N160', pairs: [['Yamaha', 'MT-15 V2'], ['TVS', 'Apache RTR 160 4V'], ['Bajaj', 'Pulsar N160']] },
    { title: 'Ather 450X vs Ola S1 Pro vs TVS iQube S', pairs: [['Ather', '450X'], ['Ola Electric', 'S1 Pro'], ['TVS', 'iQube S']] },
    { title: 'Honda Shine 125 vs Honda SP125 vs TVS Raider 125', pairs: [['Honda', 'Shine 125'], ['Honda', 'SP125'], ['TVS', 'Raider 125']] },
    { title: 'Royal Enfield Classic 350 vs Hunter 350', pairs: [['Royal Enfield', 'Classic 350'], ['Royal Enfield', 'Hunter 350']] },
    { title: 'Honda Activa 125 vs TVS Jupiter 125 vs Suzuki Access 125', pairs: [['Honda', 'Activa 125'], ['TVS', 'Jupiter 125'], ['Suzuki', 'Access 125']] },
    { title: 'KTM Duke 250 vs Suzuki Gixxer SF 250', pairs: [['KTM', 'Duke 250'], ['Suzuki', 'Gixxer SF 250']] },
  ];
  for (const c of COMPARISONS) {
    const ids = (await Promise.all(c.pairs.map(([b, m]) => findId(b, m)))).filter(Boolean) as string[];
    if (ids.length < 2) continue;
    await insert('comparisons', {
      id: uid('cmp'), slug: slugify(c.title), category_id: catIds.bikes,
      product_ids: JSON.stringify(ids), title: c.title,
      view_count: Math.floor(Math.random() * 900) + 100, featured: 1, created_by: adminId,
    });
  }
  console.log(`✓ ${COMPARISONS.length} popular comparisons`);

  /* ------------------------------- ad slots ------------------------------ */
  const SLOTS = [
    ['home_below_hero', 'Homepage — below hero', 'home', 'below_hero'],
    ['home_mid', 'Homepage — mid content', 'home', 'mid_content'],
    ['product_sidebar', 'Product page — sidebar', 'product', 'sidebar'],
    ['product_below_specs', 'Product page — below specifications', 'product', 'below_specs'],
    ['compare_below_table', 'Comparison — below table', 'compare', 'below_table'],
    ['used_list_inline', 'Used bikes — inline in results', 'used', 'inline'],
    ['article_mid', 'Article — mid content', 'article', 'mid_content'],
  ];
  for (const [slot_key, name, page_type, position] of SLOTS) {
    await insert('ad_slots', { id: uid('ads'), slot_key, name, page_type, position, enabled: 0, show_desktop: 1, show_mobile: 1, frequency: 1 });
  }

  /* ---------------------------- affiliate links --------------------------- */
  const ACCESSORIES = [
    ['Full-face ISI helmet', 'helmet', 2800], ['Bike body cover (water resistant)', 'cover', 650],
    ['Handlebar phone holder', 'phone_holder', 850], ['Universal top box 32L', 'top_box', 3200],
    ['Waterproof USB charger kit', 'usb_charger', 700], ['Tubeless tyre repair kit', 'tyres', 450],
  ];
  for (const [title, type, price] of ACCESSORIES) {
    await insert('affiliate_links', {
      id: uid('aff'), retailer: 'Demo Retailer', title, accessory_type: type,
      normal_url: 'https://example.com/product', affiliate_url: 'https://example.com/product?tag=bikepick-demo',
      price, commission_percent: 4, status: 'active',
    });
  }

  /* ----------------------------- data sources ---------------------------- */
  const SOURCES = [
    { name: 'Admin CSV / Excel import', slug: 'admin-csv', source_type: 'csv', trust_level: 'admin_verified', status: 'enabled', priority: 90, notes: 'Always available. Upload from Admin → Imports.' },
    { name: 'Manufacturer feed (configure endpoint)', slug: 'manufacturer-feed', source_type: 'api', trust_level: 'manufacturer', status: 'disabled', priority: 100, notes: 'Add the authorised endpoint and auth env key, then enable.' },
    { name: 'Partner price feed (configure endpoint)', slug: 'partner-price-feed', source_type: 'api', trust_level: 'partner_feed', status: 'disabled', priority: 80, schedule_cron: '0 3 * * *', notes: 'Nightly price refresh once a partner agreement is in place.' },
    { name: 'Manual admin entry', slug: 'manual-entry', source_type: 'manual', trust_level: 'admin_verified', status: 'enabled', priority: 70, notes: 'Products created directly in the admin panel.' },
  ];
  for (const s of SOURCES) await insert('data_sources', { id: uid('dsc'), category_id: catIds.bikes, ...s });

  /* ------------------------- sample revenue events ------------------------ */
  const STREAMS: [string, number][] = [
    ['dealer_lead', 49], ['dealer_lead', 49], ['dealer_lead', 49], ['subscription', 1499],
    ['subscription', 3999], ['affiliate', 112], ['affiliate', 96], ['finance_lead', 250],
    ['insurance_lead', 180], ['inspection', 799], ['featured_listing', 499], ['adsense', 320],
  ];
  for (let i = 0; i < STREAMS.length; i++) {
    const d = new Date(Date.now() - Math.floor(Math.random() * 28) * 86400000);
    await insert('revenue_events', {
      id: uid('rev'), stream: STREAMS[i][0], amount: STREAMS[i][1], currency: 'INR',
      reference_type: 'demo', note: 'Demo revenue event created by the seed script.',
      occurred_at: d.toISOString(),
    });
  }

  console.log('\n─────────────────────────────────────────────');
  console.log(' Seed complete. Demo accounts (change these!)');
  console.log('─────────────────────────────────────────────');
  console.log(' Admin      admin@bikepick.in      Admin@12345');
  console.log(' Moderator  moderator@bikepick.in  Mod@12345');
  console.log(' Verifier   verifier@bikepick.in   Verify@12345');
  console.log(' Dealer     dealer1@bikepick.in    Dealer@12345');
  console.log(' Buyer      rider@example.com      Rider@12345');
  console.log('─────────────────────────────────────────────');
}

main().catch((e) => { console.error(e); process.exit(1); });
