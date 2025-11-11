<script lang="ts">
	import Reader from '$lib/components/reader/Reader.svelte';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();
</script>

<section class="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
	<header class="flex flex-col gap-3">
    <button
        type="button"
        class="inline-flex w-fit items-center gap-2 text-sm font-semibold text-accent-emerald transition hover:text-strong"
        onclick={() => (window.location.href = '/')}
    >
			<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
        Back to Library
    </button>
		<div>
			<p class="text-xs uppercase tracking-[0.35em] text-muted">Return to your last chapter any time</p>
			<h1 class="text-3xl font-semibold text-strong">Reading Room</h1>
			<p class="text-sm text-muted">Comfort-first, distraction-light view tailored to this issue.</p>
		</div>
	</header>

	<Reader book={data.book} initialHref={data.initialHref} />
</section>
