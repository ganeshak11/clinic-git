/**
 * Cypher constraint definitions for the ClinicalGit schema.
 * Run once against a fresh database to set up uniqueness constraints.
 * All IDs are string (invariant — coding-standards.md).
 */
export const SCHEMA_CONSTRAINTS = [
  'CREATE CONSTRAINT patient_id_unique IF NOT EXISTS FOR (p:Patient) REQUIRE p.id IS UNIQUE',
  'CREATE CONSTRAINT fact_id_unique IF NOT EXISTS FOR (f:Fact) REQUIRE f.id IS UNIQUE',
  'CREATE CONSTRAINT interpretation_id_unique IF NOT EXISTS FOR (i:Interpretation) REQUIRE i.id IS UNIQUE',
  'CREATE CONSTRAINT doctor_id_unique IF NOT EXISTS FOR (d:Doctor) REQUIRE d.id IS UNIQUE',
  'CREATE CONSTRAINT branch_id_unique IF NOT EXISTS FOR (b:Branch) REQUIRE b.id IS UNIQUE',
  'CREATE CONSTRAINT decision_id_unique IF NOT EXISTS FOR (dec:Decision) REQUIRE dec.id IS UNIQUE',
];

export const SCHEMA_INDEXES = [
  'CREATE INDEX interp_patient IF NOT EXISTS FOR (i:Interpretation) ON (i.patientId)',
  'CREATE INDEX decision_patient IF NOT EXISTS FOR (d:Decision) ON (d.patientId)',
  'CREATE INDEX fact_patient IF NOT EXISTS FOR (f:Fact) ON (f.patientId)',
  'CREATE TEXT INDEX patient_name IF NOT EXISTS FOR (p:Patient) ON (p.name)',
];
