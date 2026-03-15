# CLAUDE.md — Web Login Helper

## Commands
```bash
npm install       # install dependencies
npm run build     # production build → dist/
npm run dev       # watch mode (rebuilds on file changes)
```

## Loading the extension in Chrome
1. Go to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** → select the `dist/` folder
4. After any code change: run `npm run build`, then click the refresh icon on the extension card

## Architecture

```
src/
  popup/
    popup.html      # extension popup shell
    popup.ts        # all popup logic and rendering
    popup.css       # popup styles
  lib/
    supabase.ts     # initialises Supabase client from VITE_SUPABASE_* env vars
    storage.ts      # typed CRUD helpers: getLoginsForDomain, addLogin, updateLogin, deleteLogin
  background.ts     # service worker: tracks login page detections, manages badge
  content.ts        # injected into all pages: detects login pages, sends message to background
manifest.json       # MV3 manifest
```

## Message flow
- `content.ts` → `background.ts`: `LOGIN_PAGE_DETECTED` (with domain)
- `popup.ts` → `background.ts`: `GET_LOGIN_PAGE_STATE` (returns `{ detected: boolean }`)
- `popup.ts` → `background.ts`: `CLEAR_BADGE`

## Environment variables
Copy `.env.example` to `.env` and fill in:
```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key-here
```

## Database schema
```sql
CREATE TABLE logins (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  domain text NOT NULL,
  method text NOT NULL,
  identifier text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

## Backlog
See `BACKLOG.md` for planned features.
