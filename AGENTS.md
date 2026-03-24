# AGENTS.md - OPERATIONAL RULEBOOK
> **STATUS:** APPROVED
> **PROJECT:** RSS Foods E-Commerce (Web)
> **ARCHITECT:** Antigravity (No Research)
> **TOOL PREFERENCE:** Supabase MCP > CLI
> **RELATED PROJECT:** Admin Dashboard (`../rssa-admin`)

## 1.0 OPERATIONAL PROTOCOLS
**Strict adherence required.**

### 1.1 Tool Use (Supabase MCP)
* **Database Interactions:** You **MUST** use the `Supabase MCP Tool` for querying tables, inspecting schema, and running SQL snippets. Do not hallucinate schema; ask the MCP.
* **Migrations:** Use the MCP tool to apply migrations where supported. Only revert to terminal/CLI (`npx supabase ...`) if the MCP tool lacks specific capability.

### 1.2 Development Environment
* **Package Manager:** `npm` (Lockfile: `package-lock.json`)
* **Framework Initialization:**
    * `npx create-next-app@latest rss-food-web --typescript --tailwind --eslint`
* **UI Library:**
    * `npx shadcn-ui@latest init` (Style: Default, Color: Orange)
* **Theme Support:**
    * Install `next-themes` immediately for Light/Dark mode toggling.

---

## 2.0 VISUAL & UI GUIDELINES (Design Match)
**Reference:** `image_335962.png`

| Element | Style Constraint |
| :--- | :--- |
| **Primary Action** | **Orange (`bg-orange-500`)**. Used for "Search", "Checkout", "Add to Cart". |
| **Secondary Action** | **Deep Violet (`bg-violet-900`)**. Used for "Apply Coupon", "Promotional Banners". |
| **Typography** | Sans-serif (Inter/Geist). Clean, legible. |
| **Components** | Use **shadcn/ui** primitives but override colors to match the RSS Brand. |
| **Dark Mode** | **Mandatory**. Ensure all text contrasts pass accessibility standards in both modes. |

---

## 3.0 TECH STACK CONSTRAINTS

| Layer | Technology | Version / Constraint |
| :--- | :--- | :--- |
| **Frontend** | Next.js | **App Router (Only)**. No `pages/` directory. |
| **Styling** | Tailwind CSS | Utility-first. No custom CSS files except `globals.css`. |
| **Backend** | Supabase | Auth, Database, Realtime, Storage, Edge Functions. |
| **Database** | PostgreSQL 17 | Must enable `postgis` extension. |
| **Language** | TypeScript | **Strict Mode**. No `any`. |
| **Maps** | PostGIS | **Radial Only** (`ST_DWithin`). No Google Maps API. |
| **Payments** | Monnify | **Edge Functions Only**. Never expose keys on client. |

---

## 4.0 THREE-TIER BOUNDARIES

### 🔴 TIER 1: NEVER (Instant Rejection)
1.  **NEVER** implement RLS policies that query `public.user_roles` directly. You **MUST** use `auth.jwt() -> app_metadata`.
2.  **NEVER** use Google Maps, Mapbox, or any paid routing API.
3.  **NEVER** store floating-point numbers for currency. Use **Integers** (kobo).
4.  **NEVER** perform Monnify verification on the Client Side.

### 🟡 TIER 2: ASK FIRST (Architectural Review Required)
1.  Adding new NPM packages larger than 100KB.
2.  Modifying the `wallets` or `ledger_entries` schema structure.
3.  Changing the accepted payment provider from Monnify.

### 🟢 TIER 3: ALWAYS (Mandatory Patterns)
1.  **ALWAYS** use `GEOGRAPHY(Point, 4326)` for location columns.
2.  **ALWAYS** implement `refreshSession()` on the client immediately after a role update.
3.  **ALWAYS** use a Postgres Trigger to sync `public.user_roles` changes to `auth.users.raw_app_metadata`.
4.  **ALWAYS** wrap external API calls (Monnify) in `try/catch` blocks within Edge Functions.