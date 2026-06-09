# Project: Price Checker

## Stack
- Next.js (TypeScript)
- Prisma ORM
- SQLite (dev.db)
- Tailwind CSS (postcss config present)
- ESLint

## Folder Structure
- `app/` - Next.js app router (pages, layouts, components)
- `prisma/` - schema and migrations
- `public/` - static assets
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

## UI & Design Rules

### Anti-AI-Look Checklist
- NO generic blue primary buttons (`#3B82F6`, `#2563EB`)
- NO card-heavy layouts with identical rounded corners everywhere
- NO gradient hero sections with big bold stat + small label
- NO numbered section markers (01 / 02 / 03) unless content is truly sequential
- NO Tailwind default spacing without intentional type scale
- NO Inter + gray palette as default — pick something with personality

### Typography
- Display font: pick ONE characterful font used sparingly (headings only)
- Body font: clean, readable, complementary to display
- Set a real type scale — don't let Tailwind defaults decide

### Color
- Define a palette of 4–6 named hex values in globals.css or tailwind.config
- One accent color max, used with restraint
- Background should NOT be pure white (#fff) or generic dark (#111)

### Layout
- Structure must encode meaning — if something is in a grid, there's a reason
- Avoid equal-weight cards for everything — use hierarchy
- Spacing should be intentional, not Tailwind's p-4 everywhere

### Motion
- One orchestrated animation beats scattered effects
- No animation on every element — pick where it actually adds value
- Respect `prefers-reduced-motion`

### Copy / Text
- Write from the user's side — what they control, not how the system works
- Active voice: "Save changes" not "Submit"
- No filler words, no "Welcome to..." hero text

### When building UI, always ask:
- Does this look like it could be ANY website? → Redesign
- Is the font choice intentional for a price-checking tool? → Justify it
- Is there one signature element that makes this memorable? → Add it

