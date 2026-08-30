-- Notification preferences per user. Added separately so existing installs upgrade cleanly.
ALTER TABLE users ADD COLUMN notify_email INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN notify_sms INTEGER NOT NULL DEFAULT 0;
