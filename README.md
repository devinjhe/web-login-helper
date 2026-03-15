# Web Login Helper

A Chrome extension that remembers which login method you use on each website (e.g. "Google", "GitHub", "Email - you@gmail.com"). Data is stored in Supabase so it can be queried from other apps.

## Features

- Auto-detects login pages and prompts you to save your login method
- Badge indicator on the extension icon when a login page is detected
- View, add, and delete saved logins per domain
- Data stored in Supabase (PostgreSQL) — accessible via REST API from any app

## Tech Stack

- Chrome Extension (Manifest V3)
- TypeScript + Vite
- Supabase (`@supabase/supabase-js`)
- Vanilla HTML/CSS

## Setup

### Prerequisites
- Node.js ≥ 18
- A [Supabase](https://supabase.com) project (free tier works)
- Chrome with Developer mode enabled

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```
Fill in your Supabase project URL and anon key from **Project Settings → API**.

### 3. Create the database table
Run this in the Supabase SQL editor:
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

### 4. Build
```bash
npm run build
```

### 5. Load in Chrome
1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `dist/` folder

## Development

```bash
npm run dev   # watch mode — rebuilds on file changes
```

After each rebuild, click the refresh icon on the extension card in `chrome://extensions`.
