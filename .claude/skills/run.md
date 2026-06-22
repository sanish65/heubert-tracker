# Run — Heubert Tracker

Launch the dev server and verify a change works in the browser.

## Start the server

```bash
cd "/home/sanish/heubert tracker/heubert-tracker" && npm run dev
```

The app starts at **http://localhost:3000** (Next.js App Router, port 3000).

## Login

- The app requires Google OAuth to enter. The logged-in user's email must match an employee's `work_email` or `personal_email` in the `employees` Supabase table.
- The admin users are: `sanish@heubert.com`, `nikhil@heubert.com`, `pranay@heubert.com`, `pratisha@heubert.com`, `developers@heubert.com`.
- If the browser already has a session cookie, it will bypass login.

## App structure to navigate

- **/** — Main SPA. Tab navigation persists in `localStorage` key `activeTab`. Tabs: Dashboard, Late Fines, Standup Fines, Leaves, Words, Events, Planning Poker, Retrospective, Employees, Memories.
- **/meeting** — Start Meeting page (daily sync dashboard).
- **/planning-poker/[sessionId]** — Live collaborative planning poker.
- **/retrospective/[sessionId]** — Live collaborative retrospective board.
- **/login** — Google OAuth entry point.

## Verifying a change

1. Run the dev server in background: `npm run dev &`
2. Wait for "Ready on http://localhost:3000" in output.
3. Navigate to the relevant tab/page.
4. Check the golden path for the changed feature.
5. Watch the browser console for JS errors.
6. Check the terminal for server-side errors (API routes, Server Components).

## Key dev notes

- The project uses **JavaScript only** (no TypeScript). No `.ts`/`.tsx` files.
- Styling is **CSS-only** via `src/app/globals.css` (6,400+ lines). No Tailwind, no CSS-in-JS library (though some inline styles exist for dynamic theming).
- Data is fetched **directly from Supabase** in the React Context (`src/context/AppContext.js`) — no traditional REST API for CRUD operations. Supabase client is at `src/lib/supabase.js`.
- Real-time collaborative features (Planning Poker, Retrospective) use **polling every 2–2.5 seconds** via `src/app/api/poker/route.js` and `src/app/api/retro/route.js`.
- Before writing any Next.js code, read the relevant guide in `node_modules/next/dist/docs/`.
