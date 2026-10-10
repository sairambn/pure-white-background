import { createFileRoute } from "@tanstack/react-router";
import { Check, Download, ImagePlus, LoaderCircle, LockKeyhole, RotateCcw, Upload, X } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent } from "react";

import mugOriginal from "@/assets/mug-original.jpg";
import mugWhite from "@/assets/mug-white.jpg";
import { Button } from "@/components/ui/button";
import { useBatchProcessor } from "@/hooks/useBatchProcessor";
import { MAX_FILES, type WorkItem } from "@/lib/batch";

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
  const [dragging, setDragging] = useState(false);

  const {
    items,
    batchError,
    zipping,
    readyItems,
    doneCount,
    processingCount,
    isIdle,
    canAddMore,
    slotsLeft,
    addFiles,
    removeItem,
    retryItem,
    reset,
    downloadZip,
  } = useBatchProcessor();

  const handleInput = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) addFiles(event.target.files);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files?.length) addFiles(event.dataTransfer.files);
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
                        ? `Working… ${doneCount} of ${items.length} ready`
                        : `${doneCount} ready`}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {readyItems.length > 0 && (
                        <Button variant="accent" type="button" onClick={() => void downloadZip()} disabled={zipping}>
                          <Download size={15} />
                          {zipping
                            ? "Zipping…"
                            : readyItems.length === 1
                              ? "Download"
                              : `Download all (${readyItems.length})`}
                        </Button>
                      )}
                      {canAddMore && (
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
                      <ItemCard
                        key={item.id}
                        item={item}
                        onRemove={() => removeItem(item.id)}
                        onRetry={() => retryItem(item.id)}
                      />
                    ))}
                  </div>

                  {canAddMore && (
                    <div
                      onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
                      onDragOver={(event) => event.preventDefault()}
                      onDragLeave={() => setDragging(false)}
                      onDrop={handleDrop}
                      className={`rounded-[12px] border border-dashed px-4 py-3 text-center text-sm text-muted-foreground transition ${
                        dragging ? "border-primary bg-accent/40 text-foreground" : "border-border"
                      }`}
                    >
                      Drop more images here ({slotsLeft} slots left)
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
          <p>Paperwhite · free forever · v1.0.2</p>
        </footer>
      </main>
    </div>
  );
}

function ItemCard({
  item,
  onRemove,
  onRetry,
}: {
  item: WorkItem;
  onRemove: () => void;
  onRetry: () => void;
}) {
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
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-destructive">{item.message}</p>
            <button
              type="button"
              onClick={onRetry}
              className="text-xs font-medium text-primary underline-offset-2 hover:underline"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
