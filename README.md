# Paperwhite

**Live → [paperwhite-bg.vercel.app](https://paperwhite-bg.vercel.app)**

Free private tool that removes photo backgrounds and places the subject on pure white (`#ffffff`).

Everything runs in the browser. Your image never leaves the device. No account, no watermark, no usage limits.

## Features

- Drag and drop, file browse, or paste from clipboard
- Client-side background removal (IMG.LY model)
- Pure white studio output every time
- PNG download ready for product listings and stores
- Large images auto-scaled for mobile stability
- Keyboard accessible drop zone
- Works on desktop and mobile

## How it works

1. Drop a PNG, JPG, or WebP (max 10 MB)
2. The model cuts out the subject on your device
3. The cutout is placed on a pure white canvas
4. Download a clean PNG

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
    index.tsx      # Tool UI + processing logic
    __root.tsx     # Shell, fonts, meta, error boundaries
  components/ui/   # Shared UI primitives
  assets/          # Before / after example images
  lib/             # Utilities and error helpers
public/
  favicon.svg
  robots.txt
```

## Status

- [x] Production build
- [x] Upload → remove → white canvas → download
- [x] Desktop and mobile layouts
- [x] Paste support and keyboard access
- [x] Large image safety
- [x] Deployed on Vercel

## Notes

- Output is always PNG with a solid `#ffffff` background
- Model downloads on first use and is cached by the browser
- HEIC is not supported — export as JPG or PNG first

MIT · Built for real product photos.
