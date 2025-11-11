<script lang="ts">
import { goto } from '$app/navigation';
import type { LibraryFile } from '$lib/utils/epub-scanner';

	let { file } = $props<{ file: LibraryFile }>();

	const meta = $derived(file.metadata);
	const initials = $derived(
		(meta.title
			.split(' ')
			.slice(0, 2)
			.map((word: string) => word?.[0] ?? '')
			.join('')
			.toUpperCase() || 'EP')
	);

	const fileSizeLabel = $derived(formatBytes(meta.fileSize));

	function formatBytes(bytes: number) {
		if (!bytes) return '—';
		const thresholds = ['B', 'KB', 'MB', 'GB'];
		let idx = 0;
		let value = bytes;
		while (value >= 1000 && idx < thresholds.length - 1) {
			value /= 1024;
			idx += 1;
		}
		return `${value.toFixed(1)} ${thresholds[idx]}`;
	}
</script>

<article
	class="group flex h-full flex-col gap-4 rounded-2xl border border-slate-900/80 bg-slate-900/40 p-4 shadow-card transition hover:-translate-y-1 hover:border-accent-emerald/50 hover:bg-slate-900/70"
>
	<div class="relative overflow-hidden rounded-xl border border-slate-900/70 bg-slate-950/70">
		{#if meta.coverImage}
			<img
				src={meta.coverImage}
				alt={`Cover art for ${meta.title}`}
				class="h-48 w-full object-cover"
				loading="lazy"
				decoding="async"
			/>
		{:else}
			<div class="flex h-48 items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 text-3xl font-semibold text-accent-emerald/80">
				{initials}
			</div>
		{/if}

		<span
			class="absolute bottom-3 right-3 rounded-full border border-white/30 bg-black/30 px-3 py-1 text-xs uppercase tracking-wide text-white/80 backdrop-blur"
		>
			{meta.isMagazine ? 'Magazine' : 'Book'}
		</span>
	</div>

	<div class="flex flex-1 flex-col gap-3">
		<div class="space-y-1">
			<p class="book-trail text-xs uppercase tracking-[0.3em]">
				{meta.folderTrail.join(' / ') || 'Books'}
			</p>
			<h3 class="text-xl font-semibold text-strong">{meta.title}</h3>
			{#if meta.author}
				<p class="text-sm text-muted">{meta.author}</p>
			{/if}
			{#if meta.issueLabel}
				<p class="text-sm font-semibold text-accent-emerald/80">{meta.issueLabel}</p>
			{/if}
		</div>

		<dl class="mt-auto grid grid-cols-2 gap-3 text-xs">
			<div class="space-y-1 rounded-lg border border-slate-900/70 bg-slate-950/30 p-2">
				<dt class="meta-label text-[0.7rem] uppercase tracking-[0.2em]">Size</dt>
				<dd class="text-sm text-strong">{fileSizeLabel}</dd>
			</div>
			<div class="space-y-1 rounded-lg border border-slate-900/70 bg-slate-950/30 p-2">
				<dt class="meta-label text-[0.7rem] uppercase tracking-[0.2em]">Updated</dt>
				<dd class="text-sm text-strong">
					{new Date(meta.lastModified).toLocaleDateString()}
				</dd>
			</div>
		</dl>
	</div>

	<div class="mt-auto flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
		<button
			class="primary-cta inline-flex items-center justify-center"
			type="button"
			onclick={() => (window.location.href = `/reader?book=${meta.slug}`)}
		>
			Launch Reader
		</button>
		<a
			class="secondary-cta inline-flex items-center justify-center"
			href={meta.fileUrl}
			download
		>
			Download EPUB
		</a>
	</div>

</article>
