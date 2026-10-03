# Paperwhite

**Live → [paperwhite-bg.vercel.app](https://paperwhite-bg.vercel.app)**

Free private tool that removes photo backgrounds and places the subject on pure white (`#ffffff`).

Everything runs in the browser. Your image never leaves the device. No account, no watermark, no usage limits.

## Features

- Upload up to **15 images** at once
- Drag and drop, file browse, or paste from clipboard
- Client-side background removal (IMG.LY model)
- Pure white studio output every time
- Per-image PNG download
- Large images auto-scaled for mobile stability
- Keyboard accessible drop zone
- Works on desktop and mobile

## How it works

1. Drop up to 15 PNG, JPG, or WebP files (10 MB each)
2. Each image is processed one by one on your device
3. The cutout is placed on a pure white canvas
4. Download each ready PNG

## Stack

| Layer | Tech |
| --- | --- |
| Framework | TanStack Start + React 19 + TypeScript |
| Build | Vite + Tailwind CSS v4 |
| Removal | `@imgly/background-removal` (isnet_quint8) |
| Deploy | Vercel |

Processing is fully local. Nothing is uploaded to a server.

## Quick start

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

Requires Node 18+.

## Project structure

```
src/
  routes/
    index.tsx      # Tool UI + batch queue
    __root.tsx     # Shell, fonts, meta, error boundaries
  lib/
    paperwhite.ts  # Image prep + background removal
  components/ui/   # Shared UI primitives
  assets/          # Before / after example images
public/
  favicon.svg
  robots.txt
```

## Status

- [x] Production build
- [x] Upload → remove → white canvas → download
- [x] Batch up to 15 images
- [x] Desktop and mobile layouts
- [x] Paste support and keyboard access
- [x] Large image safety
- [x] Deployed on Vercel

## Notes

- Output is always PNG with a solid `#ffffff` background
- Model downloads on first use and is cached by the browser
- Images process one at a time to keep the browser stable
- HEIC is not supported — export as JPG or PNG first

MIT · Built for real product photos.
