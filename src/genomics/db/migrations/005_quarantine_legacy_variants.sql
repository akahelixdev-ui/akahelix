-- Migration 005: Quarantine Mismatched Legacy Records
-- Flags 13 legacy variants identified during Phase 02 audit with mismatched VCV accessions
-- or coordinates, excluding them from public queries until superseded by verified ClinVar records.

UPDATE genomics.variants
SET is_quarantined = true,
    is_published = false,
    review_status = 'quarantined',
    quarantine_reason = 'Mismatched ClinVar VCV accession and legacy coordinates identified in Phase 02 audit - superseded by authoritative ClinVar VCV remediation.',
    updated_at = NOW()
WHERE clinvar_vcv IN (
  'VCV000007108',
  'VCV000007109',
  'VCV000015147',
  'VCV000015170',
  'VCV000015173',
  'VCV000015383',
  'VCV000015387',
  'VCV000015405',
  'VCV000015408',
  'VCV000015410',
  'VCV000017658',
  'VCV000017660',
  'VCV000029780'
);

INSERT INTO genomics.audit_logs (actor_email, action, entity_type, entity_id, details)
VALUES (
  'audit@akahelix.com',
  'QUARANTINE_LEGACY_MISMATCHED_RECORDS',
  'system',
  'phase03_remediation',
  '{"reason": "13 legacy variants quarantined due to mismatched ClinVar VCV accessions and inaccurate coordinate offsets flagged in Phase 02 audit", "count": 13}'::jsonb
);
