CREATE TABLE IF NOT EXISTS mobile_visit_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID NOT NULL REFERENCES visits(id),
  operation_id UUID NOT NULL,
  created_by TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'image/jpeg',
  bytes INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(visit_id, operation_id)
);
CREATE INDEX IF NOT EXISTS idx_mobile_visit_photos_visit ON mobile_visit_photos(visit_id);