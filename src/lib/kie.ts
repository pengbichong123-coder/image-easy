// kie.ai API client
// Documentation: https://docs.kie.ai/

import type {
  ModelId,
  AspectRatio,
  Resolution,
  Quality,
  OutputFormat,
} from "./models";

const KIE_BASE_URL = process.env.KIE_API_BASE || "https://api.kie.ai";

interface CreateTaskInput {
  prompt: string;
  aspectRatio?: AspectRatio;
  resolution?: Resolution;
  quality?: Quality;
  outputFormat?: OutputFormat;
  imageUrls?: string[];
  nsfwChecker?: boolean;
}

interface CreateTaskResponse {
  code: number;
  msg: string;
  data: { taskId: string };
}

export interface TaskRecord {
  taskId: string;
  model: string;
  state: string;
  param: string;
  resultJson?: string;
  failCode?: string;
  failMsg?: string;
  costTime?: number;
  createTime: number;
  updateTime: number;
  creditsConsumed?: number;
}

interface TaskDetailResponse {
  code: number;
  msg: string;
  data: TaskRecord;
}

interface UploadResult {
  fileName: string;
  filePath: string;
  downloadUrl: string;
  fileSize: number;
  mimeType: string;
}

export class KieError extends Error {
  terminal: boolean;

  constructor(public code: number | string, message: string, options: { terminal?: boolean } = {}) {
    super(message);
    this.name = "KieError";
    this.terminal = options.terminal ?? false;
  }
}

function isTerminalKieCode(code: number | string) {
  const numericCode = typeof code === "number" ? code : Number.parseInt(code, 10);
  return Number.isInteger(numericCode) && numericCode >= 400 && numericCode < 500 && numericCode !== 429;
}

function taskState(record: TaskRecord) {
  return String(record.state ?? "").toLowerCase();
}

function isSuccessfulTaskState(record: TaskRecord) {
  return ["success", "succeeded", "completed", "complete"].includes(taskState(record));
}

function isFailedTaskState(record: TaskRecord) {
  return ["fail", "failed", "failure", "error", "canceled", "cancelled"].includes(taskState(record));
}

function taskFailureCode(record: TaskRecord) {
  return record.failCode || "fail";
}

function taskFailureMessage(record: TaskRecord) {
  return record.failMsg || "Generation failed";
}

function buildInput(model: ModelId, params: CreateTaskInput) {
  const input: Record<string, unknown> = {
    prompt: params.prompt,
  };

  if (params.aspectRatio) input.aspect_ratio = params.aspectRatio;
  if (params.resolution) input.resolution = params.resolution;
  if (params.quality) input.quality = params.quality;
  if (params.outputFormat) input.output_format = params.outputFormat;
  if (params.imageUrls && params.imageUrls.length > 0) {
    // Different models use different param name for images
    if (model === "nano-banana-pro") {
      input.image_input = params.imageUrls;
    } else {
      input.image_urls = params.imageUrls;
    }
  }
  if (params.nsfwChecker !== undefined) input.nsfw_checker = params.nsfwChecker;

  return input;
}

async function createTask(
  model: ModelId,
  input: CreateTaskInput,
  callBackUrl?: string,
): Promise<string> {
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) {
    throw new KieError(401, "KIE_API_KEY is not configured");
  }

  const body: Record<string, unknown> = {
    model,
    input: buildInput(model, input),
  };
  if (callBackUrl) body.callBackUrl = callBackUrl;

  const res = await fetch(`${KIE_BASE_URL}/api/v1/jobs/createTask`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new KieError(res.status, `createTask HTTP ${res.status}: ${text}`);
  }

  const data: CreateTaskResponse = await res.json();
  if (data.code !== 200) {
    throw new KieError(data.code, data.msg || "createTask failed");
  }
  return data.data.taskId;
}

async function getTask(taskId: string): Promise<TaskRecord> {
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) {
    throw new KieError(401, "KIE_API_KEY is not configured");
  }

  const url = new URL(`${KIE_BASE_URL}/api/v1/jobs/recordInfo`);
  url.searchParams.set("taskId", taskId);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new KieError(res.status, `recordInfo HTTP ${res.status}`);
  }

  const data: TaskDetailResponse = await res.json();
  if (data.code !== 200) {
    throw new KieError(data.code, data.msg || "recordInfo failed", {
      terminal: isTerminalKieCode(data.code),
    });
  }
  return data.data;
}

export interface GenerationResult {
  taskId: string;
  model: string;
  resultUrls: string[];
  costTime: number;
  creditsConsumed?: number;
}

export type GenerationTaskState = TaskRecord["state"];

function parseSuccessfulTask(record: TaskRecord): GenerationResult {
  let resultUrls: string[] = [];
  if (record.resultJson) {
    try {
      const parsed = JSON.parse(record.resultJson) as {
        resultUrls?: string[];
      };
      resultUrls = parsed.resultUrls ?? [];
    } catch (e) {
      throw new KieError(
        "parse",
        `Failed to parse resultJson: ${(e as Error).message}`,
        { terminal: true },
      );
    }
  }
  return {
    taskId: record.taskId,
    model: record.model,
    resultUrls,
    costTime: record.costTime ?? 0,
    creditsConsumed: record.creditsConsumed,
  };
}

