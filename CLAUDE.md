# Project: Price Checker
A community price checker app for a mosque shop (IMG e.V. Frankfurt).

## Stack
- Next.js (TypeScript)
- Prisma ORM
- SQLite (dev.db)
- Tailwind CSS
- ESLint

## Folder Structure
- `app/` - Next.js app router (pages, layouts, components)
- `prisma/` - schema and migrations
- `public/` - static assets (logo: public/logomasjid.png)
- `dev.db` - local SQLite database

## Conventions
- TypeScript strict mode
- camelCase variables, PascalCase components
- Modular, single-responsibility functions
- App router conventions (server components by default, use client only when needed)
- Prisma client via single shared instance

## Common Commands
- `npm run dev` - start dev server
- `npm run build` - production build
- `npm run lint` - run ESLint

## DO NOT touch
- `.env`
- `dev.db` (do not delete or reset)
- `node_modules/`
- `package-lock.json`

## Next.js Version Warning
This may have breaking changes from standard Next.js conventions.
Before writing any Next.js code, check `node_modules/next/dist/docs/` for the actual API.
Heed all deprecation notices — do not assume standard patterns apply.

## UI Design Reference
Design style based on: https://masjidindonesia.de
This is a simple, clean community website for an Indonesian mosque in Frankfurt.

### Vibe
- Light, welcoming, community-focused — NOT a SaaS dashboard
- Feels like a simple shop, not a tech product
- Clean and readable for all ages

### Design Tokens (source of truth: app/globals.css)
- `--bg-base: #fafafa` — page background
- `--bg-surface: #ffffff` — cards, panels
- `--accent: #2d6a4f` — earthy mosque green, used sparingly
- `--accent-light: #52b788` — hover states
- `--text-primary: #1a1a1a` — main text
- `--text-muted: #6b7280` — secondary text
- `--border: #e0e0e0` — card borders
- `--font-display: Georgia, serif` — headings only
- `--font-body: Inter, sans-serif` — all body text
- `--radius-md: 6px` — cards and inputs

### Layout Rules
- ALL products visible in a grid by default on page load
- Search/filter narrows the grid, never hides it completely
- Grid: auto-fill, minmax(200px, 1fr)
- Each product card shows: name, price (green), stock badge

### Component Classes (use from globals.css)
- `.product-grid` — product grid container
- `.product-card` — individual product card
- `.price` — price display (green, large)
- `.stock-in` / `.stock-low` / `.stock-out` — stock badges
- `.search-bar` — search input

### Header
- Logo: use `public/logomasjid.png` — always visible top left
- Same header style as masjidindonesia.de — logo left, nav links right
- Clean white header, green accent on active links

### Hard Rules
- NO dark backgrounds
- NO blue buttons — use `--accent` green only
- NO gradients
- NO heavy shadows
- NO animations except subtle hover border color change
- NO bubbly border-radius above 10px
- NO generic Tailwind defaults — always use CSS variables from globals.css
- Always respect `prefers-reduced-motion`

## Search Page — Product Grid (search/page.tsx)

### Default State (no search)
- ALL products loaded on page mount via GET /api/search?q=&limit=100
- Displayed immediately in a grid — no empty state, no "search to see products"
- Grid: CSS grid, auto-fill, minmax(200px, 1fr), gap 1rem

### Search State
- As user types, grid filters to matching products
- Grid never disappears — always visible
- If no matches: keep grid container, show "no products matched" text inside

### Each Product Card (.product-card)
- Name: bold, Georgia serif, #1a1a1a
- Price: #2d6a4f, 1.25rem, bold
- Stock badge: pill shape, color based on stock level
  - in stock → bg #d1fae5, text #2d6a4f
  - low (≤5) → bg #fef3c7, text #d97706  
  - out of stock → bg #fee2e2, text #ef4444
- Hover: border color #52b788, no other effect