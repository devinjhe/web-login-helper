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

- **`src/popup/popup.ts`** — all popup logic. Queries the active tab URL, calls the storage layer, and renders one of seven states via a `render()` switch:

  | State | Description |
  |---|---|
  | `loading` | Initial fetch in progress |
  | `error` | Unrecoverable error with message |
  | `has-logins` | One or more saved logins for the domain; optionally shows the add form (`showForm: boolean`) |
  | `prompt` | Login page detected, no saved logins yet |
  | `empty` | No logins, no login page detected |
  | `confirm-delete` | Inline confirmation strip; holds `loginId`, `loginMethod`, and `prevState` to restore on cancel |
  | `edit-login` | Edit form pre-filled with an existing `Login`; holds `prevState` to restore on cancel |

  Uses event delegation on a single `click` listener. No framework — pure DOM manipulation via `innerHTML`.

  Key render helpers:
  - `renderForm(login?: Login)` — shared add/edit form. Without an argument it renders a blank form with `data-action="save-login"`; with a `Login` it pre-fills all fields and uses `data-action="save-edit" data-id="..."`.
  - `renderLoginList()` — each item shows method, identifier (if set), notes (if set), and dates. "Added [date]" always shown; "· Edited [date]" appended when `updated_at` differs from `created_at` by more than 1 minute.
  - `renderConfirmDelete()` — red-tinted strip with Cancel / Delete buttons; no DB call until confirmed.

  Async handlers:
  - `handleSave()` — calls `addLogin()`, then `loadData()`
  - `handleUpdate(id)` — calls `updateLogin()`, then `loadData()`
  - `handleDelete(id)` — calls `deleteLogin()`, then `loadData()`

- **`src/background.ts`** — service worker. Maintains a `Set<tabId>` of tabs where a login page was detected. Manages the badge (`!` in amber). Responds to `GET_LOGIN_PAGE_STATE` messages from the popup.
- **`src/content.ts`** — injected into every page. Runs three heuristics to detect login pages (URL path, social sign-in buttons, email+password inputs). Fires once on load; sends `LOGIN_PAGE_DETECTED` to the background if matched.

### Message protocol (popup ↔ background)

| Message type | Direction | Purpose |
|---|---|---|
| `LOGIN_PAGE_DETECTED` | content → background | Login page found; background sets badge |
| `GET_LOGIN_PAGE_STATE` | popup → background | Ask if current tab is a login page |
| `CLEAR_BADGE` | popup → background | User saved a login; clear the badge |

### Storage layer (`src/lib/`)

`supabase.ts` initialises the client once. `storage.ts` is the only place that touches the database — all other code imports from there. The `Login` type is the source of truth for the DB row shape. Exported functions: `getLoginsForDomain`, `addLogin`, `updateLogin`, `deleteLogin`.

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

See `BACKLOG.md` for planned features (auto-open popup on detection, automated tests).
