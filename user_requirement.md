# User Requirements (Living Document)

This document captures the evolving requirements and preferences expressed during this project. I will keep it up‑to‑date as new requests arrive in this chat.

## Project Setup & Structure
- Use SvelteKit (TS), Tailwind utilities, and epub.js (Rendition API).
- Source lives at the repository root (no nested app folder).
- Books live in `/Books/` at the project root. Public serving path remains `/EPUB/...` via a symlink (`static/EPUB -> ../Books`).
- Scanner reads from `/Books/` and generates public URLs under `/EPUB/...`.
- Future: allow configurable library path via a simple config file.

## Library Browser
- Recursively scan `/Books/` for `.epub`, display the exact folder structure.
- Collapsible sidebar for folders (with smooth transitions).
- Default landing view is “Collection Overview” (shows all books, sorted by Updated descending).
- Sidebar includes “Collection Overview” (clicking returns to the all‑books view).
- Order folders alphabetically, but keep Magazines shelf at the bottom.
- When selecting Magazines, list all descendant EPUBs (no empty state just because issues are nested).
- For each book card:
  - Show cover, Title, Author.
  - Show metadata strip: Size + Updated only (no filename).
  - All metadata labels and trails (e.g., category paths) must adapt to theme and remain legible.
- Remove magazine outline panel from the card (no expanded outline on tiles).

## Reader Experience
- Use epub.js `rendition.display(href)` (no page reloads; SPA behavior).
- Provide prev/next controls, keyboard shortcuts (← →, Page Up/Down), touch swipes.
- Deep links supported (`?href=`). Maintain smooth transitions.
- Prev/Next buttons must be high‑contrast and theme‑aware.
- Launch Reader and Download EPUB buttons must be theme‑aware, attractive, and consistent.

## Appearance & Theming
- Global appearance modes (Day, Night, Sepia) with instant switching.
- Theme selection lives in the global header, not per‑page.
- Selector is a compact dropdown showing active swatch + description; opening reveals all options (swatch + label + description).
- Theme colors apply to the entire app chrome (backgrounds, surfaces, text, controls) and the epub.js iframe (registered themes) for visual parity.
- Day theme should feel warm and high-contrast (darker muted text, tasteful accent for action buttons); Sepia theme should likewise maintain clear labels.

## Magazine / The Economist
- Economist issues detected under `Books/Magazines/The Economist/`.
- Reader’s Chapters panel shows section names by default; expand a section to reveal its article titles.
- Economist article titles should be informational only (no inline links from the outline panel).
- Economist issue date shown on cards must come from the filename (correct month/day/year), displayed under the title with a clear label (no extra action buttons).
- File-derived titles should strip trailing date tokens (e.g., `[Nov 8th 2025]`, `2025-11-08`) so cards display clean names without redundant dates.
- Provide a magazine reading mode (2‑column on desktop, 1‑column on mobile) with serif headings and optional drop cap on first paragraph.
- Allow toggling the magazine layout in the reader. Themes have corresponding magazine variants.
- Ensure article rows with multiple lines (e.g., title + date) align cleanly (no hanging first characters).

## UI/UX Polish
- Folder entries should feel interactive (hover/active states: accent border, subtle glow/motion).
- Remove marketing hero on the home page; keep focus on the library grid.
- Replace “Library Root” label; use “Collection Overview” summary.
- Remove header tagline (“Premium EPUB Collection”).
- Ensure all text elements (labels like SIZE/UPDATED, category names like SOCIAL) adapt to the selected theme.

## Dev & Ops
- Use Node 22 via nvm (`nvm use 22`). If `npm` is missing in a new shell, re-source nvm before running commands.
- Run commands from the project root (`/Users/ignace/Documents/Website/EPUB`).
- Books and the symlinked `static/EPUB` directory must be git-ignored to avoid committing EPUB assets.

---

If any new preference or constraint is stated, I will append it here and align the app accordingly.
