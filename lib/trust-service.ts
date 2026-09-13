import 'server-only';
import { db, nowIso } from './db';
import { computeTrust, DEFAULT_TRUST_WEIGHTS, REQUIRED_ANGLES, type TrustWeights } from './trust';
import { getJsonSetting } from './settings';

/**
 * Recalculates a used listing's trust score from the checks, photos and
 * declared information that exist right now. Called whenever a verification
 * record changes or a listing moves through the workflow.
 */
export interface ApprovalReadiness {
  ok: boolean;
  message?: string;
  missingChecks: string[];
  missingDocuments: string[];
}

export interface ApprovalReadinessOptions {
  /** Used only by the explicit, admin-only publish exception. */
  allowMissingDocuments?: boolean;
}

/**
 * Publishing is a deliberate workflow transition, not just a status dropdown.
 * The normal gate requires the core documents, every required check and all
 * required photo angles. An explicit admin-only exception may waive documents,
 * but never verification checks or photos.
 */
export async function getUsedBikeApprovalReadiness(
  usedBikeId: string,
  options: ApprovalReadinessOptions = {},
): Promise<ApprovalReadiness> {
  const bike = await db.get<any>('SELECT loan_status FROM used_bikes WHERE id = ?', [usedBikeId]);
  if (!bike) return { ok: false, message: 'Listing not found', missingChecks: [], missingDocuments: [] };

  const [checks, documents, images] = await Promise.all([
    db.all<any>("SELECT check_type, result FROM verification_records WHERE entity_type='used_bike' AND entity_id = ?", [usedBikeId]),
    db.all<any>('SELECT doc_type, status FROM used_bike_documents WHERE used_bike_id = ?', [usedBikeId]),
    db.all<any>('SELECT id, angle FROM used_bike_images WHERE used_bike_id = ?', [usedBikeId]),
  ]);

  const requiredChecks = [
    'seller_identity', 'ownership_declaration', 'rc_verification',
    'insurance_verification', 'loan_status', 'service_history',
  ];
  const missingChecks = requiredChecks.filter((type) => !checks.some((check) => check.check_type === type && check.result === 'passed'));
  const requiredDocuments = ['identity', 'rc', 'insurance'];
  if (bike.loan_status === 'loan_closed_noc') requiredDocuments.push('loan_noc');
  const missingDocuments = requiredDocuments.filter((type) => !documents.some((document) => document.doc_type === type && document.status === 'approved'));

  const missingAngles = REQUIRED_ANGLES.filter((angle) => !images.some((image) => image.angle === angle));
  if (missingAngles.length) {
    missingChecks.push(`required photos: ${missingAngles.join(', ')}`);
  }

  const documentsBlock = missingDocuments.length > 0 && !options.allowMissingDocuments;
  if (missingChecks.length || documentsBlock) {
    const parts: string[] = [];
    if (documentsBlock) parts.push(`approved documents: ${missingDocuments.join(', ')}`);
    if (missingChecks.length) parts.push(`passed checks: ${missingChecks.join(', ')}`);
    return {
      ok: false,
      message: `Cannot publish yet. Complete ${parts.join('; ')}.`,
      missingChecks,
      missingDocuments,
    };
  }

  return { ok: true, missingChecks: [], missingDocuments };
}

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
