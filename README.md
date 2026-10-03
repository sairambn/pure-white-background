# Paperwhite

Free private tool that removes photo backgrounds and puts the subject on pure white (#ffffff).

Everything runs in the browser. Your image never leaves the device. No account, no watermark, no usage limits.

**Live** → [paperwhite-bg.vercel.app](https://paperwhite-bg.vercel.app)

## What it does

1. Drop a PNG, JPG or WebP (max 10 MB).
2. The IMG.LY model cuts out the subject on your device.
3. The cutout is placed on a pure white canvas.
4. Download a clean PNG ready for product listings, stores or print.

## Stack

- TanStack Start + React 19 + TypeScript
- Vite + Tailwind CSS v4
- `@imgly/background-removal` (client-side, isnet_quint8 model)
- Local processing only — no server upload

## Quick start

```sh
git clone https://github.com/sairambn/pure-white-background.git
cd pure-white-background
npm install
npm run dev
```

Open the URL shown in the terminal (usually http://localhost:5173).

```sh
npm run build
npm run preview
```

## Project structure

```
src/
  routes/
    index.tsx      # Main tool UI + processing logic
    __root.tsx     # Shell, fonts, meta, error boundaries
  components/ui/   # Shared UI primitives
  assets/          # Example before/after images
  lib/             # Utilities and error helpers
public/
  favicon.svg
  robots.txt
```

## Roadmap status

- [x] Clean production build
- [x] Full upload → remove → white canvas → download flow
- [x] Desktop and mobile layouts checked
- [x] Issues fixed and re-verified
- [x] Deployed on Vercel with free domain

## Notes

- Processing is 100 % client-side. Photos stay on the user’s device.
- Output is always PNG with a solid #ffffff background.
- Model downloads on first use and is cached by the browser.

MIT · Built for real product photos.
