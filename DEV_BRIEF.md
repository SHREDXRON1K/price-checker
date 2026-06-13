# Developer Brief — Warung IMG e.V. Price Checker
> Automation & Feature Expansion Brief
> Prepared for: Senior Web Developer
> Project owner: IMG e.V. Frankfurt

---

## Background

This app started as a simple in-store price checker. Customers scan a QR code, land on `/search`, and look up product prices. Staff manage products via a protected `/admin` panel.

The goal now is to expand it into a **lightweight POS + inventory automation system** — without changing the core architecture, and staying within free tier infrastructure (Vercel + Neon).

The guiding principle: **automate repetitive data entry, not judgment calls.** AI is used sparingly, only for batch analysis, never real-time per-request.

---

# Part 1 — High-Level Overview

## What We're Building

Five phases, each buildable and deployable independently.

### Phase 0 — Sales Transaction Foundation
Right now the app has no concept of a "sale." We need a `Sale` table in the database so every transaction — cash or PayPal or IBAN — gets recorded. This is the prerequisite for everything else.

### Phase 1 — Customer-Facing Cart & Checkout
The `/search` page currently only displays prices. We want customers to self-report their purchase: add items to a cart, then submit with their name and payment method. No accounts, no authentication — fully anonymous, trust-based (this is a mosque community shop). On submit, stock auto-decrements and the sale is logged.

### Phase 2 — Admin Transaction History & Alerts
The `/admin` panel needs a transaction history view (Verlauf) so staff can see what was sold, when, and how it was paid. Also: automatic low-stock highlighting so staff know what to reorder.

### Phase 3 — Pricing Engine (Formula-Based)
Products are sourced from Indonesia and sold in Germany, so pricing involves IDR buy price, international shipping cost, EUR exchange rate, and a margin. Right now prices are set manually without a reference. We want a formula-based suggested price in the admin panel — staff can still override, but they have a calculated baseline.

### Phase 4 — Demand Analysis via AI (Batch, Weekly)
After 4–6 weeks of sales data accumulates, we want a weekly batch job that queries the sales history, summarizes it, and sends it to Claude API for a restock recommendation. This runs once a week (manual trigger or cron), not on every request — keeping API costs near zero.

### Phase 5 — Notifications (Nice to Have)
Email alerts for low stock and weekly restock summaries, via Resend free tier or Gmail SMTP.

---

## Design Decisions (Already Agreed)

| Decision | Choice | Reason |
|---|---|---|
| Trust model | No pending confirmation — sales post immediately | Mosque community, honor system |
| Payment options | Bar / PayPal / IBAN | Three options, info-only, no payment processing |
| PayPal | Not integrated — just recorded as payment method | Privacy concerns, personal account |
| Buyer name | Required field, no validation | Traceability without enforcement |
| Cart input | Both +/- buttons on grid AND drag & drop to trolley | Dual interaction model |
| AI usage | Batch only, not real-time | Cost control, token efficiency |
| Infrastructure budget | €0 target | Vercel + Neon free tier |

---

# Part 2 — Detailed Technical Specification

---

## Phase 0 — Database: Sale Table

### Prisma Schema Addition

```prisma
model Sale {
  id            String   @id @default(cuid())
  productId     String
  product       Product  @relation(fields: [productId], references: [id])
  quantity      Int
  priceAtSale   Int      // in cents, snapshot at time of sale
  paymentMethod String   // "bar" | "paypal" | "iban"
  buyerName     String
  createdAt     DateTime @default(now())
}

// Add to existing Product model:
// sales Sale[]
```

> `priceAtSale` must be a snapshot — not a FK to current price. Prices change; historical records must not.

### Migration
```bash
npx prisma migrate dev --name add_sale_table
```

### New API Endpoint

**`POST /api/sales`**

Request body:
```json
{
  "items": [
    { "productId": "abc123", "quantity": 2 }
  ],
  "buyerName": "Budi",
  "paymentMethod": "bar"
}
```

Logic (in a single Prisma transaction):
1. For each item: fetch current `priceCents` from `Product`
2. Insert one `Sale` record per item
3. Decrement `Product.stock` by `quantity`
4. If any product stock would go below 0: reject the entire transaction with 400

Response (success):
```json
{
  "success": true,
  "saleIds": ["sale_id_1", "sale_id_2"]
}
```

Response (stock error):
```json
{
  "success": false,
  "error": "insufficient_stock",
  "product": "Indomie Goreng"
}
```

Use `prisma.$transaction([...])` to ensure atomicity — either everything saves or nothing does.

