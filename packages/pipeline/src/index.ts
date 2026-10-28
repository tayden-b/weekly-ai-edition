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
