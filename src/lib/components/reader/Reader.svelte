<script lang="ts">
	import { browser } from '$app/environment';
	import type { LibraryFile, TocNode } from '$lib/utils/epub-scanner';
import {
	appearanceModeStore,
	appearanceModes,
	type AppearanceModeId,
	type AppearanceModeConfig,
	distractionFreeStore,
	fontSizeStore,
	getAppearanceConfig
} from '$lib/stores/reader';
import FontSizeControl from '$lib/components/FontSizeControl.svelte';
    import Controls from './Controls.svelte';
    import { tick } from 'svelte';
	import ChapterList, { type ChapterItem } from './ChapterList.svelte';
	import MagazineChapters from './MagazineChapters.svelte';

	let { book, initialHref } = $props<{ book: LibraryFile; initialHref: string | null }>();

	let viewerEl: HTMLDivElement | null = null;
	let bookInstance: any = null;
	let rendition: any = null;
let relocatedHandler: ((location: any) => void) | null = null;
let boundContents = new Set<any>();

	let status = $state<'idle' | 'loading' | 'ready' | 'error'>('idle');
    let errorMessage = $state<string | null>(null);
    let isNavigating = $state(false);
    let currentHref = $state<string | null>(initialHref);
    let currentPage = $state<number | null>(null);
    let totalPages = $state<number | null>(null);