---

## Phase 1 — Cart UI on /search Page

### Cart State (Client-Side Only)

```typescript
type CartItem = {
  productId: string
  name: string
  priceCents: number
  quantity: number
}
```

Managed via `useState`. No persistence needed (cart resets on page reload is acceptable).

### Product Card Changes

Each product card in the search results grid gets:
- A `+ Tambah` button (visible always, not just on hover)
- `draggable={true}` attribute
- `onDragStart` handler that sets `dataTransfer` with the product data

```tsx
onDragStart={(e) => {
  e.dataTransfer.setData('productId', product.id)
  e.dataTransfer.setData('productName', product.name)
  e.dataTransfer.setData('priceCents', String(product.priceCents))
}}
```

Button behavior: clicking `+ Tambah` adds 1 unit to cart. If item already in cart, increments quantity.

If `product.stock === 0`: disable the button and drag, show "Habis / Ausverkauft" label.

### Trolley Icon (Top Right)

```tsx
// Positioned fixed top-right, always visible during scroll
// Semi-transparent background: opacity 0.75, backdrop with subtle border
// Badge: shows total item count (sum of all quantities)
// Drop zone: onDragOver + onDrop handlers
// Label when empty: "Hier ablegen / Taruh di sini"
```

On `onDrop`: read `productId` from `dataTransfer`, add to cart state.

On click: open cart drawer.

### Cart Drawer

Slides in from the right on desktop, bottom sheet on mobile. Not `position: fixed` — use a state-controlled overlay pattern compatible with the existing layout.

Contents (top to bottom):
1. Header: "Warenkorb / Keranjang" + close button
2. Item grid — each item shows:
   - Product name
   - `[-]` qty `[+]` controls
   - Subtotal for that item (`priceCents × quantity / 100` formatted as `€X.XX`)
   - Remove button (quantity reaches 0 → item removed from cart)
3. Divider
4. Total: sum of all subtotals
5. Form:
   - `Nama / Name` — text input, required, no other validation
   - Payment method toggle: three buttons `Bar` `PayPal` `IBAN` — one active at a time, default `Bar`
   - Date: shown as read-only, value = `new Date().toLocaleDateString('de-DE')`
6. Submit button: `Bestätigen / Konfirmasi`
   - Disabled if: cart empty OR name field empty
   - On click: POST to `/api/sales`, show loading state
   - On success: clear cart, show brief confirmation ("Danke! / Terima kasih!"), close drawer
   - On error (stock): show inline error with product name

### Quantity Display Note

All price calculations must use integer cents internally. Only convert to EUR display at render time:
```typescript
const formatEUR = (cents: number) => `€${(cents / 100).toFixed(2)}`
```

---

## Phase 2 — Admin Panel: Verlauf & Alerts

### New Page: `/admin/verlauf`

Fetch from new endpoint `GET /api/admin/sales` with optional query params:
- `?from=2024-01-01&to=2024-01-31`
- `?paymentMethod=bar`
- `?buyerName=Budi`

Display as a table:
| Tanggal | Nama | Barang | Qty | Harga | Pembayaran |
|---|---|---|---|---|---|

Include a summary row at the bottom: total revenue for the filtered period.

Export button: `GET /api/admin/sales/export` returns CSV.

### Low Stock Highlighting

In the existing product list in `/admin`, add visual indicator:

```typescript
const LOW_STOCK_THRESHOLD = 5 // configurable via env var: NEXT_PUBLIC_LOW_STOCK_THRESHOLD

// In product row:
// stock <= 0 → red badge "Habis"
// stock <= threshold → amber badge "Hampir Habis"
// stock > threshold → no badge
```

### Sales Summary Widget

On the `/admin` dashboard (or top of product list), add two metric cards:
- Today's total sales (€)
- This week's total sales (€)

These are simple SQL aggregations — no AI:
```sql
SELECT SUM(price_at_sale * quantity) 
FROM "Sale" 
WHERE created_at >= NOW() - INTERVAL '7 days'
```

---

## Phase 3 — Pricing Engine

### Schema Addition to Product

```prisma
model Product {
  // existing fields...
  buyPriceIDR      Int?    // purchase price in IDR cents (optional, staff fills in)
  shippingCostEUR  Int?    // allocated shipping cost in EUR cents per unit
  marginPercent    Int?    // desired margin e.g. 30 = 30%
}
```

### Suggested Price Formula

