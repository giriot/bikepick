import 'server-only';
import { db, nowIso } from './db';
import { computeTrust, DEFAULT_TRUST_WEIGHTS, type TrustWeights } from './trust';
import { getJsonSetting } from './settings';

/**
 * Recalculates a used listing's trust score from the checks, photos and
 * declared information that exist right now. Called whenever a verification
 * record changes or a listing moves through the workflow.
 */
export async function recomputeTrust(usedBikeId: string) {
  const bike = await db.get<any>('SELECT * FROM used_bikes WHERE id = ?', [usedBikeId]);
  if (!bike) return null;

  const [checks, images, weights] = await Promise.all([
    db.all<any>("SELECT check_type, result FROM verification_records WHERE entity_type='used_bike' AND entity_id = ?", [usedBikeId]),
    db.all<any>('SELECT angle FROM used_bike_images WHERE used_bike_id = ?', [usedBikeId]),
    getJsonSetting<TrustWeights>('trust_weights', DEFAULT_TRUST_WEIGHTS),
  ]);

  const trust = computeTrust(
    {
      checks,
      photoAngles: images.map((i) => i.angle),
      infoFields: {
        insurance_status: bike.insurance_status, rc_available: bike.rc_available,
        loan_status: bike.loan_status, service_history: bike.service_history,
        accident_history: bike.accident_history, tyre_condition: bike.tyre_condition,
        description: bike.description,
      },
    },
    weights,
  );

  await db.run('UPDATE used_bikes SET trust_score=?, trust_band=?, trust_breakdown=?, updated_at=? WHERE id=?',
    [trust.score, trust.band, JSON.stringify(trust), nowIso(), usedBikeId]);

  return trust;
}
