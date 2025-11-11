<script lang="ts">
	import { slide } from 'svelte/transition';
	import type { TocNode } from '$lib/utils/epub-scanner';

	let {
		sections,
		selectedHref,
		onSelectChapter
	} = $props<{
		sections: TocNode[];
		selectedHref: string | null;
		onSelectChapter: (href?: string) => void;
	}>();

let expanded = $state<Set<string>>(new Set());
	const normalizedSelected = $derived(normalizeHref(selectedHref));

	function toggleSection(title: string) {
		const next = new Set(expanded);
		next.has(title) ? next.delete(title) : next.add(title);
		expanded = next;
	}

	function normalizeHref(href?: string | null) {
		if (!href) return null;
		return href.split('#')[0];
	}
</script>

<div class="reader-surface rounded-3xl border p-4">
	<header class="flex items-center justify-between">
		<div>
			<p class="reader-muted text-xs uppercase tracking-[0.4em]">Chapters</p>
			<p class="reader-muted text-sm">{sections.length ? `${sections.length} sections` : 'No outline'}</p>
		</div>
	</header>

	{#if sections.length}
		<div class="mt-4 space-y-2">
			{#each sections as section (section.title)}
				<div class="rounded-2xl border border-dashed border-[color:var(--reader-surface-border,#1f2233)]">
					<button
						type="button"
						class="section-toggle flex w-full items-center justify-between px-4 py-3 text-left"
						onclick={() => toggleSection(section.title)}
					>
						<span class="font-semibold">{section.title}</span>
						<svg
							class={`h-4 w-4 transition ${expanded.has(section.title) ? 'rotate-180 text-[color:var(--reader-panel-link,#2fd4a7)]' : 'text-[color:var(--reader-surface-muted,#94a3b8)]'}`}
							viewBox="0 0 20 20"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="M4 7l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
						</svg>
					</button>

					{#if expanded.has(section.title)}
						<div class="border-t border-[color:var(--reader-surface-border,#1f2233)] px-4 py-3" in:slide={{ duration: 150 }}>
							{#if section.children?.length}
								<ul class="space-y-1">
									{#each section.children as article (article.title + article.href)}
										<li>
											<button
												type="button"
												class={`article-link w-full text-left ${normalizeHref(article.href) === normalizedSelected ? 'article-link--active' : ''}`}
												onclick={() => onSelectChapter(article.href)}
											>
												{article.title}
											</button>
										</li>
									{/each}
								</ul>
							{:else}
								<p class="reader-muted text-sm">No articles listed.</p>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{:else}
		<p class="reader-muted mt-4 text-sm">
			This EPUB does not expose section data.
		</p>
	{/if}
</div>
