/**
 * The `llm()` seam (PLAN §8) — the only way a pipeline stage asks for
 * judgement. A seam is a minimal typed interface, never an SDK call:
 *
 *   interface Llm {
 *     classify(request: ClassificationRequest): Promise<ClassificationResponse>;
 *   }
 *
 * Two implementations:
 *
 *  - `session` — the running Devin session is the model (PLAN §8: no external
 *    LLM API, no key). `createSessionLlm` writes the hand-off files the
 *    prompt contract documents —
 *
 *        <dir>/classification.request.json   the batch (this file writes it)
 *        <dir>/classification.prompt.md      the rendered versioned prompt
 *        <dir>/classification.response.json  the session's judgement (the
 *                                            session writes it)
 *
 *    then polls for the response file until `timeoutMs`. A build's driver
 *    script can also split the hand-off across two invocations with
 *    `writeClassificationRequest` / `readClassificationResponse` directly —
 *    same file names, same contract.
 *
 *  - `replay` — `createReplayLlm` returns a recorded response verbatim, which
 *    makes every LLM stage deterministic in tests and CI. P4's accuracy
 *    harness replays `testdata/classification/classification.response.json`.
 *
 * P5 (extract) and P6 (draft) reuse this pattern: their own request/response
 * types and a `prompts/<stage>.prompt.md`, with the same session/replay
 * mechanics — a stage never cares which implementation answers. P5's seam
 * (`ExtractLlm` + `createSessionExtractor`/`createReplayExtractor` below)
 * uses the same file contract with `extraction.{request,response,prompt}.*`
 * names.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  type ClassificationRequest,
  type ClassificationResponse,
  renderClassifyPrompt,
} from "./stages/classify.js";
import {
  type DraftRequest,
  type DraftResponse,
  renderDraftPrompt,
} from "./stages/draft.js";
import {
  type ExtractionRequest,
  type ExtractionResponse,
  renderExtractPrompt,
} from "./stages/extract.js";

// ---------------------------------------------------------------------------
// The seam
// ---------------------------------------------------------------------------

/** The `classify` judgement call — session or replay behind one signature. */
export interface Llm {
  classify(request: ClassificationRequest): Promise<ClassificationResponse>;
}

/** Path of the versioned classify prompt (shipped with the package source). */
export const CLASSIFY_PROMPT_PATH = fileURLToPath(
  new URL("../prompts/classify.prompt.md", import.meta.url),
);

// ---------------------------------------------------------------------------
// Hand-off files (`classification.{request,response,prompt}.{json,md}`)
// ---------------------------------------------------------------------------

/** The canonical file names of the session hand-off in a directory. */
export function classificationPaths(dir: string): {
  requestPath: string;
  responsePath: string;
  promptPath: string;
} {
  return {
    requestPath: join(dir, "classification.request.json"),
    responsePath: join(dir, "classification.response.json"),
    promptPath: join(dir, "classification.prompt.md"),
  };
}

/**
 * Write the request half of the hand-off: `classification.request.json`
 * plus the rendered `classification.prompt.md` (when `promptTemplate` is
 * given — the session reads it next to the request). Returns the paths.
 */
export function writeClassificationRequest(
  dir: string,
  request: ClassificationRequest,
  promptTemplate?: string,
): ReturnType<typeof classificationPaths> {
  mkdirSync(dir, { recursive: true });
  const paths = classificationPaths(dir);
  writeFileSync(paths.requestPath, `${JSON.stringify(request, null, 2)}\n`);
  if (promptTemplate !== undefined) {
    writeFileSync(paths.promptPath, renderClassifyPrompt(promptTemplate, request));
  }
  return paths;
}

/** Read `classification.response.json` — contract-checked downstream. */
export function readClassificationResponse(dir: string): ClassificationResponse {
  const { responsePath } = classificationPaths(dir);
  return JSON.parse(readFileSync(responsePath, "utf8")) as ClassificationResponse;
}

// ---------------------------------------------------------------------------
// session implementation — the Devin session fills the response file
// ---------------------------------------------------------------------------

export interface SessionLlmOptions {
  /** Directory the hand-off files are written into (created if needed). */
  dir: string;
  /**
   * Prompt template text. When omitted, `CLASSIFY_PROMPT_PATH` is read —
   * keep the default so the prompt's version stays the single source of
   * truth for `prompt_version`.
   */
  promptTemplate?: string;
  /** Response-file poll interval. Default `SESSION_LLM_POLL_MS`. */
  pollMs?: number;
  /**
   * How long to wait for `classification.response.json` before throwing.
   * Default `SESSION_LLM_TIMEOUT_MS` — generous: the session judges by hand.
   */
  timeoutMs?: number;
}

