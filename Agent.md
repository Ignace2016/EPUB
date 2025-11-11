# Agent Instructions: Astra EPUB Reader

## Project Overview
You are building **Astra**, a modern, premium EPUB reading web application. This is a high-performance reader with exceptional UX, multiple appearance modes, and seamless navigation. Quality and polish are paramount.

---

## Technology Stack

### Required Technologies
- **Framework**: SvelteKit (latest stable version)
- **Styling**: TailwindCSS (use utility classes only)
- **EPUB Engine**: epub.js (using Rendition API)
- **State Management**: Svelte stores
- **Transitions**: Svelte transitions (fade, slide)

### Architecture Principles
- **No localStorage or sessionStorage** - Use Svelte stores for state
- **Component-based architecture** - Modular, reusable components
- **Performance-first** - Lazy loading, optimized rendering
- **Mobile + Desktop** - Responsive design required

---

## File Structure

```
/Books/
├── Economy/
├── Psychology/
├── Social/
└── Magazines/
    └── The Economist/
```

All EPUB files live in `/Books/` at the project root (mirrored into `/static/EPUB/` via symlink for serving).

---

## Core Features

### 1. Library Browser

**Requirements:**
- Recursively scan `/Books/` for `.epub` files
- Display folder structure exactly as it exists in file system
- Collapsible sidebar navigation with folder categories
- Visual hierarchy: Books → Economy/Psychology/Social, Magazines → The Economist
- Sidebar must include a “Collection Overview” entry that, when selected, shows every EPUB sorted by most recently updated
- The default landing view should load the Collection Overview (all books, newest first)

**Display for Each EPUB:**
- Cover image (extract from EPUB metadata)
- Title
- Author
- Metadata strip shows **Size** + **Updated** only (no raw filename — title already covers it)
- Clean, card-based layout

**Special Handling for Magazines:**
- Detect if EPUB is in `Magazines/The Economist/` folder
- Parse and display hierarchical table of contents structure
- Show sections (e.g., Leaders, China, Business, Finance, etc.)
- Show articles within each section
- Expandable/collapsible section view in the library browser
- User can click on specific articles to jump directly to them
- In the reader, the **Chapters** panel shows section names by default; clicking a section expands/collapses its article titles
- Article rows (titles + dates) must stay left-aligned even when icons/badges are present so multi-line text never hangs
- Selecting the “Magazines” shelf lists every descendant EPUB (no empty-state even if books live in nested subfolders)

**Technical Notes:**
- Use SvelteKit's server-side capabilities to scan filesystem
- Cache the library structure in a Svelte store
- Smooth expand/collapse animations for folders
- For magazines, deeply parse the navigation structure using epub.js `book.loaded.navigation`

---

### 2. Reader Experience

**Core Reading Engine:**
```javascript
import ePub from 'epubjs';

const book = ePub(epubUrl);
const rendition = book.renderTo(element, {
  width: "100%",
  height: "100%"
});

rendition.display(href);
```

**Critical Requirements:**
- ✅ Initialize with `book = ePub(...)`
- ✅ Use `rendition.display(href)` for chapter navigation
- ✅ **NO full page reloads** during navigation
- ✅ Maintain scroll position when possible
- ✅ Smooth transitions between chapters
- ✅ Load next/previous chapters via epub.js, **not SvelteKit routing**

**Navigation:**
- Previous/Next chapter buttons
- Chapter list sidebar/dropdown
- Keyboard shortcuts (arrow keys, Page Up/Down)
- Touch gestures on mobile (swipe left/right)
- Prev/Next buttons must be high-contrast, theme-aware pills that remain visible in every mode
- Launch Reader / Download EPUB CTAs must adapt to the active theme colors

**Progress Tracking:**
- Save current location (book, chapter, position)
- Store in Svelte store (NOT localStorage)
- Auto-save on navigation
- Resume from last position on reopen

---

## Appearance Modes

The reader MUST support these appearance modes with instant switching:

