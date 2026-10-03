import { createFileRoute } from "@tanstack/react-router";
import { Check, Download, ImagePlus, LoaderCircle, LockKeyhole, RotateCcw, Upload, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent } from "react";

import mugOriginal from "@/assets/mug-original.jpg";
import mugWhite from "@/assets/mug-white.jpg";
import { Button } from "@/components/ui/button";
import {
  MAX_FILES,
  FEATHER_DEFAULT,
  FEATHER_MIN,
  FEATHER_MAX,
  isAllowedImage,
  removeToWhite,
  compositeOnWhite,
  downloadAllAsZip,
  type WorkItem,
} from "@/lib/paperwhite";

const LIVE_URL = "https://paperwhite-bg.vercel.app";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Paperwhite — Free White Background Maker" },
      {
        name: "description",
        content:
          "Free forever white background tool. Remove photo backgrounds in your browser. Easy to use, private, no account. Upload up to 15 images at once.",
      },
      { name: "theme-color", content: "#f7f5f0" },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Paperwhite — Free White Background Maker" },
      {
        property: "og:description",
        content: "Free forever. Easy white backgrounds in your browser. Private, no account, up to 15 images at once.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: LIVE_URL },
      { property: "og:site_name", content: "Paperwhite" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Paperwhite — Free White Background Maker" },
      {
        name: "twitter:description",
        content: "Free forever white backgrounds. Runs in your browser. No upload. No account. Batch up to 15.",
      },
    ],
    links: [{ rel: "canonical", href: LIVE_URL }],
  }),
  component: Index,
});

