import { createFileRoute } from "@tanstack/react-router";
import { Check, Download, ImagePlus, LoaderCircle, LockKeyhole, RotateCcw, Upload, X } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";

import mugOriginal from "@/assets/mug-original.jpg";
import mugWhite from "@/assets/mug-white.jpg";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Paperwhite — Free White Background Maker" },
      { name: "description", content: "Remove photo backgrounds locally and replace them with pure white. Free, private, and watermark-free." },
      { property: "og:title", content: "Paperwhite — Free White Background Maker" },
      { property: "og:description", content: "A free private tool that removes backgrounds and puts your photo on pure white." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Status = "idle" | "processing" | "done" | "error";

function Index() {
  const inputRef = useRef<HTMLInputElement>(null);
  const originalUrlRef = useRef<string | null>(null);
  const resultUrlRef = useRef<string | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [dragging, setDragging] = useState(false);

  useEffect(() => () => {
    if (originalUrlRef.current) URL.revokeObjectURL(originalUrlRef.current);
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
  }, []);

  const clearUrls = () => {
    if (originalUrlRef.current) URL.revokeObjectURL(originalUrlRef.current);
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    originalUrlRef.current = null;
    resultUrlRef.current = null;
  };

  const processFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setMessage("Please choose a PNG, JPG, or WebP image.");
      setStatus("error");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setMessage("That image is over 10 MB. Please choose a smaller file.");
      setStatus("error");
      return;
    }

    clearUrls();
    const sourceUrl = URL.createObjectURL(file);
    originalUrlRef.current = sourceUrl;
    setOriginalUrl(sourceUrl);
    setResultUrl(null);
    setFileName(file.name);
    setProgress(3);
    setMessage("Loading the private background-removal model…");
    setStatus("processing");

    try {
      const { default: removeBackground } = await import("@imgly/background-removal");
      const foreground = await removeBackground(file, {
        model: "isnet_quint8",
        device: "cpu",
        output: { format: "image/png", quality: 1, type: "foreground" },
        progress: (_key: string, current: number, total: number) => {
          if (total > 0) setProgress(Math.min(72, Math.round((current / total) * 70)));
        },
      });

      setProgress(82);
      setMessage("Placing your cutout on pure white…");
      const transparentUrl = URL.createObjectURL(foreground);
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Could not prepare the cutout."));
        image.src = transparentUrl;
      });
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Your browser could not create the image.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
      URL.revokeObjectURL(transparentUrl);
      const whiteBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not export the image.")), "image/png", 1);
      });
      const whiteUrl = URL.createObjectURL(whiteBlob);
      resultUrlRef.current = whiteUrl;
      setResultUrl(whiteUrl);
      setProgress(100);
      setMessage("Your white-background image is ready.");
      setStatus("done");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Background removal failed. Please try another image.");
    }
  };

  const handleInput = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void processFile(file);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void processFile(file);
  };

  const reset = () => {
    clearUrls();
    setOriginalUrl(null);
    setResultUrl(null);
    setFileName("");
    setStatus("idle");
    setProgress(0);
    setMessage("");
  };

  const outputName = `${fileName.replace(/\.[^.]+$/, "") || "paperwhite"}-white.png`;

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
            <span className="hidden text-[11px] text-muted-foreground sm:block">PNG · JPG · WEBP</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1240px] px-4 py-7 sm:px-6 sm:py-10">
        <section className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            {["100% free, no account", "Runs in your browser", "Always a clean white backdrop"].map((item) => (
              <span key={item} className="flex items-center gap-2 text-foreground/70">
                <span className="grid size-4 place-items-center rounded-full bg-accent text-[10px] font-semibold text-accent-foreground"><Check size={11} /></span>{item}
              </span>
            ))}
          </div>
          <span className="text-[11px] font-medium text-muted-foreground">No watermark. No limits.</span>
        </section>

        <section id="tool" className="grid grid-cols-1 gap-5 lg:grid-cols-[1.35fr_1fr]">
          <div className="overflow-hidden rounded-[14px] bg-card ring-1 ring-border">
            <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
              <div>
                <h1 className="text-[28px] font-semibold leading-tight text-balance lg:text-4xl">Drop a photo.<br className="hidden sm:block" /> Get it on white.</h1>
                <p className="mt-1.5 max-w-[48ch] text-[15px] text-muted-foreground">A neat cutout on fresh white studio paper — no cloud, no watermark, no cost.</p>
              </div>
              <span className="hidden rounded-md bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground lg:block">10 MB max</span>
            </div>

            <div className="p-4 sm:p-6">
              <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={handleInput} />
              {status === "idle" || status === "error" ? (
                <div
                  onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  className={`relative rounded-[12px] bg-background/60 px-6 py-12 text-center ring-1 ring-inset transition duration-200 sm:px-8 sm:py-14 ${dragging ? "-translate-y-0.5 ring-primary" : "ring-border hover:-translate-y-0.5 hover:ring-primary/50"}`}
                >
                  <div className="mx-auto mb-5 grid size-14 place-items-center rounded-full bg-card text-primary ring-1 ring-border"><Upload size={24} strokeWidth={1.7} /></div>
                  <p className="text-[17px] font-medium">Drag a product photo here</p>
                  <p className="mt-1 text-sm text-muted-foreground">or</p>
                  <Button className="mt-4" onClick={() => inputRef.current?.click()}><ImagePlus size={16} />Browse files</Button>
                  <p className="mt-4 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">PNG · JPG · WEBP · up to 10 MB</p>
                  {status === "error" && <p role="alert" className="mx-auto mt-4 max-w-md text-sm text-destructive">{message}</p>}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <PreviewImage label="Original" src={originalUrl} alt="Uploaded original" />
                  <PreviewImage label="White background" src={resultUrl} alt="Finished white-background result" loading={status === "processing"} />
                </div>
              )}

              {status !== "idle" && status !== "error" && (
                <div className="mt-4 rounded-[12px] bg-background/60 p-4 ring-1 ring-inset ring-border" aria-live="polite">
                  <div className="mb-3 flex items-center justify-between text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    <span>{status === "done" ? "Ready" : "Processing locally"}</span><span>{progress}%</span>
                  </div>
                  <div className="flex items-center gap-3 rounded-[10px] bg-card p-3 ring-1 ring-border">
                    <div className="grid size-10 shrink-0 place-items-center rounded-md bg-muted text-primary">{status === "done" ? <Check size={18} /> : <LoaderCircle className="animate-spin" size={18} />}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{fileName}</p>
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${progress}%` }} /></div>
                      <p className="mt-1.5 text-xs text-muted-foreground">{message}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                {status === "idle" || status === "error" ? <p className="flex items-center gap-2 text-xs text-muted-foreground"><LockKeyhole size={14} />Your image stays on this device.</p> : <Button variant="outline" onClick={reset}><RotateCcw size={15} />Start over</Button>}
                {resultUrl && <Button variant="accent" asChild><a href={resultUrl} download={outputName}><Download size={16} />Download PNG</a></Button>}
              </div>
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
                {["Nothing leaves your device — processing is local.", "Free and unlimited, with no watermark.", "Pure white output, ready for any store."].map((item) => <li key={item} className="flex gap-2.5"><Check className="mt-0.5 shrink-0 text-primary" size={16} /><span className="text-foreground/70">{item}</span></li>)}
              </ul>
            </div>

            <div id="output" className="rounded-[14px] bg-card p-5 ring-1 ring-border">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Output</p>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Format</dt><dd className="font-medium">PNG on pure white</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Dimensions</dt><dd className="font-medium">Same as original</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Privacy</dt><dd className="font-medium">On-device</dd></div>
              </dl>
            </div>
          </aside>
        </section>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5 font-mono text-[11px] text-muted-foreground">
          <p>Pure white is #ffffff. Every time.</p>
          <p>Paperwhite · free background removal</p>
        </footer>
      </main>
    </div>
  );
}

function PreviewImage({ label, src, alt, loading = false }: { label: string; src: string | null; alt: string; loading?: boolean }) {
  return (
    <div className="relative aspect-square overflow-hidden rounded-[12px] bg-card ring-1 ring-border">
      {src ? <img src={src} alt={alt} className="size-full object-contain" /> : <div className="grid size-full place-items-center text-primary"><LoaderCircle className="animate-spin" size={30} /></div>}
      {loading && <div className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-card/70 to-transparent motion-safe:animate-[progress-sweep_2.2s_ease-in-out_infinite]" />}
      <span className={`absolute left-2 top-2 rounded-md px-2 py-1 text-[10px] font-medium uppercase tracking-[0.1em] ${label === "Original" ? "bg-foreground text-background" : "bg-primary text-primary-foreground"}`}>{label}</span>
    </div>
  );
}
