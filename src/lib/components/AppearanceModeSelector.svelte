<script lang="ts">
	import { appearanceModeStore, appearanceModes, type AppearanceModeId } from '$lib/stores/reader';

	let selectedMode = $state<AppearanceModeId>(appearanceModes[0].id);
	const activeMode = $derived(
		appearanceModes.find((mode) => mode.id === selectedMode) ?? appearanceModes[0]
	);

	let isOpen = $state(false);
	let container: HTMLDivElement | null = null;

	$effect(() => {
		const unsubscribe = appearanceModeStore.subscribe((modeId) => {
			selectedMode = modeId;
		});
		return () => unsubscribe();
	});

	$effect(() => {
		function handleClick(event: MouseEvent) {
			if (!container) return;
			if (!container.contains(event.target as Node)) {
				isOpen = false;
			}
		}

		window.addEventListener('click', handleClick);
		return () => window.removeEventListener('click', handleClick);
	});

	function selectMode(modeId: AppearanceModeId) {
		appearanceModeStore.setMode(modeId);
		isOpen = false;
	}

	function toggleDropdown() {
		isOpen = !isOpen;
	}
</script>

<div class="appearance-dropdown" bind:this={container}>
	<button
		type="button"
		class="appearance-select"
		onclick={toggleDropdown}
		aria-expanded={isOpen}
	>
		<div
			class="appearance-swatch"
			style={`background: linear-gradient(120deg, ${activeMode.swatch[0]}, ${activeMode.swatch[1]})`}
		></div>
		<div class="text-left">
			<p class="text-sm font-semibold uppercase tracking-[0.25em]">{activeMode.label}</p>
			<p class="text-xs opacity-70">{activeMode.description}</p>
		</div>
		<svg
			class={`h-4 w-4 transition ${isOpen ? 'rotate-180' : ''}`}
			viewBox="0 0 20 20"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
		>
			<path d="M5 8l5 5 5-5" stroke-linecap="round" stroke-linejoin="round" />
		</svg>
	</button>

	{#if isOpen}
		<div class="appearance-menu">
			{#each appearanceModes as mode}
				<button
					type="button"
					class={`appearance-option ${selectedMode === mode.id ? 'appearance-option--active' : ''}`}
					onclick={() => selectMode(mode.id)}
					aria-pressed={selectedMode === mode.id}
				>
					<div
						class="appearance-swatch"
						style={`background: linear-gradient(120deg, ${mode.swatch[0]}, ${mode.swatch[1]})`}
					></div>
					<div class="text-left">
						<p class="text-sm font-semibold uppercase tracking-[0.25em]">{mode.label}</p>
						<p class="text-xs opacity-70">{mode.description}</p>
					</div>
				</button>
			{/each}
		</div>
	{/if}
</div>