/** Response-file poll interval for the session seam. */
export const SESSION_LLM_POLL_MS = 2_000;
/** Default wait for the session's response file: 30 minutes. */
export const SESSION_LLM_TIMEOUT_MS = 30 * 60_000;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * `session` mode: write the request (+ rendered prompt) to `dir`, then wait
 * for the Devin session to write `classification.response.json` there.
 */
export function createSessionLlm(opts: SessionLlmOptions): Llm {
  const pollMs = opts.pollMs ?? SESSION_LLM_POLL_MS;
  const timeoutMs = opts.timeoutMs ?? SESSION_LLM_TIMEOUT_MS;
  const promptTemplate =
    opts.promptTemplate ?? readFileSync(CLASSIFY_PROMPT_PATH, "utf8");
  return {
    async classify(request: ClassificationRequest): Promise<ClassificationResponse> {
      const { responsePath } = writeClassificationRequest(opts.dir, request, promptTemplate);
      const deadline = Date.now() + timeoutMs;
      while (!existsSync(responsePath)) {
        if (Date.now() > deadline) {
          throw new Error(
            `timed out waiting for ${responsePath} — the session must write ` +
              `${basename(responsePath)} to continue`,
          );
        }
        await sleep(pollMs);
      }
      return readClassificationResponse(opts.dir);
    },
  };
}

// ---------------------------------------------------------------------------
// replay implementation — a recorded response, verbatim
// ---------------------------------------------------------------------------

/**
 * `replay` mode: always return `response` — the recorded judgement — for any
 * request. The stage still contract-checks it, so a recording made against a
 * different request fails loudly instead of mislabeling silently.
 */
export function createReplayLlm(response: ClassificationResponse): Llm {
  return {
    classify: async () => response,
  };
}

/** `replay` from a recorded `classification.response.json` file. */
export function createReplayLlmFromFile(path: string): Llm {
  return createReplayLlm(
    JSON.parse(readFileSync(path, "utf8")) as ClassificationResponse,
  );
}

// ---------------------------------------------------------------------------
// P5 — the extract seam (`extraction.{request,response,prompt}.{json,md}`)
// ---------------------------------------------------------------------------

/** The `extract` judgement call — session or replay behind one signature. */
export interface ExtractLlm {
  extract(request: ExtractionRequest): Promise<ExtractionResponse>;
}

/** Path of the versioned extract prompt (shipped with the package source). */
export const EXTRACT_PROMPT_PATH = fileURLToPath(
  new URL("../prompts/extract.prompt.md", import.meta.url),
);

/** The canonical file names of the extraction session hand-off. */
export function extractionPaths(dir: string): {
  requestPath: string;
  responsePath: string;
  promptPath: string;
} {
  return {
    requestPath: join(dir, "extraction.request.json"),
    responsePath: join(dir, "extraction.response.json"),
    promptPath: join(dir, "extraction.prompt.md"),
  };
}

/**
 * Write the request half of the extraction hand-off: `extraction.request.json`
 * plus the rendered `extraction.prompt.md` (when `promptTemplate` is given).
 */
export function writeExtractionRequest(
  dir: string,
  request: ExtractionRequest,
  promptTemplate?: string,
): ReturnType<typeof extractionPaths> {
  mkdirSync(dir, { recursive: true });
  const paths = extractionPaths(dir);
  writeFileSync(paths.requestPath, `${JSON.stringify(request, null, 2)}\n`);
  if (promptTemplate !== undefined) {
    writeFileSync(paths.promptPath, renderExtractPrompt(promptTemplate, request));
  }
  return paths;
}

/** Read `extraction.response.json` — contract-checked downstream. */
export function readExtractionResponse(dir: string): ExtractionResponse {
  const { responsePath } = extractionPaths(dir);
  return JSON.parse(readFileSync(responsePath, "utf8")) as ExtractionResponse;
}

export interface SessionExtractorOptions {
  /** Directory the hand-off files are written into (created if needed). */
  dir: string;
  /** Prompt template text — defaults to `EXTRACT_PROMPT_PATH` so the shipped
   *  prompt's version stays the single source of truth. */
  promptTemplate?: string;
  /** Response-file poll interval. Default `SESSION_LLM_POLL_MS`. */
  pollMs?: number;
  /** Wait for `extraction.response.json` before throwing. Default 30 min. */
  timeoutMs?: number;
}

/**
 * `session` mode for extract: write the request (+ rendered prompt) to `dir`,
 * then wait for the Devin session to write `extraction.response.json` there.
 */
