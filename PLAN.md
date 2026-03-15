# Plan: Web Login Helper Chrome Extension

## Context
A Chrome extension that helps the user remember which login method (e.g. "Google", "Email - you@gmail.com") they use on each website. Data is stored in Supabase (PostgreSQL) so it can be queried from other apps in the future. The extension auto-detects login pages and prompts the user to save, but also supports fully manual entry.

---

## Tech Stack
- **TypeScript** throughout
- **Vite** for bundling (`vite-plugin-web-extension` for MV3)
- **Supabase JS client** (`@supabase/supabase-js`)
- **Vanilla HTML/CSS** for the popup
- **Manifest V3** Chrome extension

---

## Completed Tasks

- [x] Task 1: Project scaffolding (Vite + MV3 + TypeScript)
- [x] Task 2: Supabase database schema and seed data
- [x] Task 3: Storage layer (typed CRUD helpers)
- [x] Task 4: Popup UI (three states: has logins, prompt, empty)
- [x] Task 5: Popup wired to live Supabase data
- [x] Task 6: Login page detection content script
- [x] Task 7: Badge indicator (background service worker)
- [x] Task 8: End-to-end integration and UX polish

---

## Backlog
See `BACKLOG.md` for planned improvements.
