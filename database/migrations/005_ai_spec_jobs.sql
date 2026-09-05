-- AI specification-fill queue.
-- One row per product that needs its model-level spec sheet completed.
-- Durable on purpose: a Gemini 429 (quota) must not lose the request, it marks
-- the job 'deferred' with a next_run_at and a later tick retries it.
-- Portable subset (Postgres + SQLite): TEXT ids, TEXT ISO-8601 timestamps.
CREATE TABLE IF NOT EXISTS ai_spec_jobs (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  -- queued -> running -> applied | deferred (retry later) | failed | skipped
  status TEXT NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 8,
  next_run_at TEXT NOT NULL,
  -- set while a worker owns the row; cleared on completion. Prevents two
  -- overlapping invocations applying the same product twice.
  claim_token TEXT,
  last_error TEXT,
  provider TEXT,
  missing_before INTEGER NOT NULL DEFAULT 0,
  fields_filled INTEGER NOT NULL DEFAULT 0,
  -- JSON arrays/objects kept for transparency + a manual undo path.
  filled_keys TEXT,
  previous_values TEXT,
  -- spec keys the model offered but we refused to auto-write (see SPEC_WRITE_DENY):
  -- invented-looking figures stay visible for a human instead of hitting the site.
  suggested_keys TEXT,
  requested_by TEXT REFERENCES users(id),
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_aispec_due ON ai_spec_jobs(status, next_run_at);
CREATE INDEX IF NOT EXISTS idx_aispec_product ON ai_spec_jobs(product_id);
