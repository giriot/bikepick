-- A staff member must always record WHY an account was suspended.
-- The reason is shown to the affected user and stored in the audit log.
ALTER TABLE users ADD COLUMN suspension_reason TEXT;
