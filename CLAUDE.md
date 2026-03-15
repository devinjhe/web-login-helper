# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install       # install dependencies
npm run build     # production build → dist/
npm run dev       # watch mode (rebuilds on file changes)
```

After any code change, reload the extension in Chrome: go to `chrome://extensions` and click the refresh icon on the "Web Login Helper" card.

## Environment

Copy `.env.example` to `.env` and fill in Supabase credentials from **Project Settings → API**:
```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key-here
```

Vite injects these at build time via `import.meta.env`.

## Architecture

The extension has three entry points, each built independently by `vite-plugin-web-extension`:

- **`src/popup/popup.ts`** — all popup logic. Queries the active tab URL, calls the storage layer, and renders one of three states: `has-logins`, `prompt` (login page detected, no saved logins), or `empty`. Uses event delegation on a single `click` listener. No framework — pure DOM manipulation via `innerHTML`.
- **`src/background.ts`** — service worker. Maintains a `Set<tabId>` of tabs where a login page was detected. Manages the badge (`!` in amber). Responds to `GET_LOGIN_PAGE_STATE` messages from the popup.
- **`src/content.ts`** — injected into every page. Runs three heuristics to detect login pages (URL path, social sign-in buttons, email+password inputs). Fires once on load; sends `LOGIN_PAGE_DETECTED` to the background if matched.

### Message protocol (popup ↔ background)

| Message type | Direction | Purpose |
|---|---|---|
| `LOGIN_PAGE_DETECTED` | content → background | Login page found; background sets badge |
| `GET_LOGIN_PAGE_STATE` | popup → background | Ask if current tab is a login page |
| `CLEAR_BADGE` | popup → background | User saved a login; clear the badge |

### Storage layer (`src/lib/`)

`supabase.ts` initialises the client once. `storage.ts` is the only place that touches the database — all other code imports from there. The `Login` type is the source of truth for the DB row shape.

## Database

```sql
CREATE TABLE logins (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  domain text NOT NULL,   -- e.g. "github.com" (www. stripped)
  method text NOT NULL,   -- e.g. "Google", "GitHub", "Email"
  identifier text,        -- optional email/username
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

## Backlog

See `BACKLOG.md` for planned features (edit UI, delete confirmation, notes in UI, auto-open popup on detection).