- The appearance selector lives in the global chrome so any screen (library or reader) can toggle it, and the entire application chrome (backgrounds, surfaces, reader iframe) responds instantly.

### 1. Day Mode (Default)
```css
background: #FFFFFF
color: #000000
/* Clean, neutral, high contrast */
```

### 2. Night Mode
```css
background: #121212
color: #E0E0E0
/* Reduced contrast for eye comfort */
```

### 3. Sepia Mode
```css
background: #F4ECD8
color: #5B4636
/* Warm, paper-like reading experience */
```

### 4. Magazine Mode
**Appearance-only mode** for magazine-style content:

```css
.magazine-mode .reader-content {
  column-count: 2;
  column-gap: 3rem;
  line-height: 1.8;
}

@media (max-width: 900px) {
  .magazine-mode .reader-content {
    column-count: 1;
  }
}
```

**Additional Magazine Styling:**
- Elegant serif font for headings (Playfair Display, Georgia, etc.)
- Optional drop caps for first paragraph
- Increased line height (1.8)
- 2-column layout on desktop, 1-column on mobile

### 5. Distraction-Free Mode
- Hide all UI elements except reader content
- Minimal chrome (small exit button)
- Show controls on hover/tap
- Full-screen reading experience

**Implementation:**
- Store mode in Svelte store
- Apply CSS classes dynamically: `.day-mode`, `.night-mode`, etc.
- Instant switching with smooth transitions
- Persist mode preference across sessions (in store)

---

## Typography System

**Default Typography:**
```css
font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
font-size: 18px (adjustable)
line-height: 1.6
letter-spacing: 0.01em
```

**Font Size Control:**
- Adjustable range: 14px - 28px
- Step size: 2px
- Visual slider or +/- buttons
- Apply to `.reader-content` container

**Magazine Mode Typography:**
```css
h1, h2, h3 {
  font-family: 'Playfair Display', Georgia, serif;
}

.drop-cap::first-letter {
  font-size: 3.5em;
  line-height: 0.9;
  float: left;
  margin: 0.1em 0.1em 0 0;
}
```

---

## UI/UX Requirements

### Navigation Controls
- **Location**: Floating toolbar or header
- **Elements**:
  - Previous Chapter
  - Next Chapter
  - Chapter List dropdown
  - Appearance mode selector
  - Font size controls
  - Progress indicator
  - Back to Library button

### Smooth Transitions
```javascript
import { fade, slide } from 'svelte/transition';

// Apply to chapter changes, mode switches, UI elements
```

### Loading States
- Show skeleton loader while EPUB initializes
- Smooth fade-in when content ready
- Progress indicators for chapter switches

### Responsive Design
**Desktop (>900px):**
- Sidebar for chapters
- Comfortable reading width (max 800px)
- Magazine mode: 2 columns

**Mobile (<900px):**
- Drawer for chapters
- Full-width reading
- Magazine mode: 1 column
- Touch-friendly controls (min 44px tap targets)

---

## Performance Optimization

### Critical Performance Rules
1. **Lazy load** EPUBs (only initialize when opened)
2. **Preload** adjacent chapters in background
3. **Debounce** scroll position saving
4. **Optimize** cover image loading (lazy load in library)
5. **Cache** parsed EPUB metadata
6. **Minimize** reflows during appearance mode switches

### epub.js Best Practices
```javascript
// Efficient chapter switching
rendition.display(href).then(() => {
  // Update UI after render
});

// Memory management
book.destroy(); // When closing book
```

---

## State Management

### Svelte Stores Structure
```javascript
// stores.js
import { writable } from 'svelte/store';

export const currentBook = writable(null);
export const currentChapter = writable(null);
export const readingProgress = writable({});
export const appearanceMode = writable('day');
export const fontSize = writable(18);
export const library = writable([]);
```

**Never use:**
- ❌ localStorage
- ❌ sessionStorage
- ❌ Browser storage APIs

**Always use:**
- ✅ Svelte stores
- ✅ In-memory state

---

## Code Quality Standards

