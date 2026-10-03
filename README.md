# Paperwhite

**[Open the tool →](https://paperwhite-bg.vercel.app)**

Free forever. Easy to use. Your photos never leave your device.

Drop a product photo, get a pure white background (`#ffffff`) in seconds. No account, no payment, no limits — now or later.

---

## Lifelong free

Paperwhite is free to use for life.

- No signup
- No credits or monthly caps
- No “pro” paywall
- No server fees tied to your photos

Everything runs in the browser on your own device. That keeps it private and keeps it free.

---

## Easy to use

1. Open the site
2. Drop up to 15 photos (or paste / browse)
3. Wait for each white version
4. Download the PNGs

That’s it. Works on desktop and mobile. No tutorials needed.

---

## What you get

| | |
| --- | --- |
| **Output** | PNG on solid pure white |
| **Batch** | Up to 15 images at once |
| **Formats** | PNG, JPG, WebP (10 MB each) |
| **Privacy** | On-device only — nothing uploaded |
| **Paste** | Ctrl/Cmd + V from clipboard |
| **Mark** | Soft `thiru` in the bottom-right |

---

## Live

**https://paperwhite-bg.vercel.app**

Try a mug, watch, shoe, or packaging shot. Left = original. Right = pure white when ready.

---

## Why not a cloud tool?

Most background apps send your images to a server. Paperwhite does not.

- Your photos stay on your device
- No account that can be locked or billed later
- Same white result every time (`#ffffff`)

Built for store listings, catalogs, and anyone who just wants a clean white backdrop without the friction.

---

## Tech

| Layer | Choice |
| --- | --- |
| App | TanStack Start + React 19 + TypeScript |
| Style | Tailwind CSS v4 |
| Build | Vite |
| Model | `@imgly/background-removal` (`isnet_quint8`) |
| Host | Vercel |

The model downloads once, then the browser caches it.

---

## Run locally

```sh
git clone https://github.com/sairambn/pure-white-background.git
cd pure-white-background
npm install
npm run dev
```

Open the URL in the terminal (usually `http://localhost:5173`).

```sh
npm run build && npm run preview
```

Node 18+ required.

---

## Structure

```
src/
  routes/
    index.tsx       # UI + batch queue
    __root.tsx      # Shell, meta, fonts
  lib/
    paperwhite.ts   # Prep, removal, watermark, export
  components/ui/
  assets/
public/
  favicon.svg
  robots.txt
```

---

## Notes

- Output is always PNG on `#ffffff`
- Large images are scaled (max edge 2048px) for mobile stability
- HEIC is not supported — export as JPG or PNG first
- A small `thiru` watermark sits in the bottom-right of each export

---

## License

MIT — free to use, free to fork, free for life.

Built for real product photos.
