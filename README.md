# Paperwhite

**[Open the tool →](https://paperwhite-bg.vercel.app)**

Free forever. Easy to use. Your photos never leave your device.

Drop product photos, get pure white backgrounds (`#ffffff`), download everything as one ZIP.

---

## How to use

1. Open the site
2. Drop up to 15 photos (or browse / paste)
3. Wait until they show Ready
4. Hit **Download ZIP**

That’s it. Desktop and mobile.

---

## Features

| | |
| --- | --- |
| **Download** | One ZIP with all ready images |
| **Batch** | Up to 15 images at once |
| **Formats** | PNG, JPG, WebP (10 MB each) |
| **Output** | PNG on solid pure white |
| **Edge feather** | Soften cutout edges (0–5 px) |
| **Privacy** | On-device only — nothing uploaded |
| **Paste** | Ctrl/Cmd + V |
| **Mark** | `© tnmeds` bottom-right |

No account. No credits. No paywall. Free for life.

---

## Live

**https://paperwhite-bg.vercel.app**

---

## Why Paperwhite

Most background tools upload your photos to a server. This one does not.

- Processing stays in the browser
- Same white result every time (`#ffffff`)
- One clean ZIP download — no clutter

Built for product listings, catalogs, and store photos.

---

## Tech

| Layer | Choice |
| --- | --- |
| App | TanStack Start + React 19 + TypeScript |
| Style | Tailwind CSS v4 |
| Build | Vite |
| Model | `@imgly/background-removal` (`isnet_quint8`) |
| Host | Vercel |

---

## Run locally

```sh
git clone https://github.com/sairambn/pure-white-background.git
cd pure-white-background
npm install
npm run dev
```

```sh
npm run build && npm run preview
```

Node 18+ required.

---

## Notes

- Output is always PNG on `#ffffff`
- Large images are scaled (max edge 2048 px) for mobile stability
- HEIC is not supported — export as JPG or PNG first
- Each export has a quiet `© tnmeds` mark in the bottom-right corner

---

## License

MIT — free to use, free to fork, free for life.
