# Project: Price Checker
A community price checker and self-checkout app for a mosque shop (IMG e.V. Frankfurt).

---

## Stack
- Next.js (TypeScript, App Router)
- Prisma ORM
- PostgreSQL via Neon (cloud-hosted)
- Tailwind CSS + custom CSS variables
- ESLint

---

## Folder Structure
- `app/` — Next.js app router (pages, layouts, components)
  - `app/search/` — public product search + cart (QR code landing page)
  - `app/admin/` — protected admin panel
  - `app/admin/verlauf/` — sales transaction history (Phase 2)
  - `app/api/search/` — product search API
  - `app/api/sales/` — sales POST endpoint (Phase 0)
  - `app/api/admin/` — admin CRUD + sales history APIs
- `prisma/` — schema and migrations
- `public/` — static assets
  - `public/logomasjid.png` — mosque logo, always shown in header
- `lib/` — shared utilities
  - `lib/prisma.ts` — single shared Prisma client instance
  - `lib/format.ts` — formatEUR(cents) utility
  - `lib/types.ts` — shared TypeScript types

---

## Conventions
- TypeScript strict mode
- camelCase variables, PascalCase components
- Modular, single-responsibility functions
- App router: server components by default, `use client` only when needed
- Prisma client via single shared instance from `lib/prisma.ts`
- All prices in integer cents internally — never floats
- Only convert cents to EUR display at render time via `formatEUR` from `lib/format.ts`

---

