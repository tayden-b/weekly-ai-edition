/**
 * @weekly/pipeline — ingest → normalize → dedupe → classify → rank → extract
 * → draft → verify → emit → validate (PLAN.md §5.2).
 *
 * C5 lands the adapter interface and `RawItem`; A1–A10 the adapters;
 * P1 the normalize + dedupe stages; P2–P7 the rest. `PIPELINE_STAGES`
 * keeps the canonical order.
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

// C5 — the source-adapter contract
export {
  adapterContext,
  type AdapterContext,
  type AdapterHealth,
  EXCERPT_MAX_CHARS,
  type Fetcher,
  type FetchWindow,
  type RawItem,
  type RawItemEngagement,
  type RawItemIssue,
  RawItemValidationError,
  type SourceAdapter,
  toExcerpt,
  UA_CONTACT_URL,
  UA_PRODUCT,
  USER_AGENT,
  userAgent,
  isRawItem,
  validateRawItem,
} from "./adapter.js";

// C5 — config loaders for config/{sources,companies,markets}
export {
  type CompanyEntry,
  ConfigValidationError,
  loadCompaniesConfig,
  loadMarketsConfig,
  loadSourcesConfig,
  type MarketsConfig,
  type MarketTicker,
  PAGE_IDS,
  type PageId,
  parseCompaniesConfig,
  parseMarketsConfig,
  parseSourcesConfig,
  type SourceEntry,
  type SourceMode,
  type SourceTier,
} from "./config.js";

// C5 — adapter test harness (fixtures, no network)
export {
  type AdapterFixture,
  type AdapterFixtureRun,
  FIXTURE_NOW,
  loadAdapterFixture,
  type RecordedResponse,
  replayFetcher,
  type RunAdapterFixtureOptions,
  runAdapterFixture,
  UnrecordedRequestError,
} from "./testing/harness.js";

// C5 — reference adapter proving the contract
export {
  createFixtureAdapter,
  FIXTURE_ADAPTER_ID,
  type FixtureAdapterOptions,
} from "./sources/fixture.js";

// P1 — normalize + dedupe stages (PLAN §5.2)
export {
  type AdapterRawItem,
  canonicalizeUrl,
  type NormalizeOptions,
  type NormalizedItem,
  normalize,
  normalizeItem,
  normalizePublisher,
  normalizeTimestamp,
  publisherKey,
  titleKey,
  TRACKING_PARAM_PREFIXES,
  TRACKING_PARAMS,
  UNWRAP_PARAMS,
} from "./stages/normalize.js";
export {
  type ClusterSource,
  clusterSources,
  dedupe,
  type DedupeOptions,
  DEFAULT_SIMHASH_THRESHOLD,
  hammingDistance,
  type ItemCluster,
  simhash,
  SIMHASH_BITS,
  SIMHASH_SHINGLE,
} from "./stages/dedupe.js";

// A4 — SEC EDGAR adapter (Form D / S-1 / 8-K; funding + deals pages)
export {
  createSecEdgarAdapter,
  DEFAULT_EDGAR_AI_TERMS,
  DEFAULT_EDGAR_FORMS,
  EDGAR_CONTACT,
  EDGAR_PUBLISHER,
  EDGAR_USER_AGENT,
  edgarIndexUrl,
  edgarUserAgent,
  SEC_EDGAR_ADAPTER_ID,
  type SecEdgarAdapterOptions,
} from "./sources/sec-edgar.js";
