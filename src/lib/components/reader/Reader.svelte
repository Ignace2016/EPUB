<script lang="ts">
	import { browser } from '$app/environment';
	import type { LibraryFile, TocNode } from '$lib/utils/epub-scanner';
	import {
		appearanceModeStore,
		appearanceModes,
		type AppearanceModeId,
		type AppearanceModeConfig
	} from '$lib/stores/reader';
	import Controls from './Controls.svelte';
	import ChapterList, { type ChapterItem } from './ChapterList.svelte';
	import MagazineChapters from './MagazineChapters.svelte';

	let { book, initialHref } = $props<{ book: LibraryFile; initialHref: string | null }>();

	let viewerEl: HTMLDivElement | null = null;
	let bookInstance: any = null;
	let rendition: any = null;
	let relocatedHandler: ((location: any) => void) | null = null;

	let status = $state<'idle' | 'loading' | 'ready' | 'error'>('idle');
	let errorMessage = $state<string | null>(null);
	let isNavigating = $state(false);
	let currentHref = $state<string | null>(initialHref);
	let appearanceModeId = $state<AppearanceModeId>(appearanceModes[0].id);
	const isMagazineTitle = Boolean(book.metadata.isMagazine);
	let magazineLayoutEnabled = $state(isMagazineTitle);
	const magazineModeActive = $derived(isMagazineTitle && magazineLayoutEnabled);
	const themeKey = $derived(getThemeKey(appearanceModeId, magazineModeActive));
	const bookUrl = $derived(book.metadata.fileUrl);
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
			bookInstance = ePub(bookUrl);
			rendition = bookInstance.renderTo(viewerEl, {
				width: '100%',
				height: '100%',
				allowScriptedContent: true
			});

				attachRenditionListeners();
				registerThemes();
				selectRenditionTheme(themeKey);
			await rendition.display(currentHref ?? navigableChapters[0]?.href ?? undefined);
			status = 'ready';
		} catch (err) {
			console.error(err);
			status = 'error';
			errorMessage = err instanceof Error ? err.message : 'Failed to open EPUB';
		}
	}

	function attachRenditionListeners() {
		if (!rendition) return;
		relocatedHandler = (location: any) => {
			const href = location?.href ?? location?.start?.href ?? location?.end?.href;
			if (href) {
				currentHref = href;
			}
		};
		rendition.on('relocated', relocatedHandler);
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
			await rendition.display(href);
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
			void goNextChapter();
		} else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
			event.preventDefault();
			void goPreviousChapter();
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
				void goNextChapter();
			} else {
				void goPreviousChapter();
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

		$effect(() => {
			const unsubscribe = appearanceModeStore.subscribe((modeId) => {
				appearanceModeId = modeId;
			});
			return () => unsubscribe();
		});

		$effect(() => {
			if (!rendition) return;
			selectRenditionTheme(themeKey);
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

	function registerThemes() {
		if (!rendition) return;
		appearanceModes.forEach((mode) => {
			rendition.themes.register(getThemeKey(mode.id, false), createThemeStyles(mode, false));
			rendition.themes.register(getThemeKey(mode.id, true), createThemeStyles(mode, true));
		});
	}

	function selectRenditionTheme(selectedTheme: string) {
		if (!rendition?.themes) return;
		try {
			rendition.themes.select(selectedTheme);
		} catch (err) {
			console.warn('Unable to apply theme', selectedTheme, err);
		}
	}

	function getThemeKey(modeId: AppearanceModeId, magazine: boolean) {
		return magazine ? `${modeId}-mag` : modeId;
	}

	function createThemeStyles(mode: AppearanceModeConfig, magazine: boolean) {
		const body: Record<string, string> = {
			background: mode.reader.background,
			color: mode.reader.text,
			'font-family': magazine ? "'Georgia', 'Times New Roman', serif" : "'Inter', system-ui, sans-serif",
			'line-height': magazine ? '1.8' : '1.6',
			margin: '0',
			padding: magazine ? '2rem 3rem' : '1.5rem'
		};

		if (magazine) {
			body['column-width'] = '420px';
			body['column-gap'] = '3rem';
			body['column-fill'] = 'auto';
		}

		const styles: Record<string, Record<string, string>> = {
			body,
			a: { color: mode.reader.link }
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
		}

		return styles;
	}
</script>

<div class="space-y-5" data-reader-mode={appearanceModeId} data-magazine-mode={magazineModeActive ? 'true' : 'false'}>
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

	{#if isMagazineTitle}
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

	<Controls
		{chapterLabel}
		onPrev={() => goPreviousChapter()}
		onNext={() => goNextChapter()}
		{isPrevDisabled}
		{isNextDisabled}
		{isNavigating}
	/>

		<div class="grid gap-5 lg:grid-cols-[minmax(0,1fr),320px]">
		<div
			class="reader-panel relative min-h-[70vh] overflow-hidden rounded-3xl border shadow-xl"
			ontouchstart={handleTouchStart}
			ontouchend={handleTouchEnd}
		>
			<div class="absolute inset-0" bind:this={viewerEl}></div>

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
				</div>
			{/if}
		</div>
		{#if isMagazineTitle}
			<MagazineChapters sections={magazineSections} selectedHref={currentHref} onSelectChapter={chapterSelectHandler} />
		{:else}
			<ChapterList chapters={chapters} selectedHref={currentHref} onSelectChapter={chapterSelectHandler} />
		{/if}
	</div>

	<p class="reader-muted text-center text-xs">
		Typography polish and progress tracking arrive in the next phase.
	</p>
</div>