### Component Organization
```
/src/
├── lib/
│   ├── components/
│   │   ├── Library.svelte
│   │   ├── Reader.svelte
│   │   ├── AppearanceModeSelector.svelte
│   │   ├── ChapterList.svelte
│   │   └── Controls.svelte
│   ├── stores/
│   │   └── stores.js
│   └── utils/
│       ├── epub-scanner.js
│       └── epub-utils.js
└── routes/
    ├── +page.svelte (Library)
    └── reader/+page.svelte
```

### Naming Conventions
- Components: PascalCase (`Reader.svelte`)
- Stores: camelCase (`currentBook`)
- Utilities: kebab-case (`epub-scanner.js`)
- CSS classes: kebab-case (`.reader-content`)

### Code Style
- Use TypeScript types where possible
- JSDoc comments for complex functions
- Descriptive variable names
- Keep components under 300 lines
- Extract complex logic to utilities

---

## Testing Checklist

Before considering any feature complete:

### Functionality
- [ ] EPUB opens without errors
- [ ] Chapter navigation works (prev/next)
- [ ] No page reloads during navigation
- [ ] Progress is tracked correctly
- [ ] All appearance modes apply instantly
- [ ] Font size adjusts correctly

### Performance
- [ ] Library loads in <1 second
- [ ] EPUB opens in <2 seconds
- [ ] Chapter switches in <500ms
- [ ] No janky scrolling
- [ ] Smooth mode transitions

### Responsive
- [ ] Works on mobile (375px width)
- [ ] Works on tablet (768px)
- [ ] Works on desktop (1920px)
- [ ] Magazine mode columns adjust correctly
- [ ] Touch gestures work on mobile

### Polish
- [ ] Transitions are smooth
- [ ] No layout shifts
- [ ] Loading states are shown
- [ ] Errors are handled gracefully
- [ ] Typography is beautiful

---

## Common Pitfalls to Avoid

1. **❌ Using routing for chapters** → Use `rendition.display(href)`
2. **❌ Full page reloads** → Keep reader in SPA context
3. **❌ Using localStorage** → Use Svelte stores only
4. **❌ Blocking UI during loads** → Show loading states
5. **❌ Forgetting mobile** → Test on small screens
6. **❌ Ignoring epub.js lifecycle** → Properly destroy instances
7. **❌ Hard-coded paths** → Use configurable base path
8. **❌ Missing error handling** → Catch EPUB parsing errors

---

## Success Criteria

The Astra EPUB Reader is complete when:

✅ Users can browse EPUBs by folder structure  
✅ EPUBs open smoothly without page reloads  
✅ All 5 appearance modes work flawlessly  
✅ Magazine mode displays 2 columns on desktop  
✅ Navigation is instant and smooth  
✅ Reading progress persists across sessions  
✅ Typography is elegant and readable  
✅ Mobile experience is excellent  
✅ Performance is snappy (<500ms interactions)  
✅ Code is clean, modular, and maintainable  

---

## Priority Order

When building, follow this sequence:

1. **Phase 1**: Library browser + EPUB scanning — DONE
2. **Phase 2**: Basic reader with epub.js — DONE
3. **Phase 3**: Chapter navigation (prev/next) — DONE
4. **Phase 4**: Appearance modes (Day/Night/Sepia) — DONE
5. **Phase 5**: Magazine mode layout — DONE
6. **Phase 6**: Distraction-free mode — DONE
7. **Phase 7**: Font controls + typography — DONE
8. **Phase 8**: Progress tracking — IN PROGRESS
9. **Phase 9**: Polish + transitions
10. **Phase 10**: Mobile optimization

---

## Questions to Ask

If instructions are unclear, ask:

- "Should the library use server-side or client-side scanning?"
- "What's the preferred layout for the chapter list?"
- "Should appearance modes affect the UI chrome or just reader content?"
- "How should errors (missing files, corrupt EPUBs) be displayed?"
- "Are there any specific magazine EPUB files to test with?"

---

**Remember**: This is a premium reading application. Every interaction should feel polished, smooth, and delightful. Quality over speed.
