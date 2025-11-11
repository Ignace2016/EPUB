<script lang="ts">
	import type { TocNode } from '$lib/utils/epub-scanner';

	export type ChapterItem = {
		title: string;
		href?: string;
		depth: number;
	};

	let {
		chapters,
		selectedHref,
		onSelectChapter
	} = $props<{
		chapters: ChapterItem[];
		selectedHref: string | null;
		onSelectChapter: (href?: string) => void;
	}>();

	const normalizedSelected = $derived(normalizeHref(selectedHref));

	function normalizeHref(href?: string | null) {
		if (!href) return null;
		return href.split('#')[0];
	}
</script>

<div class="reader-surface rounded-3xl border p-4">
	<header class="flex items-center justify-between">
		<div>
			<p class="reader-muted text-xs uppercase tracking-[0.4em]">Chapters</p>
			<p class="reader-muted text-sm">{chapters.length ? `${chapters.length} entries` : 'No outline'}</p>
		</div>
	</header>

	{#if chapters.length}
		<ul class="mt-4 space-y-1">
			{#each chapters as chapter (chapter.title + chapter.href)}
				<li>
					<button
						type="button"
						class={`chapter-button flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition ${
							normalizeHref(chapter.href) === normalizedSelected ? 'chapter-button--active' : ''
						}`}
						style={`padding-left: ${Math.min(chapter.depth, 4) * 0.5 + 0.75}rem`}
						onclick={() => onSelectChapter(chapter.href)}
						disabled={!chapter.href}
					>
						<span>{chapter.title}</span>
						{#if normalizeHref(chapter.href) === normalizedSelected}
							<span class="text-xs uppercase tracking-[0.3em]" style="color: var(--reader-panel-link)">
								LIVE
							</span>
						{/if}
					</button>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="reader-muted mt-4 text-sm">
			This EPUB does not expose a navigation outline. Use the Next/Prev controls to move through the spine.
		</p>
	{/if}
</div>
