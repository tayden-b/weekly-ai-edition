/**
 * @weekly/pipeline — ingest → normalize → dedupe → classify → rank → extract
 * → draft → verify → emit → validate (PLAN.md §5.2).
 *
 * C5 lands the adapter interface and `RawItem`; A1–A10 the adapters;
 * P1 the normalize + dedupe stages; P2–P7 the rest. `PIPELINE_STAGES`
 * keeps the canonical order. Stages landed so far: P1, P2, P3, P4, P5, P6.
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

// P2 — rank stage (PLAN §5.2)
export {
  configuredWeight,
  DEFAULT_PUBLISHER_WEIGHT,
  ENGAGEMENT_FIELDS,
  ENGAGEMENT_SATURATION,
  rank,
  type RankedCluster,
  type RankOptions,
  RECENCY_HALF_LIFE_DAYS,
  RECENCY_UNPARSEABLE,
  type ScoreBreakdown,
  type WeightLookup,
} from "./stages/rank.js";

// P4 — classify stage (PLAN §5.2; judgement via the llm() seam)
export {
  applyClassification,
  buildClassificationRequest,
  buildCompanyResolver,
  type ClassificationCompanyRef,
  ClassificationContractError,
  type ClassificationRequest,
  type ClassificationRequestItem,
  type ClassificationResponse,
  type ClassifiedCluster,
  type ClassifiedItem,
  classify,
  CLASSIFY_CONFIDENCE_THRESHOLD,
  CLASSIFY_PAGE_IDS,
  CLASSIFY_PROMPT_VERSION,
  type ClassifyOptions,
  type ClassifyPage,
  clusterPublishers,
  companyKey,
  type ItemClassification,
  type ItemPage,
  renderClassifyPrompt,
  resolveCompanySlug,
  UNSORTED,
} from "./stages/classify.js";

// P5 — extract stage (PLAN §5.2; §5.3 evidence spans, llm() seam for gaps)
export {
  applyExtraction,
  assertExtractionResponse,
  buildExtractionRequest,
  EXTRACT_FIELD_NAMES,
  EXTRACT_PAGES,
  EXTRACT_PROMPT_VERSION,
  type ExtractedCluster,
  type ExtractedField,
  type ExtractFieldName,
  type ExtractFieldValue,
  extract,
  type ExtractionContractError,
  type ExtractionDrop,
  type ExtractionDropReason,
  type ExtractionEvidence,
  type ExtractionRequest,
  type ExtractionRequestItem,
  type ExtractionResponse,
  type ExtractionResponseField,
  type ExtractionResponseItem,
  type ExtractionSourceRef,
  type ExtractOptions,
  type ExtractPage,
  FIELD_VALUE_TYPE,
  isExtractPage,
  type ItemExtraction,
  normalizeStage,
  PAGE_FIELD_SPECS,
  type PageFieldSpec,
  parseUsdAmount,
  regexExtract,
  regexExtractCandidates,
  renderExtractPrompt,
} from "./stages/extract.js";

// P6 — draft stage (PLAN §5.2; one-liners + Briefing via the llm() seam)
export {
  applyDraft,
  assertDraftResponse,
  bannedHits,
  bannedOpeningHit,
  bannedOpeningsFromStyle,
  bannedTermsFromStyle,
  BRIEFING_MAX_SENTENCES,
  BRIEFING_MIN_SENTENCES,
  type BriefingDraft,
  buildDraftRequest,
  canonNumber,
  clusterSourceText,
  draft,
  DRAFT_PAGES,
  DRAFT_PROMPT_VERSION,
  DraftContractError,
  type DraftedCluster,
  type DraftDrop,
  type DraftMono,
  type DraftOptions,
  type DraftOutput,
  type DraftPage,
  type DraftRequest,
  type DraftRequestItem,
  type DraftResponse,
  type DraftResponseItem,
  type DraftSourceRef,
  type DraftCompanyRef,
  FUNDING_HEADLINE_RE,
  fundingCompany,
  fundingHeadline,
  isDraftPage,
  type ItemDraft,
  normalizeTake,
  numberTokens,
  numberTraced,
  ONE_LINER_MAX_CHARS,
  PAGE_ITEM_CAPS,
  proseKey,
  quotedSpans,
  renderDraftPrompt,
  rubricCheck,
  type RubricCheckResult,
  type RubricReport,
  type RubricStatus,
  splitSentences,
  styleRulesFromStyleMd,
  type StyleRules,
} from "./stages/draft.js";

// P4 — the llm() seam: session hand-off files + deterministic replay (PLAN §8)
export {
  CLASSIFY_PROMPT_PATH,
  classificationPaths,
  createReplayDrafter,
  createReplayDrafterFromFile,
  createReplayExtractor,
  createReplayExtractorFromFile,
  createReplayLlm,
  createReplayLlmFromFile,
  createSessionDrafter,
  createSessionExtractor,
  createSessionLlm,
  DRAFT_PROMPT_PATH,
  type DraftLlm,
  draftPaths,
  EXTRACT_PROMPT_PATH,
  type ExtractLlm,
  extractionPaths,
  type Llm,
  readClassificationResponse,
  readDraftResponse,
  readExtractionResponse,
  SESSION_LLM_POLL_MS,
  SESSION_LLM_TIMEOUT_MS,
  type SessionDrafterOptions,
  type SessionExtractorOptions,
  type SessionLlmOptions,
  writeClassificationRequest,
  writeDraftRequest,
  writeExtractionRequest,
} from "./llm.js";

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

// A2 — HN Algolia (Launches + Discourse)
export {
  compileAiTermMatcher,
  createHnAlgoliaAdapter,
  HN_ADAPTER_ID,
  HN_AI_TERMS,
  HN_API_BASE,
  type HnAdapterOptions,
} from "./sources/hn.js";

// A3 — newsroom RSS set (Launches / Deals / Discourse, PLAN §5.1)
export {
  createNewsroomAdapter,
  NEWSROOM_ADAPTER_ID,
  type NewsroomAdapterOptions,
  type NewsroomFeed,
  newsroomFeedsFromSources,
} from "./sources/newsrooms.js";

// A5 — press-wire RSS: Money + Deals wires, funding feeds, corroboration
export {
  createPressWireAdapter,
  htmlToPlainText,
  parseWireFeed,
  PRESS_WIRE_ADAPTER_ID,
  pressWireAdapterFromEntry,
  type PressWireOptions,
} from "./sources/press-wires.js";

// A6 — Product Hunt + GitHub Releases + HF Hub adapters
export {
  createGitHubReleasesAdapter,
  GITHUB_RELEASES_ADAPTER_ID,
  type GitHubReleasesAdapterOptions,
  repoFromReleasesEndpoint,
} from "./sources/github-releases.js";
export {
  createHfHubAdapter,
  HF_HUB_ADAPTER_ID,
  HF_HUB_API_ENDPOINT,
  type HfHubAdapterOptions,
} from "./sources/hf-hub.js";
export {
  createProductHuntAdapter,
  PRODUCT_HUNT_ADAPTER_ID,
  PRODUCT_HUNT_DEFAULT_TOPICS,
  PRODUCT_HUNT_ENDPOINT,
  PRODUCT_HUNT_TOKEN_ENV,
  type ProductHuntAdapterOptions,
} from "./sources/product-hunt.js";

// A9 — Reddit public listing JSON (discourse page)
export {
  createRedditAdapter,
  REDDIT_ADAPTER_ID,
  redditAdapterFromEntry,
  type RedditAdapterOptions,
  subredditFromEndpoint,
} from "./sources/reddit-json.js";

// A10 — distribute.software adapter (secondary; models + launches pages)
export {
  createDistributeAdapter,
  DISTRIBUTE_ADAPTER_ID,
  DISTRIBUTE_DEFAULT_LIMIT,
  DISTRIBUTE_PUBLISHER,
  type DistributeAdapterOptions,
} from "./sources/distribute.js";

// A8 — market data adapter (weekly close of the markets.json basket)
export {
  createMarketsAdapter,
  MARKETS_ADAPTER_ID,
  MARKETS_PUBLISHER,
  type MarketCsvSlice,
  type MarketsAdapterOptions,
  parseWeeklyBars,
  STOOQ_WEEKLY_PROVIDER,
} from "./sources/markets.js";

// A7 — benchmark publishers (Performance, PLAN §5.1)
export {
  BENCHMARK_SOURCES,
  BENCHMARKS_ADAPTER_ID,
  type BenchmarkSourceSpec,
  type BenchmarksAdapterOptions,
  createBenchmarksAdapter,
  linkModeItem,
  mapSwebenchPage,
} from "./sources/benchmarks.js";

// A7 — arXiv lab-org papers (Performance, PLAN §5.1)
export {
  ARXIV_ADAPTER_ID,
  ARXIV_API_BASE,
  ARXIV_CATEGORIES,
  ARXIV_SEARCH_ORGS,
  type ArxivAdapterOptions,
  arxivIdOf,
  createArxivAdapter,
} from "./sources/arxiv.js";

// A1 — lab blogs (Models & Releases row, §5.1)
export {
  createLabBlogsAdapter,
  LAB_BLOGS_ADAPTER_ID,
  type LabBlogsAdapter,
  type LabBlogsAdapterOptions,
  type SourceRunReport,
} from "./sources/lab-blogs.js";

// P3 — ingest orchestrator: config → parallel adapter runs → data/raw cache
export {
  INGEST_DEFAULT_DAYS,
  type IngestDeps,
  type IngestManifest,
  type IngestRun,
  type IngestSourceFile,
  type IngestSourceRecord,
  ingestWindowForDate,
  manifestFor,
  type RunIngestOptions,
  runIngest,
  sourceAdapterFromEntry,
  writeIngestCache,
} from "./ingest.js";