## Common Commands
- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run lint` — run ESLint
- `npx prisma migrate dev --name <name>` — run migrations
- `npx prisma generate` — regenerate Prisma client

---

## DO NOT Touch
- `.env`
- `node_modules/`
- `package-lock.json`
- Any existing migration files in `prisma/migrations/`

---

## Next.js Version Warning
This may have breaking changes from standard Next.js conventions.
Before writing any Next.js code, check `node_modules/next/dist/docs/` for the actual API.
Heed all deprecation notices — do not assume standard patterns apply.

---

## Database Schema

### Product (existing)
```prisma
model Product {
  id           String   @id @default(cuid())
  name         String
  barcode      String?
  priceCents   Int
  stock        Int
  updatedAt    DateTime @updatedAt
  sales        Sale[]
}
```

### Sale (Phase 0)
```prisma
model Sale {
  id            String   @id @default(cuid())
  productId     String
  product       Product  @relation(fields: [productId], references: [id])
  quantity      Int
  priceAtSale   Int      // cents snapshot at time of sale — never reference live price
  paymentMethod String   // "bar" | "paypal" | "iban"
  buyerName     String
  createdAt     DateTime @default(now())
}
```

> `priceAtSale` is a snapshot. Historical records must never change when product prices are updated.

---

## API Contracts

### Existing
- `GET /api/search?q=&limit=100` — search products, returns Product[]
- `GET /api/admin/products` — list all products (protected)
- `POST /api/admin/products` — create product (protected)
- `GET /api/admin/export` — export products CSV (protected)
- `POST /api/admin/import` — bulk import products CSV (protected)

### Phase 0
- `POST /api/sales` — submit cart, log sales, decrement stock
  - Body: `{ items: [{productId, quantity}], buyerName, paymentMethod }`
  - Uses `prisma.$transaction` — atomic, all-or-nothing
  - Rejects with 400 if any stock would go below 0
  - Returns: `{ success: true, saleIds: [] }` or `{ success: false, error: "insufficient_stock", product: "name" }`
  - Has in-memory IP rate limiting: max 10 requests per minute per IP

### Phase 2
- `GET /api/admin/sales` — paginated sales history (protected)
  - Query params: `from`, `to`, `paymentMethod`, `buyerName`, `page` (default 1), `limit` (default 20)
  - Returns: `{ sales: [...], total, page, totalPages, revenueTotal }`
- `GET /api/admin/sales/export` — sales history CSV (protected)

---

## Auth & Security
- `/admin` and `/api/admin/*` protected via HTTP Basic Auth in `middleware.ts`
- Credentials from `.env`: `ADMIN_USER` and `ADMIN_PASSWORD`
- `/search` and `/api/sales` are fully public — no auth
- `POST /api/sales` has IP-based rate limiting (in-memory Map, no extra packages)

---

## UI Design Reference
Design style based on: https://masjidindonesia.de
Simple, clean, community-focused — NOT a SaaS dashboard. Feels like a community shop.

### Design Tokens (source of truth: `app/globals.css`)
```
--bg-base:      #fafafa   — page background
--bg-surface:   #ffffff   — cards, panels
--accent:       #2d6a4f   — earthy mosque green, used sparingly
--accent-light: #52b788   — hover states
--text-primary: #1a1a1a   — main text
--text-muted:   #6b7280   — secondary text
--border:       #e0e0e0   — card borders
--font-display: Georgia, serif   — headings only
--font-body:    Inter, sans-serif — all body text
--radius-md:    6px       — cards and inputs
--transition:   150ms ease
```

### Component Classes (use from `globals.css`)
- `.product-grid` — CSS grid, auto-fill, minmax(200px, 1fr), gap 1rem
- `.product-card` — white bg, border, radius, hover border accent
- `.price` — green (#2d6a4f), 1.25rem, bold
- `.stock-badge` — pill shape
- `.stock-in` — bg #d1fae5, text #2d6a4f
- `.stock-low` — bg #fef3c7, text #d97706
- `.stock-out` — bg #fee2e2, text #ef4444
- `.search-bar` — border input, focus turns accent green

### Header (all pages)
- Logo: `public/logomasjid.png` (40×40) — always top left
- Style: white bar, bottom border `1px solid #e0e0e0`
- Nav links right, green accent on active

### Hard Rules — NEVER violate these
- NO dark backgrounds
- NO blue buttons — `--accent` green only
- NO gradients
- NO heavy shadows
- NO border-radius above 10px
- NO generic Tailwind defaults — always use CSS variables
- NO animations except subtle hover border color transition
- Always respect `prefers-reduced-motion`

---

## Search Page (`app/search/page.tsx`)

### Default State
- ALL products load on mount via `GET /api/search?q=&limit=100`
- Grid visible immediately — no empty state, no "search to see products"

### Search State
- Typing filters the grid in real time
- Grid never disappears — always visible
- No matches: show "no products matched" inside the grid area

### Product Card
- Name: bold, Georgia serif, `--text-primary`
- Price: `--accent` green, 1.25rem, bold
- Stock badge: pill, color per stock level (see `.stock-in/.stock-low/.stock-out`)
- Hover: border color `--accent-light` only

### Cart (Phase 1)
- `+ Tambah` button on every card, always visible
- `stock === 0` → button disabled, show "Habis / Ausverkauft"
- Cards are draggable — drag to trolley icon to add
- Trolley icon: fixed top-right, semi-transparent, badge shows total quantity
- Trolley label when empty: "Hier ablegen / Taruh di sini"
- Click trolley → opens cart drawer

### Cart Drawer
- Desktop: slides in from right
- Mobile: bottom sheet
- Contents:
  1. Header: "Warenkorb / Keranjang" + close button
  2. Item list: name, `[-]` qty `[+]`, subtotal, remove at qty 0
  3. Order total
  4. Name input: required, placeholder "Nama / Name"
  5. Payment toggle: `Bar` | `PayPal` | `IBAN` — default Bar, info-only no processing
  6. Date: read-only, `new Date().toLocaleDateString('de-DE')`
  7. Submit: "Bestätigen / Konfirmasi"
     - Disabled if cart empty or name empty
     - POST to `/api/sales` on click
     - Loading state during request
     - Success: clear cart, show "Danke! / Terima kasih!", close drawer
     - Stock error: inline error with product name

---

## Admin Panel (`app/admin/`)

### Product List (`app/admin/page.tsx`)
- Low stock badges on every product row:
  - `stock === 0` → red badge "Habis"
  - `stock <= 5` → amber badge "Hampir Habis"
- Metric cards at top:
  - Today's total sales (€)
  - This week's total sales (€)

### Sales History (`app/admin/verlauf/page.tsx`) — Phase 2
- Filter controls: date range, paymentMethod, buyerName
- Table columns: Tanggal | Nama | Barang | Qty | Harga | Pembayaran
- Summary row: total revenue for filtered period
- Pagination (20 per page)
- Export CSV button → `GET /api/admin/sales/export`

---

## Trust Model
- No pending confirmation — sales post immediately
- Honor system — mosque community shop
- No customer accounts, fully anonymous search
- Buyer name required but not validated beyond presence

---

## Environment Variables
```
DATABASE_URL=          # Neon PostgreSQL connection string
ADMIN_USER=            # HTTP Basic Auth username
ADMIN_PASSWORD=        # HTTP Basic Auth password
LOW_STOCK_THRESHOLD=5  # Stock level for amber warning
```