```typescript
function getSuggestedPrice(
  buyPriceIDR: number,
  exchangeRate: number,       // fetched from free API or manually set by admin
  shippingCostEUR: number,
  marginPercent: number
): number {
  const baseCostEUR = (buyPriceIDR / 100) / exchangeRate
  const totalCostEUR = baseCostEUR + (shippingCostEUR / 100)
  const suggestedEUR = totalCostEUR * (1 + marginPercent / 100)
  return Math.round(suggestedEUR * 100) // return in cents
}
```

Exchange rate: store a manually-updatable `exchangeRate` value in a simple `Config` table or `.env`. Do not auto-fetch real-time rates (unnecessary complexity for now).

### Admin UI

In the product edit form, add the three new fields. Below the `priceCents` input, show:

```
Suggested price: €X.XX  [based on current formula]
Current price:   €X.XX  [editable — staff can override]
```

If `buyPriceIDR` is null, hide the suggested price entirely.

---

## Phase 4 — AI Demand Analysis (Batch)

> **Do not build this until 4–6 weeks of sales data exists.**

### Trigger

Manual button in `/admin` panel: "Analisis Stok Minggu Ini". Also optionally a Vercel cron job (`vercel.json`) set to run every Monday morning.

### Data Preparation (No AI Tokens Used Here)

Before calling Claude API, aggregate the data with SQL:

```sql
SELECT 
  p.name,
  SUM(s.quantity) as total_sold,
  COUNT(DISTINCT DATE(s.created_at)) as days_with_sales,
  MAX(s.created_at) as last_sold,
  p.stock as current_stock
FROM "Sale" s
JOIN "Product" p ON s.product_id = p.id
WHERE s.created_at >= NOW() - INTERVAL '30 days'
GROUP BY p.id, p.name, p.stock
ORDER BY total_sold DESC
```

### Claude API Call

Model: `claude-haiku-*` (cheapest, sufficient for this task)

System prompt:
```
You are a stock management assistant for a small Indonesian grocery shop in Frankfurt, Germany.
Analyze the sales data and return a JSON array of restock recommendations.
Return ONLY valid JSON, no markdown, no explanation.
Format: [{"productName": string, "recommendation": "reorder" | "monitor" | "ok", "reason": string}]
```

User message: the SQL result as a compact JSON string.

Expected output: parsed JSON array rendered as a table in the admin panel under "Rekomendasi Stok".

### Cost Estimate

~500 tokens input + ~300 tokens output per run × 1 run/week = ~800 tokens/week. At Haiku pricing this is effectively negligible (< €0.01/month).

---

## Phase 5 — Notifications

### Low Stock Email

Trigger: after any `POST /api/sales` that causes a product's stock to drop to or below threshold.

Implementation: use **Resend** free tier (100 emails/day limit, sufficient).

```typescript
// In /api/sales handler, after transaction commits:
const lowStockItems = updatedProducts.filter(p => p.stock <= LOW_STOCK_THRESHOLD)
if (lowStockItems.length > 0) {
  await sendLowStockAlert(lowStockItems) // fire-and-forget, don't await in request
}
```

Email content: plain text list of product names + current stock levels.

### Weekly Restock Report

Vercel cron job every Monday 08:00 CET:

```json
// vercel.json
{
  "crons": [{
    "path": "/api/cron/weekly-report",
    "schedule": "0 7 * * 1"
  }]
}
```

The `/api/cron/weekly-report` endpoint:
1. Queries top 10 low/out-of-stock products
2. Queries top 10 best sellers from past 7 days
3. Sends summary email to configured `ADMIN_EMAIL` env var

---

## Environment Variables Needed

```env
# Existing
DATABASE_URL=
ADMIN_USERNAME=
ADMIN_PASSWORD=

# New
LOW_STOCK_THRESHOLD=5
ADMIN_EMAIL=pengurus@warung.de
RESEND_API_KEY=                  # Phase 5 only
CLAUDE_API_KEY=                  # Phase 4 only
IDR_EUR_EXCHANGE_RATE=0.000058   # Phase 3, manually updated
```

---

## Implementation Order (Recommended)

```
Phase 0  →  Phase 1  →  Phase 2  →  [collect 4–6 weeks data]  →  Phase 3  →  Phase 4  →  Phase 5
```

Phases 3, 4, and 5 are independent of each other and can be parallelized after Phase 2.

---

## Out of Scope (For Now)

- PayPal API integration / redirect — recorded as info only
- WhatsApp bot
- Multi-language auto-translation
- Customer accounts or authentication
- Real-time exchange rate fetching
- POS hardware integration
