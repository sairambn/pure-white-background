/**
 * Batch domain types and data structures for Paperwhite.
 * - Map<id, WorkItem> for O(1) updates
 * - orderedIds for stable UI order
 * - FIFO queue of pending ids
 * - Set of in-flight ids for concurrency control
 */

export const MAX_BYTES = 10 * 1024 * 1024;
export const MAX_EDGE = 512; // smaller = much faster on CPU
export const MAX_FILES = 15;
export const CONCURRENCY = 1; // sequential is faster than parallel on CPU/ONNX
export const ALLOWED = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

export type ItemStatus = "queued" | "processing" | "done" | "error";

export type WorkItem = {
  readonly id: string;
  readonly file: File;
  readonly fileName: string;
  readonly originalUrl: string;
  cutoutUrl: string | null;
  resultUrl: string | null;
  status: ItemStatus;
  progress: number;
  message: string;
  /** When processing started (ms since epoch). */
  startedAt: number | null;
  /** Final processing duration in milliseconds (set when done/error). */
  durationMs: number | null;
};

export type AcceptResult = {
  accepted: WorkItem[];
  rejected: string[];
};

export function createItemId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function isAllowedImage(file: File): { ok: true } | { ok: false; reason: string } {
  const type = (file.type || "").toLowerCase();
  if (type.includes("heic") || type.includes("heif")) {
    return { ok: false, reason: "HEIC is not supported. Export as JPG or PNG." };
  }
  if (!type.startsWith("image/") || (type && !ALLOWED.has(type) && type !== "image/jpg")) {
    return { ok: false, reason: "Use PNG, JPG, or WebP only." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, reason: "Over 10 MB. Choose a smaller file." };
  }
  return { ok: true };
}

export function createWorkItem(file: File): WorkItem {
  return {
    id: createItemId(),
    file,
    fileName: file.name || "photo",
    originalUrl: URL.createObjectURL(file),
    cutoutUrl: null,
    resultUrl: null,
    status: "queued",
    progress: 0,
    message: "Waiting…",
    startedAt: null,
    durationMs: null,
  };
}

/** Accept up to `room` valid images; reject the rest with reasons. */
export function acceptFiles(fileList: FileList | File[], room: number): AcceptResult {
  const accepted: WorkItem[] = [];
  const rejected: string[] = [];

  for (const file of Array.from(fileList)) {
    if (accepted.length >= room) {
      rejected.push(`${file.name}: limit is ${MAX_FILES} images`);
      continue;
    }
    const check = isAllowedImage(file);
    if (!check.ok) {
      rejected.push(`${file.name}: ${check.reason}`);
      continue;
    }
    accepted.push(createWorkItem(file));
  }

  return { accepted, rejected };
}

export function releaseItemUrls(item: WorkItem): void {
  URL.revokeObjectURL(item.originalUrl);
  if (item.cutoutUrl) URL.revokeObjectURL(item.cutoutUrl);
  if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
}

export function releaseAll(items: Iterable<WorkItem>): void {
  for (const item of items) releaseItemUrls(item);
}

/** Immutable-friendly patch helper. */
export function patchItem(item: WorkItem, patch: Partial<WorkItem>): WorkItem {
  return { ...item, ...patch };
}

/** localStorage key for processing-time weights (running averages). */
export const TIMING_WEIGHTS_KEY = "paperwhite_timing_weights_v1";

export type TimingWeights = {
  /** Recent sample durations in ms (max 30). */
  samples: number[];
  /** Weighted average ms (more recent samples count more). */
  avgMs: number;
  count: number;
};

export function loadTimingWeights(): TimingWeights {
  try {
    const raw = localStorage.getItem(TIMING_WEIGHTS_KEY);
    if (!raw) return { samples: [], avgMs: 0, count: 0 };
    const parsed = JSON.parse(raw) as TimingWeights;
    if (!Array.isArray(parsed.samples)) return { samples: [], avgMs: 0, count: 0 };
    return parsed;
  } catch {
    return { samples: [], avgMs: 0, count: 0 };
  }
}

/** Record a successful run; recent samples weigh more in avgMs. */
export function recordTimingSample(durationMs: number): TimingWeights {
  const prev = loadTimingWeights();
  const samples = [...prev.samples, Math.round(durationMs)].slice(-30);
  // Exponential-ish weights: last sample strongest
  let weightSum = 0;
  let valueSum = 0;
  for (let i = 0; i < samples.length; i++) {
    const w = i + 1;
    weightSum += w;
    valueSum += samples[i] * w;
  }
  const avgMs = weightSum > 0 ? Math.round(valueSum / weightSum) : 0;
  const next: TimingWeights = { samples, avgMs, count: samples.length };
  try {
    localStorage.setItem(TIMING_WEIGHTS_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
  return next;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  const m = Math.floor(s / 60);
  const rem = s - m * 60;
  return `${m}m ${rem.toFixed(0)}s`;
}

/**
 * Ordered batch store: Map for lookups, array for UI order.
 * Queue is derived from items with status === "queued" in order.
 */
export class BatchStore {
  private readonly byId = new Map<string, WorkItem>();
  private orderedIds: string[] = [];

  get size(): number {
    return this.orderedIds.length;
  }

  get room(): number {
    return Math.max(0, MAX_FILES - this.size);
  }

  list(): WorkItem[] {
    return this.orderedIds.map((id) => this.byId.get(id)!).filter(Boolean);
  }

  get(id: string): WorkItem | undefined {
    return this.byId.get(id);
  }

  addMany(items: WorkItem[]): void {
    for (const item of items) {
      if (this.byId.has(item.id)) continue;
      this.byId.set(item.id, item);
      this.orderedIds.push(item.id);
    }
  }

  update(id: string, patch: Partial<WorkItem>): WorkItem | undefined {
    const cur = this.byId.get(id);
    if (!cur) return undefined;
    const next = patchItem(cur, patch);
    this.byId.set(id, next);
    return next;
  }

  remove(id: string): WorkItem | undefined {
    const item = this.byId.get(id);
    if (!item) return undefined;
    this.byId.delete(id);
    this.orderedIds = this.orderedIds.filter((x) => x !== id);
    releaseItemUrls(item);
    return item;
  }

  clear(): void {
    releaseAll(this.byId.values());
    this.byId.clear();
    this.orderedIds = [];
  }

  /** FIFO: next queued ids up to limit, skipping those already active. */
  nextQueued(limit: number, active: ReadonlySet<string>): WorkItem[] {
    const out: WorkItem[] = [];
    for (const id of this.orderedIds) {
      if (out.length >= limit) break;
      if (active.has(id)) continue;
      const item = this.byId.get(id);
      if (item?.status === "queued") out.push(item);
    }
    return out;
  }

  countByStatus(): { queued: number; processing: number; done: number; error: number } {
    let queued = 0;
    let processing = 0;
    let done = 0;
    let error = 0;
    for (const item of this.byId.values()) {
      if (item.status === "queued") queued += 1;
      else if (item.status === "processing") processing += 1;
      else if (item.status === "done") done += 1;
      else error += 1;
    }
    return { queued, processing, done, error };
  }

  ready(): WorkItem[] {
    return this.list().filter((it) => it.status === "done" && it.resultUrl);
  }
}
