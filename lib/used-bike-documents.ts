export const USED_BIKE_DOCUMENT_TYPES = [
  ['rc', 'RC'],
  ['insurance', 'Insurance'],
  ['identity', 'ID card'],
  ['loan_noc', 'Loan / NOC'],
  ['service_history', 'Service history'],
  ['other', 'Others'],
] as const;

export type UsedBikeDocumentType = typeof USED_BIKE_DOCUMENT_TYPES[number][0];

export function usedBikeDocumentLabel(type: string): string {
  return USED_BIKE_DOCUMENT_TYPES.find(([value]) => value === type)?.[1] || type.replace(/_/g, ' ');
}