let appearanceModeId = $state<AppearanceModeId>(appearanceModes[0].id);
const isMagazineTitle = Boolean(book.metadata.isMagazine);
let magazineLayoutEnabled = $state(isMagazineTitle);
const magazineModeActive = $derived(isMagazineTitle && magazineLayoutEnabled);
let distractionFree = $state(false);
const themeKey = $derived(getThemeKey(appearanceModeId, magazineModeActive, distractionFree));
let fontSizePx = $state(18);
let showHud = $state(true);
let hudTimer: ReturnType<typeof setTimeout> | null = null;
const FOCUS_BOTTOM_GAP_PX = 102;
const FOCUS_TOP_GAP_PX = 96;
const appearancePalette = $derived(() => getAppearanceConfig(appearanceModeId));
// Shell follows the theme surface; page follows the theme reader background exactly per mode
const focusShellBackground = $derived(() => appearancePalette.surface.background);
const focusPageBackground = $derived(() => appearancePalette.reader.background);

	function encodePathSegments(urlPath: string): string {
		// Encode each segment but preserve slashes. Keeps spaces, brackets, commas safe.
		return urlPath
			.split('/')
			.map((seg, i) => (i === 0 && seg === '' ? '' : encodeURIComponent(seg)))
			.join('/');
	}

	const bookUrl = $derived(encodePathSegments(book.metadata.fileUrl));
	const title = $derived(book.metadata.title);
	const author = $derived(book.metadata.author);
	const folderTrail = $derived(book.metadata.folderTrail.join(' / ') || 'Books');

	const chapters = $derived(flattenToc(book.metadata.toc ?? []));
	const magazineSections = $derived(book.metadata.toc ?? []);
	const navigableChapters = $derived(chapters.filter((chapter) => !!chapter.href));

	$effect(() => {
		if (!currentHref && navigableChapters.length) {
			currentHref = navigableChapters[0]?.href ?? null;
		}
	});

	const currentIndex = $derived(findChapterIndex(navigableChapters, currentHref));
	const currentChapter = $derived(
		currentIndex >= 0 ? navigableChapters[currentIndex] : navigableChapters[0] ?? null
	);
	const chapterLabel = $derived(currentChapter?.title ?? (currentHref ? 'Section' : 'Cover'));
	const isPrevDisabled = $derived(
		!navigableChapters.length || (currentIndex !== -1 && currentIndex <= 0)
	);
	const isNextDisabled = $derived(
		!navigableChapters.length ||
			(currentIndex !== -1 && currentIndex >= navigableChapters.length - 1)
	);

	let touchStartX: number | null = null;

	async function initReader() {
		if (!browser || !viewerEl) return;
		status = 'loading';
		errorMessage = null;

		destroyReader();

		try {
			const module = await import('epubjs');
			const ePub = module.default;
			// First try opening by URL (fast path)
			bookInstance = ePub(bookUrl);
			rendition = bookInstance.renderTo(viewerEl, {
				width: '100%',
				height: '100%',
				flow: 'paginated',
				allowScriptedContent: true
			});
			attachRenditionListeners();
			applyAppearanceToRendition();
			try { rendition.themes.fontSize(`${fontSizePx}px`); } catch {}

			// Try a sequence of reasonable display targets, falling back to default start
			const candidates: Array<string | null | undefined> = [
				currentHref,
				navigableChapters[0]?.href,
				undefined
			];

			let displayed = false;
			for (const target of candidates) {
				try {
					await rendition.display(normalizeTargetHref(target));
					displayed = true;
					break;
				} catch (e) {
					// continue to next candidate
				}
			}

			if (!displayed) {
				throw new Error('No Section Found');
			}

			status = 'ready';
		} catch (firstErr) {
			console.warn('URL-based open failed, retrying with ArrayBuffer', firstErr);
			try {
				const module = await import('epubjs');
				const ePub = module.default;
				const resp = await fetch(bookUrl);
				if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${bookUrl}`);
				const buf = await resp.arrayBuffer();
				bookInstance = ePub(buf);
				rendition = bookInstance.renderTo(viewerEl, {
					width: '100%',
					height: '100%',
					flow: 'paginated',
					allowScriptedContent: true
				});
				attachRenditionListeners();
				applyAppearanceToRendition();
				try { rendition.themes.fontSize(`${fontSizePx}px`); } catch {}

				const candidates: Array<string | null | undefined> = [
					currentHref,
					navigableChapters[0]?.href,
					undefined
				];
				let displayed = false;
				for (const target of candidates) {
					try {
						await rendition.display(normalizeTargetHref(target));
						displayed = true;
						break;
					} catch (e) {}
				}
				if (!displayed) {
					throw new Error('No Section Found');
				}

				status = 'ready';
			} catch (secondErr) {
				console.error('Both URL and ArrayBuffer open failed', secondErr);
				status = 'error';
				errorMessage =
					secondErr instanceof Error
						? `${secondErr.message}`
						: 'Failed to open EPUB';
			}
		}
	}

    function attachRenditionListeners() {
        if (!rendition) return;
        relocatedHandler = (location: any) => {
            const href = location?.href ?? location?.start?.href ?? location?.end?.href;
            if (href) {
                currentHref = href;
            }
            const displayed = location?.displayed ?? location?.end?.displayed ?? location?.start?.displayed;
            const pageNum = Number(displayed?.page);
            const totalNum = Number(displayed?.total);
            currentPage = Number.isFinite(pageNum) ? pageNum : null;
            totalPages = Number.isFinite(totalNum) ? totalNum : null;
        };
        rendition.on('relocated', relocatedHandler);

		// Add keyboard handlers inside the EPUB iframe so keys work in fullscreen
        rendition.on('rendered', (_section: any, contents: any) => {
            if (!contents || boundContents.has(contents)) return;
            const handler = (e: KeyboardEvent) => {
				const t = e.target as any;
				const tag = (t && t.tagName ? String(t.tagName).toLowerCase() : '') as string;
				if (tag === 'input' || tag === 'textarea') return;
				if (e.key === 'ArrowRight' || e.key === 'PageDown') {
					e.preventDefault();
					void rendition?.next();
				} else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
					e.preventDefault();
					void rendition?.prev();
				} else if (e.key && e.key.toLowerCase() === 'f') {
					e.preventDefault();
					if (distractionFree) {
						distractionFreeStore.disable();
						try { if (document.fullscreenElement) { void document.exitFullscreen(); } } catch {}
					} else {
						distractionFreeStore.enable();
						try { if (!document.fullscreenElement) { void document.documentElement.requestFullscreen(); } } catch {}
					}
				} else if (e.key === 'Escape') {
					e.preventDefault();
					distractionFreeStore.disable();
					try { if (document.fullscreenElement) { void document.exitFullscreen(); } } catch {}
				}
			};
            try {
                contents.document.addEventListener('keydown', handler);
                boundContents.add(contents);
            } catch {}

            // Force theme page background in the iframe
            try { applyThemeBackground(contents); } catch {}
            // Tag date/meta lines to disable drop caps on them (Economist)
            try { if (isMagazineTitle) tagDateMetaLines(contents); } catch {}
        });
	}

	function destroyReader() {
		if (rendition && relocatedHandler) {
			rendition.off('relocated', relocatedHandler);
		}
		relocatedHandler = null;
		rendition?.destroy();
		bookInstance?.destroy();
		rendition = null;
		bookInstance = null;
	}

	async function displayHref(href?: string | null) {
		if (!rendition || !href) return;
		isNavigating = true;
		try {
			currentHref = href;
    			await rendition.display(normalizeTargetHref(href));
		} catch (err) {
			console.error('Failed to navigate to href', href, err);
		} finally {
			isNavigating = false;
		}
	}

	async function goPreviousChapter() {
		if (!navigableChapters.length) {
			await rendition?.prev();
			return;
		}
		const targetIndex =
			currentIndex === -1 ? 0 : Math.max(0, Math.min(navigableChapters.length - 1, currentIndex - 1));
		await displayHref(navigableChapters[targetIndex]?.href);
	}

	async function goNextChapter() {
		if (!navigableChapters.length) {
			await rendition?.next();
			return;
		}
		const targetIndex =
			currentIndex === -1
				? 0
				: Math.max(
						0,
						Math.min(navigableChapters.length - 1, currentIndex + 1)
				  );
		await displayHref(navigableChapters[targetIndex]?.href);
	}

function handleKeydown(event: KeyboardEvent) {
		if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
			return;
		}

    if (event.key === 'ArrowRight' || event.key === 'PageDown') {
            event.preventDefault();
            void rendition?.next();
            if (distractionFree) revealHudTemporarily();
        } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
            event.preventDefault();
            void rendition?.prev();
            if (distractionFree) revealHudTemporarily();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            distractionFreeStore.disable();
            try {
                if (document.fullscreenElement) {
                    void document.exitFullscreen();
                }
            } catch {}
        } else if (event.key && event.key.toLowerCase() === 'f') {
            event.preventDefault();
            if (distractionFree) {
                // Toggle off
                distractionFreeStore.disable();
                try {
                    if (document.fullscreenElement) {
                        void document.exitFullscreen();
                    }
                } catch {}
            } else {
                // Toggle on
                distractionFreeStore.enable();
                try {
                    if (!document.fullscreenElement) {
                        void document.documentElement.requestFullscreen();
                    }
                } catch {}
            }
            revealHudTemporarily();
        }
	}

	function handleTouchStart(event: TouchEvent) {
		touchStartX = event.touches[0]?.clientX ?? null;
	}

	function handleTouchEnd(event: TouchEvent) {
		if (touchStartX === null) return;
		const endX = event.changedTouches[0]?.clientX ?? null;
		if (endX === null) return;
		const delta = endX - touchStartX;
    if (Math.abs(delta) > 60) {
            if (delta < 0) {
                void rendition?.next();
            } else {
                void rendition?.prev();
            }
        }
		touchStartX = null;
	}

	$effect(() => {
		if (!browser) return;
		if (!viewerEl) return;
		void initReader();
		return () => destroyReader();
	});

    $effect(() => {
        if (!browser) return;
        window.addEventListener('keydown', handleKeydown);
        return () => window.removeEventListener('keydown', handleKeydown);
    });

    // When toggling distraction-free mode, force epub.js to recompute layout
    $effect(() => {
        // touch the store-driven state so this effect runs on toggle
        const df = distractionFree; // eslint-disable-line @typescript-eslint/no-unused-vars
        if (!browser || !rendition) return;
        void (async () => {
            await tick();
            try {
                rendition.resize();
            } catch {}
        })();
    });

    // Hide HUD in focus mode when idle, show on interaction
    function revealHudTemporarily(delay = 1400) {
        showHud = true;
        if (hudTimer) clearTimeout(hudTimer);
        hudTimer = setTimeout(() => {
            showHud = false;
        }, delay);
    }

    $effect(() => {
        if (!browser) return;
        if (distractionFree) {
            revealHudTemporarily(1400);
            const onMove = () => revealHudTemporarily(1400);
            window.addEventListener('mousemove', onMove);
            window.addEventListener('touchstart', onMove);
            const onFsChange = () => {
                try {
                    if (!document.fullscreenElement && distractionFree) {
                        distractionFreeStore.disable();
                    }
                } catch {}
            };
            document.addEventListener('fullscreenchange', onFsChange);
            return () => {
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('touchstart', onMove);
                document.removeEventListener('fullscreenchange', onFsChange);
                if (hudTimer) clearTimeout(hudTimer);
                showHud = true;
            };
        }
    });

	// Keep pagination metrics correct when the window resizes
	$effect(() => {
		if (!browser) return;
		const onResize = () => {
			try {
				// Let epub.js recompute pages based on current container size
				rendition?.resize();
			} catch {}
		};
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	});

		$effect(() => {
        const unsubscribe = appearanceModeStore.subscribe((modeId) => {
            appearanceModeId = modeId;
        });
        const unsubDfm = distractionFreeStore.subscribe((v) => (distractionFree = v));
        const unsubFont = fontSizeStore.subscribe((v) => {
            fontSizePx = v;
            try { rendition?.themes?.fontSize?.(`${v}px`); } catch {}
        });
        return () => {
            unsubscribe();
            unsubDfm();
            unsubFont();
        };
    });

		$effect(() => {
			if (!rendition) return;
			applyAppearanceToRendition();
			try {
				const items = (rendition as any)?.getContents?.() ?? [];
				for (const c of items) applyThemeBackground(c);
			} catch {}
		});

	const chapterSelectHandler = (href?: string) => {
		void displayHref(href);
	};

	function flattenToc(nodes: TocNode[], depth = 0): ChapterItem[] {
		return nodes.flatMap((node) => {
			const current: ChapterItem = {
				title: node.title ?? `Section ${depth + 1}`,
				href: node.href,
				depth
			};
			const children = node.children ? flattenToc(node.children, depth + 1) : [];
			return [current, ...children];
		});
	}

	function findChapterIndex(items: ChapterItem[], href: string | null) {
		if (!href) return -1;
		const normalized = normalizeHref(href);
		return items.findIndex((item) => normalizeHref(item.href) === normalized);
	}

function normalizeHref(href?: string | null) {
    if (!href) return null;
    return href.split('#')[0];
}

function normalizeTargetHref(target?: string | null): string | undefined {
    if (!target) return undefined;
    const noFrag = target.split('#')[0] ?? target;
    // Remove any leading slash so epub.js resolves against book base
    return noFrag.replace(/^\/+/, '');
}

function registerThemes() {
    // No-op: legacy. Using applyAppearanceToRendition now.
}

    // Tag date-like lines to avoid drop caps on them (magazine content)
    function tagDateMetaLines(contents: any) {
        try {
            const doc: Document | undefined = contents?.document;
            if (!doc) return;
            const paragraphs = Array.from(doc.querySelectorAll('p')) as HTMLParagraphElement[];
            const maxScan = 6;
            for (let i = 0; i < Math.min(maxScan, paragraphs.length); i++) {
                const p = paragraphs[i];
                if (!p) continue;
                const text = (p.textContent || '').trim();
                if (!text) continue;
                // Heuristics: short lines that look like dates, include digits and/or Chinese month/day markers or AM/PM
                const isShort = text.length <= 40;
                const hasDigits = /\d/.test(text);
                const hasCnDate = /[年月日]/.test(text) || /上午|下午/.test(text);
                const hasMonthEnglish = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)/i.test(text);
                const hasTime = /(AM|PM|上午|下午)/i.test(text);
                if (isShort && (hasCnDate || (hasDigits && (hasMonthEnglish || hasTime)))) {
                    p.classList.add('no-dropcap', 'meta-line');
                }
            }
        } catch {}
    }

function selectRenditionTheme(selectedTheme: string) {
    // No-op: legacy. Using applyAppearanceToRendition now.
}

function getThemeKey(modeId: AppearanceModeId, magazine: boolean, focus: boolean) {
    // Legacy helper; no longer used.
    return magazine ? `${modeId}-mag` : modeId;
}

function resolveFocusBackgrounds(
	modeId: AppearanceModeId,
	magazine: boolean,
	mode: AppearanceModeConfig
) {
	const overrides: Record<
		AppearanceModeId,
		{ shell: string; page: string; pageMagazine?: string }
	> = {
		day: {
			shell: '#f5f6fb',
			page: '#ffffff',
			pageMagazine: '#fff6e9'
		},
		night: {
			shell: '#04060d',
			page: '#06090f',
			pageMagazine: '#05080f'
		},
		sepia: {
			shell: '#f2e2c8',
			page: '#fbf3e2',
			pageMagazine: '#f6e3c7'
		}
	};
	const theme = overrides[modeId];
	const shell = theme?.shell ?? mode.surface.background;
	const page =
		theme?.[magazine ? 'pageMagazine' : 'page'] ??
		(magazine ? mode.surface.background : mode.reader.background);
	return { shell, page };
}

function createThemeStyles(mode: AppearanceModeConfig, magazine: boolean, focus: boolean) {
		const pageBg = focus
			? resolveFocusBackgrounds(mode.id, magazine, mode).page
			: mode.reader.background;
		const body: Record<string, string> = {
			background: `${pageBg} !important`,
			color: mode.reader.text,
			'font-family': magazine
				? "'Georgia', 'Times New Roman', serif"
				: "'Georgia', 'Times New Roman', serif",
			'line-height': magazine ? '1.8' : '1.7',
			'max-width': magazine ? 'auto' : '68ch',
			margin: magazine ? '0' : '0 auto',
			padding: magazine ? '2rem 3rem' : '2rem 1.75rem',
			'padding-bottom': magazine ? '32rem' : '32rem',
			'text-rendering': 'optimizeLegibility',
			'font-kerning': 'normal',
			hyphens: 'auto',
			'word-break': 'normal'
		};

		// Note: Avoid setting CSS columns inside the EPUB document here.
		// epub.js handles pagination/columns; adding CSS columns can hide content.

		const styles: Record<string, Record<string, string>> = {
			html: { background: `${pageBg} !important`, color: mode.reader.text, 'background-image': 'none !important' },
			':root, body': { background: `${pageBg} !important`, color: mode.reader.text, 'background-image': 'none !important' },
			'body *': { 'background': 'transparent !important', 'background-image': 'none !important' },
			body,
			a: { color: mode.reader.link },
			p: { margin: '0 0 0.85em' },
			img: { 'max-width': '100%', height: 'auto' }
		};

		if (magazine) {
			styles.h1 = {
				'font-family': "'Playfair Display', 'Georgia', serif",
				'font-size': '2.4rem',
				margin: '0 0 1rem'
			};
			styles.h2 = {
				'font-family': "'Playfair Display', 'Georgia', serif",
				'font-size': '1.8rem',
				margin: '1.5rem 0 1rem'
			};
			styles.h3 = {
				'font-family': "'Playfair Display', 'Georgia', serif",
				'font-size': '1.4rem',
				margin: '1rem 0 0.5rem'
			};
			styles["p:first-of-type::first-letter"] = {
				'float': 'left',
				'font-size': '3.5rem',
				'line-height': '1',
				'margin': '0.2rem 0.6rem 0 0',
				'font-family': "'Playfair Display', 'Georgia', serif"
			};

			// Prevent drop caps on detected date/meta lines
			styles[".no-dropcap::first-letter"] = {
				'float': 'none !important',
				'font-size': 'inherit !important',
				'line-height': 'inherit !important',
				'margin': '0 !important'
			};
			styles[".meta-line"] = {
				'font-variant-numeric': 'tabular-nums',
				'letter-spacing': '0.02em'
			};
}

		return styles;
	}

// Force the themed background color inside the EPUB iframe document
function applyThemeBackground(contents: any) {
    try {
        const doc: Document | undefined = contents?.document;
        const iframe: HTMLIFrameElement | undefined = contents?.iframe;
        if (!doc) return;
        const palette = getAppearanceConfig(appearanceModeId);
        const pageBg = palette.reader.background;
        const text = palette.reader.text;
        // Root and body backgrounds
        doc.documentElement?.setAttribute('style', `background:${pageBg} !important; background-image:none !important; color:${text} !important;`);
        const body = doc.body as HTMLElement;
        if (body) {
            body.style.setProperty('background', pageBg, 'important');
            body.style.setProperty('background-image', 'none', 'important');
            body.style.setProperty('color', text, 'important');
        }
        // Common wrappers transparent so page color shows through
        ['div','main','article','section'].forEach((sel) => {
            doc.querySelectorAll(sel).forEach((el) => {
                (el as HTMLElement).style.setProperty('background', 'transparent', 'important');
                (el as HTMLElement).style.setProperty('background-image', 'none', 'important');
            });
        });
        if (iframe) iframe.style.background = pageBg;
    } catch {}
}

// Apply current appearance palette to epub.js rendition using a single theme key
function applyAppearanceToRendition() {
    if (!rendition) return;
    const palette = getAppearanceConfig(appearanceModeId);
    const pageBg = palette.reader.background;
    const text = palette.reader.text;
    const link = palette.reader.link;
    const styles: Record<string, Record<string, string>> = {
        html: { background: `${pageBg} !important`, color: text, 'background-image': 'none !important' },
        ':root, body': { background: `${pageBg} !important`, color: text, 'background-image': 'none !important' },
        'body *': { background: 'transparent !important', 'background-image': 'none !important' },
        body: { 'line-height': '1.6', margin: '0', padding: '1.75rem' },
        a: { color: link }
    };
    try {
        rendition.themes.register('app-theme', styles);
        rendition.themes.select('app-theme');
    } catch (e) {
        // ignore
    }
}
</script>

<div
	class={`space-y-5 ${distractionFree ? 'fixed inset-0 z-40 overflow-hidden' : ''}`}
	data-reader-mode={appearanceModeId}
	data-magazine-mode={magazineModeActive ? 'true' : 'false'}
	style={distractionFree ? `background:${focusShellBackground};` : ''}
>
	{#if !distractionFree}
	<div class="reader-surface rounded-3xl border p-5 shadow-card">
		<p class="reader-muted text-xs uppercase tracking-[0.35em]">{folderTrail}</p>
		<h2 class="text-2xl font-semibold">{title}</h2>
		<p class="reader-muted text-sm">{author}</p>
		{#if initialHref}
			<p class="reader-muted text-xs">
				Deep link loaded · <span class="font-mono text-xs">{initialHref}</span>
			</p>
		{/if}
	</div>
	{/if}

	{#if isMagazineTitle && !distractionFree}
		<div class="reader-surface flex flex-wrap items-center justify-between gap-4 rounded-3xl border p-4">
			<div>
				<p class="reader-muted text-xs uppercase tracking-[0.35em]">Magazine Layout</p>
				<p class="text-sm font-semibold">
					{magazineLayoutEnabled ? 'Two-column Economist experience' : 'Enable two-column experience'}
				</p>
			</div>
			<button
				type="button"
				class={`magazine-toggle ${magazineLayoutEnabled ? 'magazine-toggle--active' : ''}`}
				onclick={() => (magazineLayoutEnabled = !magazineLayoutEnabled)}
			>
				<span class="text-xs uppercase tracking-[0.3em]">
					{magazineLayoutEnabled ? '2 Columns' : 'Single Column'}
				</span>
				<span class="dot"></span>
			</button>
		</div>
	{/if}

	{#if !distractionFree}
	<Controls
		{chapterLabel}
		onPrev={() => { void rendition?.prev(); }}
		onNext={() => { void rendition?.next(); }}
		{isPrevDisabled}
		{isNextDisabled}
		{isNavigating}
	/>
	{/if}

		<div class={`grid ${distractionFree ? 'grid-cols-1' : 'gap-5 lg:grid-cols-[minmax(0,1fr),320px]'}`}>
		<div
			class={`reader-panel relative ${distractionFree ? 'h-screen rounded-none border-0 shadow-none' : 'min-h-[80vh] rounded-3xl border shadow-xl'} overflow-hidden`}
			style={
				distractionFree
					? `padding:${FOCUS_TOP_GAP_PX}px 0 ${FOCUS_BOTTOM_GAP_PX}px 0;background:${focusPageBackground};`
					: ''
			}
			ontouchstart={handleTouchStart}
			ontouchend={handleTouchEnd}
		>
			<div
				class="absolute inset-0"
				style={
					distractionFree
						? `top:${FOCUS_TOP_GAP_PX}px;left:0;right:0;bottom:${FOCUS_BOTTOM_GAP_PX}px;background:${focusPageBackground};`
						: ''
				}
				bind:this={viewerEl}
			></div>

			{#if isNavigating && status === 'ready'}
				<div class="reader-panel-badge pointer-events-none absolute right-4 top-4 rounded-full border px-3 py-1 text-xs">
					Turning page…
				</div>
			{/if}

            {#if status !== 'ready'}
                <div class="reader-panel-overlay absolute inset-0 flex flex-col items-center justify-center text-center">
					{#if status === 'loading'}
						<div class="flex flex-col items-center gap-3">
							<div
								class="h-10 w-10 animate-spin rounded-full border-2 border-white/10"
								style="border-top-color: var(--reader-panel-link)"
							></div>
							<p class="text-sm">
								Loading <span class="font-semibold">{title}</span>…
							</p>
						</div>
					{:else if status === 'error'}
						<div class="space-y-2">
							<p class="text-sm font-semibold">Failed to initialize reader</p>
							<p class="text-xs opacity-80">{errorMessage}</p>
							<button
								type="button"
								class="reader-button rounded-xl border px-3 py-2 text-xs transition"
								onclick={() => initReader()}
							>
								Try Again
							</button>
                </div>
            {/if}

			{#if distractionFree && currentPage !== null}
				<div
					class="pointer-events-none absolute left-1/2 -translate-x-1/2 transform z-10"
					style={`bottom:${Math.max(FOCUS_BOTTOM_GAP_PX / 2, 16)}px`}
				>
					<span class="text-sm font-semibold" style="color: var(--reader-panel-text); opacity: 0.9;">{currentPage}</span>
				</div>
			{/if}
        </div>
			{/if}
		</div>
		{#if !distractionFree}
			{#if isMagazineTitle}
				<MagazineChapters sections={magazineSections} selectedHref={currentHref} onSelectChapter={chapterSelectHandler} />
			{:else}
				<ChapterList chapters={chapters} selectedHref={currentHref} onSelectChapter={chapterSelectHandler} />
			{/if}
		{/if}
	</div>

	{#if distractionFree}
        <div class={`pointer-events-none fixed inset-0 z-50 transition-opacity duration-200 ${showHud ? 'opacity-100' : 'opacity-0'}`}>
            <div class="pointer-events-auto absolute right-6 bottom-6 flex items-center gap-3">
                <FontSizeControl />
                <Controls
                    {chapterLabel}
                    onPrev={() => { void rendition?.prev(); }}
                    onNext={() => { void rendition?.next(); }}
                    {isPrevDisabled}
					{isNextDisabled}
					{isNavigating}
				/>
			</div>
			<div class="pointer-events-auto absolute left-6 top-6">
                <button
                    type="button"
                    class="reader-button rounded-full border px-3 py-2 text-xs backdrop-blur transition"
                    title="Exit focus"
                    onclick={() => { try { if (document.fullscreenElement) { void document.exitFullscreen(); } } catch {} ; distractionFreeStore.disable(); }}
                >
                    Exit Focus
                </button>
			</div>
		</div>
	{:else}
		<p class="reader-muted text-center text-xs">
			Typography polish and progress tracking arrive in the next phase.
		</p>
	{/if}
</div>
