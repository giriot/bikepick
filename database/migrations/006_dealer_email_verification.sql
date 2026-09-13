-- Dealer email must be verified before the dealer dashboard can be used.
ALTER TABLE dealer_profiles ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;
-- Existing verified dealers have already passed the site's business review; do not lock them out.
UPDATE dealer_profiles SET email_verified = 1 WHERE status = 'verified';