export async function submitGenerationTask(
  opts: Omit<GenerateOptions, "onUpdate" | "signal">,
): Promise<string> {
  return createTask(opts.model, {
    prompt: opts.prompt,
    aspectRatio: opts.aspectRatio,
    resolution: opts.resolution,
    quality: opts.quality,
    outputFormat: opts.outputFormat,
    imageUrls: opts.imageUrls,
    nsfwChecker: opts.nsfwChecker,
  }, opts.callBackUrl);
}

export async function getGenerationTaskResult(taskId: string): Promise<{
  record: TaskRecord;
  result?: GenerationResult;
}> {
  const record = await getTask(taskId);

  if (isFailedTaskState(record)) {
    throw new KieError(
      taskFailureCode(record),
      taskFailureMessage(record),
      { terminal: true },
    );
  }

  if (isSuccessfulTaskState(record)) {
    return { record, result: parseSuccessfulTask(record) };
  }

  return { record };
}

const MAX_POLL_TIME_MS = 15 * 60 * 1000; // 15 min
const INITIAL_POLL_INTERVAL_MS = 2000;
const MAX_POLL_INTERVAL_MS = 10000;

/**
 * Poll until the task reaches a terminal state.
 * Implements exponential backoff: 2s → 3s → 4.5s ... capped at 10s.
 */
export async function waitForTask(
  taskId: string,
  options: {
    onUpdate?: (record: TaskRecord) => void;
    signal?: AbortSignal;
  } = {},
): Promise<GenerationResult> {
  const start = Date.now();
  let interval = INITIAL_POLL_INTERVAL_MS;

  while (true) {
    if (options.signal?.aborted) {
      throw new KieError("aborted", "Generation was cancelled");
    }
    if (Date.now() - start > MAX_POLL_TIME_MS) {
      throw new KieError("timeout", "Generation timed out (>15 min)");
    }

    const record = await getTask(taskId);
    options.onUpdate?.(record);

    if (isSuccessfulTaskState(record) || isFailedTaskState(record)) {
      if (isFailedTaskState(record)) {
        throw new KieError(
          taskFailureCode(record),
          taskFailureMessage(record),
          { terminal: true },
        );
      }
      return parseSuccessfulTask(record);
    }

    // wait with exponential backoff
    await new Promise((r) => setTimeout(r, interval));
    interval = Math.min(interval * 1.5, MAX_POLL_INTERVAL_MS);
  }
}

export interface GenerateOptions {
  model: ModelId;
  prompt: string;
  aspectRatio?: AspectRatio;
  resolution?: Resolution;
  quality?: Quality;
  outputFormat?: OutputFormat;
  imageUrls?: string[];
  nsfwChecker?: boolean;
  callBackUrl?: string;
  onUpdate?: (record: TaskRecord) => void;
  signal?: AbortSignal;
}

/**
 * High-level: submit a generation task and wait for it to finish.
 */
export async function generate(opts: GenerateOptions): Promise<GenerationResult> {
  const taskId = await createTask(opts.model, {
    prompt: opts.prompt,
    aspectRatio: opts.aspectRatio,
    resolution: opts.resolution,
    quality: opts.quality,
    outputFormat: opts.outputFormat,
    imageUrls: opts.imageUrls,
    nsfwChecker: opts.nsfwChecker,
  }, opts.callBackUrl);

  return waitForTask(taskId, {
    onUpdate: opts.onUpdate,
    signal: opts.signal,
  });
}

/**
 * Upload a base64 image to kie.ai and get back a hosted URL.
 * Required for image-to-image tasks.
 */
export async function uploadBase64(
  base64Data: string,
  filename?: string,
): Promise<UploadResult> {
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) {
    throw new KieError(401, "KIE_API_KEY is not configured");
  }

  const res = await fetch(`${KIE_BASE_URL}/api/file-base64-upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      base64Data,
      uploadPath: "user-uploads",
      fileName: filename,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new KieError(res.status, `upload HTTP ${res.status}: ${text}`);
  }

  const data = await res.json();
  if (!data.success || data.code !== 200) {
    throw new KieError(data.code ?? 500, data.msg ?? "Upload failed");
  }
  return data.data as UploadResult;
}

/**
 * Convert a kie.ai generated URL into a 20-min downloadable URL.
 * Mainly for forcing downloads / avoiding CDN issues.
 */
export async function getDownloadUrl(url: string): Promise<string> {
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) {
    throw new KieError(401, "KIE_API_KEY is not configured");
  }
  const res = await fetch(`${KIE_BASE_URL}/api/v1/common/download-url`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    throw new KieError(res.status, `download-url HTTP ${res.status}`);
  }
  const data = await res.json();
  if (data.code !== 200) {
    throw new KieError(data.code, data.msg);
  }
  return data.data as string;
}
