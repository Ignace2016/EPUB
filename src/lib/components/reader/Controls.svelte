<script lang="ts">
	let {
		chapterLabel,
		onPrev,
		onNext,
		isPrevDisabled,
		isNextDisabled,
		isNavigating
	} = $props<{
		chapterLabel: string;
		onPrev: () => void;
		onNext: () => void;
		isPrevDisabled: boolean;
		isNextDisabled: boolean;
		isNavigating: boolean;
	}>();
</script>

<div class="reader-surface flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-4">
	<div>
		<p class="reader-muted text-xs uppercase tracking-[0.35em]">Now reading</p>
		<p class="text-base font-semibold">{chapterLabel}</p>
	</div>

	<div class="flex flex-wrap items-center gap-3">
		<button
			class="reader-nav inline-flex items-center gap-2 text-sm"
			onclick={onPrev}
			type="button"
			disabled={isPrevDisabled || isNavigating}
		>
			<svg class="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M12 5l-5 5 5 5" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
			Prev
		</button>
		<button
			class="reader-nav inline-flex items-center gap-2 text-sm"
			onclick={onNext}
			type="button"
			disabled={isNextDisabled || isNavigating}
		>
			Next
			<svg class="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M8 5l5 5-5 5" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
		</button>
	</div>

	<div class="reader-muted hidden flex-col text-xs uppercase tracking-[0.35em] md:flex">
		<span>Keyboard · ← → · PgUp PgDn</span>
		<span>Touch · swipe edges</span>
	</div>
</div>