export function createSessionExtractor(opts: SessionExtractorOptions): ExtractLlm {
  const pollMs = opts.pollMs ?? SESSION_LLM_POLL_MS;
  const timeoutMs = opts.timeoutMs ?? SESSION_LLM_TIMEOUT_MS;
  const promptTemplate =
    opts.promptTemplate ?? readFileSync(EXTRACT_PROMPT_PATH, "utf8");
  return {
    async extract(request: ExtractionRequest): Promise<ExtractionResponse> {
      const { responsePath } = writeExtractionRequest(opts.dir, request, promptTemplate);
      const deadline = Date.now() + timeoutMs;
      while (!existsSync(responsePath)) {
        if (Date.now() > deadline) {
          throw new Error(
            `timed out waiting for ${responsePath} — the session must write ` +
              `${basename(responsePath)} to continue`,
          );
        }
        await sleep(pollMs);
      }
      return readExtractionResponse(opts.dir);
    },
  };
}

/** `replay` mode for extract: always return the recorded response verbatim. */
export function createReplayExtractor(response: ExtractionResponse): ExtractLlm {
  return {
    extract: async () => response,
  };
}

/** `replay` from a recorded `extraction.response.json` file. */
export function createReplayExtractorFromFile(path: string): ExtractLlm {
  return createReplayExtractor(
    JSON.parse(readFileSync(path, "utf8")) as ExtractionResponse,
  );
}

// ---------------------------------------------------------------------------
// P6 — the draft seam (`draft.{request,response,prompt}.{json,md}`)
// ---------------------------------------------------------------------------

/** The `draft` judgement call — session or replay behind one signature. */
export interface DraftLlm {
  draft(request: DraftRequest): Promise<DraftResponse>;
}

/** Path of the versioned draft prompt (shipped with the package source). */
export const DRAFT_PROMPT_PATH = fileURLToPath(
  new URL("../prompts/draft.prompt.md", import.meta.url),
);

/** The canonical file names of the draft session hand-off. */
export function draftPaths(dir: string): {
  requestPath: string;
  responsePath: string;
  promptPath: string;
} {
  return {
    requestPath: join(dir, "draft.request.json"),
    responsePath: join(dir, "draft.response.json"),
    promptPath: join(dir, "draft.prompt.md"),
  };
}

/**
 * Write the request half of the draft hand-off: `draft.request.json` plus
 * the rendered `draft.prompt.md` (when `promptTemplate` is given).
 */
export function writeDraftRequest(
  dir: string,
  request: DraftRequest,
  promptTemplate?: string,
): ReturnType<typeof draftPaths> {
  mkdirSync(dir, { recursive: true });
  const paths = draftPaths(dir);
  writeFileSync(paths.requestPath, `${JSON.stringify(request, null, 2)}\n`);
  if (promptTemplate !== undefined) {
    writeFileSync(paths.promptPath, renderDraftPrompt(promptTemplate, request));
  }
  return paths;
}

/** Read `draft.response.json` — contract-checked downstream. */
export function readDraftResponse(dir: string): DraftResponse {
  const { responsePath } = draftPaths(dir);
  return JSON.parse(readFileSync(responsePath, "utf8")) as DraftResponse;
}

export interface SessionDrafterOptions {
  /** Directory the hand-off files are written into (created if needed). */
  dir: string;
  /** Prompt template text — defaults to `DRAFT_PROMPT_PATH` so the shipped
   *  prompt's version stays the single source of truth. */
  promptTemplate?: string;
  /** Response-file poll interval. Default `SESSION_LLM_POLL_MS`. */
  pollMs?: number;
  /** Wait for `draft.response.json` before throwing. Default 30 min. */
  timeoutMs?: number;
}

/**
 * `session` mode for draft: write the request (+ rendered prompt) to `dir`,
 * then wait for the Devin session to write `draft.response.json` there.
 */
export function createSessionDrafter(opts: SessionDrafterOptions): DraftLlm {
  const pollMs = opts.pollMs ?? SESSION_LLM_POLL_MS;
  const timeoutMs = opts.timeoutMs ?? SESSION_LLM_TIMEOUT_MS;
  const promptTemplate =
    opts.promptTemplate ?? readFileSync(DRAFT_PROMPT_PATH, "utf8");
  return {
    async draft(request: DraftRequest): Promise<DraftResponse> {
      const { responsePath } = writeDraftRequest(opts.dir, request, promptTemplate);
      const deadline = Date.now() + timeoutMs;
      while (!existsSync(responsePath)) {
        if (Date.now() > deadline) {
          throw new Error(
            `timed out waiting for ${responsePath} — the session must write ` +
              `${basename(responsePath)} to continue`,
          );
        }
        await sleep(pollMs);
      }
      return readDraftResponse(opts.dir);
    },
  };
}

/** `replay` mode for draft: always return the recorded response verbatim. */
export function createReplayDrafter(response: DraftResponse): DraftLlm {
  return {
    draft: async () => response,
  };
}

/** `replay` from a recorded `draft.response.json` file. */
export function createReplayDrafterFromFile(path: string): DraftLlm {
  return createReplayDrafter(
    JSON.parse(readFileSync(path, "utf8")) as DraftResponse,
  );
}
