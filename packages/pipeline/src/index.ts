/**
 * @weekly/pipeline — ingest → normalize → dedupe → classify → rank → extract
 * → draft → verify → emit → validate (PLAN.md §5.2).
 *
 * C5 lands the adapter interface and `RawItem`; A1–A10 the adapters;
 * P1–P7 the stages. Until then this exports the canonical stage order.
 */

export const PIPELINE_STAGES = [
  "ingest",
  "normalize",
  "dedupe",
  "classify",
  "rank",
  "extract",
  "draft",
  "verify",
  "emit",
  "validate",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];
