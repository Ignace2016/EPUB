<script lang="ts">
	import type { TocNode } from '$lib/utils/epub-scanner';

let { sections } = $props<{ sections: TocNode[] }>();

let openSection = $state<string | null>(sections[0]?.title ?? null);

$effect(() => {
	if (!sections.length) {
		openSection = null;
		return;
	}
	if (!sections.some((section: TocNode) => section.title === openSection)) {
		openSection = sections[0]?.title ?? null;
	}
});

function toggleSection(title: string) {
	openSection = openSection === title ? null : title;
}

function normalizeHref(ref?: string | null) {
	if (!ref) return null;
	return ref.split('#')[0];
}
</script>

<div class="space-y-3 rounded-2xl border border-slate-900/70 bg-slate-900/40 p-4">
	<header class="flex items-center justify-between text-sm text-muted">
		<span class="font-semibold uppercase tracking-[0.25em] text-muted">Magazine Outline</span>
		<span>{sections.length} sections</span>
	</header>

	<div class="space-y-2">
		{#each sections as section (section.title)}
			<div class="rounded-xl border border-slate-900/60 bg-slate-950/30">
				<button
					type="button"
					class="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-strong"
					onclick={() => toggleSection(section.title)}
				>
					<span>{section.title}</span>
					<svg
						class={`h-4 w-4 transition ${openSection === section.title ? 'rotate-180 text-accent-emerald' : 'text-muted'}`}
						viewBox="0 0 20 20"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d="M4 7l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				</button>

				{#if openSection === section.title}
					<div class="border-t border-slate-900/60 px-4 py-3">
						{#if section.children?.length}
						<ul class="space-y-1 text-sm text-muted">
							{#each section.children as article (article.title)}
								<li>
									<div class="article-link article-link--static">
										<span>{article.title}</span>
									</div>
								</li>
							{/each}
						</ul>
						{:else}
							<p class="text-sm text-muted">No articles listed.</p>
						{/if}
					</div>
				{/if}
			</div>
		{/each}
	</div>
</div>
