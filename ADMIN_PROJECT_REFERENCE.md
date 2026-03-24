# ADMIN DASHBOARD PROJECT REFERENCE

> **IMPORTANT FOR AI AGENTS:**
> The Admin Dashboard for this application is **NOT** located in this folder.
> It is a separate Next.js project located in the sibling directory: `../rssa-admin`.

## Project Structure
*   **Main App (Customer/Merchant):** `c:\Users\PC USER\Music\rssa1` (Current Folder)
*   **Admin App (Backoffice):** `c:\Users\PC USER\Music\rssa-admin` (Sibling Folder)

## how to Access
To work on the admin dashboard, you must access files outside the current root:
*   **Path:** `../rssa-admin`
*   **Run Command:** `cd ../rssa-admin && npm run dev -- -p 3001`
*   **Local URL:** `http://localhost:3001`

## Shared Resources
Both projects share the same **Supabase Backend**:
1.  **Database URL & Keys:** stored in `.env.local` (Identical in both projects).
2.  **Types:** `src/types/database.types.ts` (Must be kept in sync manually or via script).
3.  **Storage Buckets:** Shared Cloudinary and Supabase Storage.

## Operational Rules
If the user asks to "Update the Admin Dashboard":
1.  Do **NOT** look for admin routes in `src/app/admin` (Legacy/Deleted).
2.  Look in `../rssa-admin/src/app` instead.
3.  Check `../rssa-admin/AGENTS.md` for specific admin project rules.
