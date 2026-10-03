# Paperwhite

**[Open the tool →](https://paperwhite-bg.vercel.app)**

Remove photo backgrounds in your browser and place the subject on pure white (`#ffffff`).

No account. No server upload. No usage limits. Built for product photos, store listings, and clean studio-style shots.

---

## Why Paperwhite

Most background tools send your images to a server. Paperwhite never does.

- Processing stays on your device
- Output is always solid white
- Batch up to 15 images in one go
- Free to use, no signup

Perfect when you need consistent white-background product images without handing photos to a third-party API.

---

## Features

| Feature | Detail |
| --- | --- |
| Batch upload | Up to 15 images at once |
| Input formats | PNG, JPG, WebP (max 10 MB each) |
| Output | PNG on pure `#ffffff` |
| Privacy | 100% on-device processing |
| Paste support | Ctrl/Cmd + V from clipboard |
| Mobile | Responsive layout, large images auto-scaled |
| Access | Keyboard-friendly drop zone |
| Branding | Soft `thiru` mark in the bottom-right corner |

---

## How it works

1. Drop or select up to 15 product photos
2. The model removes the background on your device
3. Each cutout is placed on a pure white canvas
4. Download each ready PNG individually

Images are processed one at a time so the browser stays stable, even on phones.

---

## Live demo

**https://paperwhite-bg.vercel.app**

Try a product photo (mug, watch, shoes, packaging). The original stays on the left; the white version appears on the right when ready.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | TanStack Start + React 19 + TypeScript |
| Styling | Tailwind CSS v4 |
| Build | Vite |
| Removal model | `@imgly/background-removal` (`isnet_quint8`) |
| Hosting | Vercel |

The background-removal model downloads on first use and is cached by the browser afterward.

---

## Local development

```sh
git clone https://github.com/sairambn/pure-white-background.git
cd pure-white-background
npm install
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

```sh
npm run build
npm run preview
```

Requires **Node 18+**.

---

## Project structure

```
src/
  routes/
    index.tsx       # UI, batch queue, drop zone
    __root.tsx      # Shell, fonts, meta tags
  lib/
    paperwhite.ts   # Image prep, removal, watermark, export
  components/ui/    # Shared UI primitives
  assets/           # Example before / after images
public/
  favicon.svg
  robots.txt
```

---

## Notes

- Output is always PNG with a solid white background
- Large images are scaled down (max edge 2048px) for mobile stability
- HEIC / HEIF is not supported — export as JPG or PNG first
- A small `thiru` watermark is drawn in the bottom-right of every export

---

## License

MIT

Built for real product photos.