function Index() {
  const inputRef = useRef<HTMLInputElement>(null);
  const runIdRef = useRef(0);
  const processingRef = useRef(false);
  const itemsRef = useRef<WorkItem[]>([]);

  const [items, setItems] = useState<WorkItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [batchError, setBatchError] = useState("");
  const [featherPx, setFeatherPx] = useState(FEATHER_DEFAULT);
  const featherRef = useRef(FEATHER_DEFAULT);
  const [zipping, setZipping] = useState(false);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    featherRef.current = featherPx;
  }, [featherPx]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const done = itemsRef.current.filter((it) => it.status === "done" && it.cutoutUrl);
      for (const item of done) {
        if (cancelled) return;
        try {
          const resultUrl = await compositeOnWhite(item.cutoutUrl!, featherPx);
          if (cancelled) {
            URL.revokeObjectURL(resultUrl);
            return;
          }
          setItems((prev) =>
            prev.map((it) => {
              if (it.id !== item.id) return it;
              if (it.resultUrl) URL.revokeObjectURL(it.resultUrl);
              return { ...it, resultUrl };
            }),
          );
        } catch {
          // keep previous result
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [featherPx]);

  useEffect(
    () => () => {
      for (const item of itemsRef.current) {
        URL.revokeObjectURL(item.originalUrl);
        if (item.cutoutUrl) URL.revokeObjectURL(item.cutoutUrl);
        if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
      }
    },
    [],
  );

  const updateItem = useCallback((id: string, patch: Partial<WorkItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    const runId = runIdRef.current;

    try {
      while (runId === runIdRef.current) {
        const next = itemsRef.current.find((it) => it.status === "queued");
        if (!next) break;

        updateItem(next.id, { status: "processing", progress: 2, message: "Starting…" });

        try {
          const { cutoutUrl, resultUrl } = await removeToWhite(
            next.file,
            (progress, message) => {
              if (runId !== runIdRef.current) return;
              updateItem(next.id, { progress, message });
            },
            () => runId !== runIdRef.current,
            { featherPx: featherRef.current },
          );
          if (runId !== runIdRef.current) {
            URL.revokeObjectURL(cutoutUrl);
            URL.revokeObjectURL(resultUrl);
            break;
          }
          updateItem(next.id, {
            status: "done",
            progress: 100,
            message: "Ready",
            cutoutUrl,
            resultUrl,
          });
        } catch (error) {
          if (runId !== runIdRef.current) break;
          const raw = error instanceof Error ? error.message : "Background removal failed.";
          if (raw === "__cancelled__") break;
          updateItem(next.id, {
            status: "error",
            progress: 0,
            message: /network|fetch|failed to fetch/i.test(raw)
              ? "Could not load the model. Check your connection."
              : raw || "Background removal failed.",
          });
        }
      }
    } finally {
      processingRef.current = false;
    }
  }, [updateItem]);

  useEffect(() => {
    if (items.some((it) => it.status === "queued") && !processingRef.current) {
      void processQueue();
    }
  }, [items, processQueue]);

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const incoming = Array.from(fileList);
    if (incoming.length === 0) return;

    setBatchError("");
    const existing = itemsRef.current.length;
    const room = MAX_FILES - existing;
    if (room <= 0) {
      setBatchError(`You can process up to ${MAX_FILES} images at a time. Start over to add more.`);
      return;
    }

    const accepted: WorkItem[] = [];
    const rejected: string[] = [];

    for (const file of incoming) {
      if (accepted.length >= room) {
        rejected.push(`${file.name}: limit is ${MAX_FILES} images`);
        continue;
      }
      const check = isAllowedImage(file);
      if (!check.ok) {
        rejected.push(`${file.name}: ${check.reason}`);
        continue;
      }
      const originalUrl = URL.createObjectURL(file);
      accepted.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        file,
        fileName: file.name || "photo",
        originalUrl,
        cutoutUrl: null,
        resultUrl: null,
        status: "queued",
        progress: 0,
        message: "Waiting…",
      });
    }

    if (rejected.length > 0) {
      setBatchError(rejected.slice(0, 3).join(" · ") + (rejected.length > 3 ? ` · +${rejected.length - 3} more` : ""));
    }
    if (accepted.length === 0) return;

    setItems((prev) => [...prev, ...accepted]);
  }, []);

  const handleInput = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) addFiles(event.target.files);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files?.length) addFiles(event.dataTransfer.files);
  };

  const reset = () => {
    runIdRef.current += 1;
    processingRef.current = false;
    for (const item of itemsRef.current) {
      URL.revokeObjectURL(item.originalUrl);
      if (item.cutoutUrl) URL.revokeObjectURL(item.cutoutUrl);
      if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
    }
    setItems([]);
    setBatchError("");
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const target = prev.find((it) => it.id === id);
      if (target) {
        URL.revokeObjectURL(target.originalUrl);
        if (target.cutoutUrl) URL.revokeObjectURL(target.cutoutUrl);
        if (target.resultUrl) URL.revokeObjectURL(target.resultUrl);
      }
      return prev.filter((it) => it.id !== id);
    });
  };

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const clipItems = event.clipboardData?.items;
      if (!clipItems) return;
      const files: File[] = [];
      for (const item of clipItems) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length > 0) {
        event.preventDefault();
        addFiles(files);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles]);

  const onDropZoneKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      inputRef.current?.click();
    }
  };

  const doneCount = items.filter((it) => it.status === "done").length;
  const processingCount = items.filter((it) => it.status === "processing" || it.status === "queued").length;
  const isIdle = items.length === 0;
  const readyItems = items.filter((it) => it.status === "done" && it.resultUrl);

  const handleDownloadZip = async () => {
    if (readyItems.length === 0 || zipping) return;
    setZipping(true);
    try {
      await downloadAllAsZip(
        readyItems.map((it) => ({ fileName: it.fileName, resultUrl: it.resultUrl! })),
      );
    } catch {
      setBatchError("Could not build the ZIP. Try again.");
    } finally {
      setZipping(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="h-14 border-b border-border">
        <div className="mx-auto flex h-full max-w-[1240px] items-center justify-between px-4 sm:px-6">
          <a href="#tool" className="flex items-center gap-2" aria-label="Paperwhite home">
            <span className="grid size-7 place-items-center rounded-[7px] bg-foreground text-[11px] font-semibold text-background">P</span>
            <span className="text-[15px] font-semibold">Paperwhite</span>
          </a>
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex" aria-label="Page sections">
            <a href="#tool" className="hover:text-foreground">Tool</a>
            <a href="#privacy" className="hover:text-foreground">Privacy</a>
            <a href="#output" className="hover:text-foreground">Output</a>
          </nav>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-accent px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent-foreground">Local · No upload</span>
            <span className="hidden text-[11px] text-muted-foreground sm:block">Up to 15 images</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1240px] px-4 py-7 sm:px-6 sm:py-10">
        <section className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            {["Free forever, no account", "Easy — drop and download", "Up to 15 photos at once"].map((item) => (
              <span key={item} className="flex items-center gap-2 text-foreground/70">
                <span className="grid size-4 place-items-center rounded-full bg-accent text-[10px] font-semibold text-accent-foreground"><Check size={11} /></span>
                {item}
              </span>
            ))}
          </div>
          <span className="text-[11px] font-medium text-muted-foreground">Free forever. No limits.</span>
        </section>

        <section id="tool" className="grid grid-cols-1 gap-5 lg:grid-cols-[1.35fr_1fr]">
          <div className="overflow-hidden rounded-[14px] bg-card ring-1 ring-border">
            <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
              <div>
                <h1 className="text-[28px] font-semibold leading-tight text-balance lg:text-4xl">
                  Drop a photo.<br className="hidden sm:block" /> Get it on white.
                </h1>
                <p className="mt-1.5 max-w-[48ch] text-[15px] text-muted-foreground">
                  Drop a photo, get pure white. Free forever, private, and simple. Batch up to 15.
                </p>
              </div>
              <span className="hidden rounded-md bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground lg:block">10 MB each · 15 max</span>
            </div>

            <div className="p-4 sm:p-6">
              <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[12px] bg-background/60 px-3 py-2.5 ring-1 ring-inset ring-border">
                <label htmlFor="edge-feather" className="shrink-0 text-sm font-medium text-foreground/80">
                  Edge feather
                </label>
                <input
                  id="edge-feather"
                  type="range"
                  min={FEATHER_MIN}
                  max={FEATHER_MAX}
                  step={0.5}
                  value={featherPx}
                  onChange={(e) => setFeatherPx(Number(e.target.value))}
                  className="h-2 min-w-[120px] flex-1 cursor-pointer accent-primary"
                  aria-valuemin={FEATHER_MIN}
                  aria-valuemax={FEATHER_MAX}
                  aria-valuenow={featherPx}
                  aria-label="Edge feather in pixels"
                />
                <span className="w-12 text-right font-mono text-xs text-muted-foreground tabular-nums">
                  {featherPx.toFixed(1)} px
                </span>
              </div>

              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                className="sr-only"
                onChange={handleInput}
                aria-label="Choose image files, up to 15"
              />

              {isIdle ? (
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Upload product photos. Drag and drop, click to browse, or paste. Up to 15 images."
                  onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onKeyDown={onDropZoneKey}
                  onClick={() => inputRef.current?.click()}
                  className={`relative cursor-pointer rounded-[12px] bg-background/60 px-6 py-12 text-center ring-1 ring-inset transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:px-8 sm:py-14 ${
                    dragging ? "-translate-y-0.5 ring-primary" : "ring-border hover:-translate-y-0.5 hover:ring-primary/50"
                  }`}
                >
                  <div className="mx-auto mb-5 grid size-14 place-items-center rounded-full bg-card text-primary ring-1 ring-border">
                    <Upload size={24} strokeWidth={1.7} />
                  </div>
                  <p className="text-[17px] font-medium">Drag product photos here</p>
                  <p className="mt-1 text-sm text-muted-foreground">or click to browse · paste also works</p>
                  <Button className="mt-4 pointer-events-none" tabIndex={-1} type="button">
                    <ImagePlus size={16} />
                    Browse files
                  </Button>
                  <p className="mt-4 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    PNG · JPG · WEBP · up to 15 · 10 MB each
                  </p>
                  {batchError && (
                    <p role="alert" className="mx-auto mt-4 max-w-md text-sm text-destructive">{batchError}</p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                      {processingCount > 0
                        ? `Working… ${doneCount}/${items.length}`
                        : doneCount === items.length
                          ? `${doneCount} ready`
                          : `${doneCount} of ${items.length} ready`}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {readyItems.length > 0 && (
                        <Button variant="accent" type="button" onClick={() => void handleDownloadZip()} disabled={zipping}>
                          <Download size={15} />
                          {zipping ? "Zipping…" : readyItems.length === 1 ? "Download ZIP" : `Download ZIP (${readyItems.length})`}
                        </Button>
                      )}
                      {items.length < MAX_FILES && (
                        <Button variant="outline" type="button" onClick={() => inputRef.current?.click()}>
                          <ImagePlus size={15} />
                          Add more
                        </Button>
                      )}
                      <Button variant="outline" type="button" onClick={reset}>
                        <RotateCcw size={15} />
                        Start over
                      </Button>
                    </div>
                  </div>

                  {batchError && (
                    <p role="alert" className="text-sm text-destructive">{batchError}</p>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    {items.map((item) => (
                      <ItemCard key={item.id} item={item} onRemove={() => removeItem(item.id)} />
                    ))}
                  </div>

                  {items.length < MAX_FILES && (
                    <div
                      onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
                      onDragOver={(event) => event.preventDefault()}
                      onDragLeave={() => setDragging(false)}
                      onDrop={handleDrop}
                      className={`rounded-[12px] border border-dashed px-4 py-3 text-center text-sm text-muted-foreground transition ${
                        dragging ? "border-primary bg-accent/40 text-foreground" : "border-border"
                      }`}
                    >
                      Drop more images here ({MAX_FILES - items.length} slots left)
                    </div>
                  )}
                </div>
              )}

              {isIdle && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <LockKeyhole size={14} />
                    Your images stay on this device.
                  </p>
                </div>
              )}
            </div>
          </div>

          <aside className="flex flex-col gap-5">
            <div className="rounded-[14px] bg-card p-5 ring-1 ring-border">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Before → after</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <img src={mugOriginal} alt="Mug with its original kitchen background" width={816} height={816} className="aspect-square rounded-[10px] object-cover ring-1 ring-border" />
                <img src={mugWhite} alt="Mug isolated on a white background" width={816} height={816} className="aspect-square rounded-[10px] object-cover ring-1 ring-border" />
              </div>
              <p className="mt-3 text-[13px] text-muted-foreground">The background disappears; your subject keeps its color and lands on pure white.</p>
            </div>

            <div id="privacy" className="rounded-[14px] bg-card p-5 ring-1 ring-border">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Why it’s trusted</p>
              <ul className="mt-3 space-y-2.5 text-sm">
                {["Nothing leaves your device — processing is local.", "Free forever — no account, no fees.", "Pure white output, ready for any store.", "Batch up to 15 product photos in one go."].map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <Check className="mt-0.5 shrink-0 text-primary" size={16} />
                    <span className="text-foreground/70">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div id="output" className="rounded-[14px] bg-card p-5 ring-1 ring-border">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Output</p>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Format</dt><dd className="font-medium">PNG on pure white</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Download</dt><dd className="font-medium">One ZIP file</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Privacy</dt><dd className="font-medium">On-device</dd></div>
              </dl>
            </div>
          </aside>
        </section>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5 font-mono text-[11px] text-muted-foreground">
          <p>Pure white is #ffffff. Every time.</p>
          <p>Paperwhite · free forever</p>
        </footer>
      </main>
    </div>
  );
}

function ItemCard({ item, onRemove }: { item: WorkItem; onRemove: () => void }) {
  return (
    <div className="overflow-hidden rounded-[12px] bg-background/60 ring-1 ring-border">
      <div className="relative grid grid-cols-2 gap-px bg-border">
        <div className="relative aspect-square bg-card">
          <img src={item.originalUrl} alt="" className="size-full object-contain" />
          <span className="absolute left-1.5 top-1.5 rounded-md bg-foreground px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.08em] text-background">Original</span>
        </div>
        <div className="relative aspect-square bg-card">
          {item.resultUrl ? (
            <img src={item.resultUrl} alt="" className="size-full object-contain" />
          ) : (
            <div className="grid size-full place-items-center text-primary">
              {item.status === "error" ? (
                <span className="px-2 text-center text-xs text-destructive">Failed</span>
              ) : (
                <LoaderCircle className="animate-spin" size={24} />
              )}
            </div>
          )}
          {item.status === "processing" && (
            <div className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-card/70 to-transparent motion-safe:animate-[progress-sweep_2.2s_ease-in-out_infinite]" />
          )}
          <span className="absolute left-1.5 top-1.5 rounded-md bg-primary px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.08em] text-primary-foreground">White</span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-md bg-card/90 text-muted-foreground ring-1 ring-border hover:text-foreground"
          aria-label={`Remove ${item.fileName}`}
        >
          <X size={14} />
        </button>
      </div>

      <div className="space-y-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium">{item.fileName}</p>
          <span className="shrink-0 text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
            {item.status === "done" ? "Ready" : item.status === "error" ? "Error" : item.status === "queued" ? "Queued" : `${item.progress}%`}
          </span>
        </div>
        {(item.status === "processing" || item.status === "queued") && (
          <div className="h-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${item.status === "queued" ? 2 : item.progress}%` }} />
          </div>
        )}
        {item.status === "error" && (
          <p className="text-xs text-destructive">{item.message}</p>
        )}
      </div>
    </div>
  );
}
