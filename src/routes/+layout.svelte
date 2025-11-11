<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import AppearanceModeSelector from '$lib/components/AppearanceModeSelector.svelte';
	import {
		appearanceModeStore,
		appearanceModes,
		type AppearanceModeId
	} from '$lib/stores/reader';

	let { children } = $props();

	let appearanceModeId = $state<AppearanceModeId>(appearanceModes[0].id);

	const activeAppearance = $derived(
		appearanceModes.find((mode) => mode.id === appearanceModeId) ?? appearanceModes[0]
	);

	const themeVars = $derived(
		[
			`--app-bg:${activeAppearance.surface.background}`,
			`--app-text:${activeAppearance.surface.text}`,
			`--app-border:${activeAppearance.surface.border}`,
			`--reader-surface-bg:${activeAppearance.surface.background}`,
			`--reader-surface-border:${activeAppearance.surface.border}`,
			`--reader-surface-text:${activeAppearance.surface.text}`,
			`--reader-surface-muted:${activeAppearance.surface.muted}`,
			`--reader-panel-bg:${activeAppearance.reader.background}`,
			`--reader-panel-text:${activeAppearance.reader.text}`,
			`--reader-panel-link:${activeAppearance.reader.link}`,
			`--reader-nav-text:${resolveNavText(appearanceModeId)}`
		].join(';') + ';'
	);

	$effect(() => {
		const unsubscribe = appearanceModeStore.subscribe((modeId) => {
			appearanceModeId = modeId;
		});
		return () => unsubscribe();
	});

	function resolveNavText(modeId: AppearanceModeId) {
		switch (modeId) {
			case 'night':
				return '#041b18';
			case 'sepia':
				return '#3b2f1d';
			default:
				return '#04101a';
		}
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Astra · Premium EPUB Library</title>
</svelte:head>

<div class="theme-shell antialiased" style={themeVars} data-theme={appearanceModeId}>
	<header class="global-header">
		<div>
			<p class="text-xs uppercase tracking-[0.4em] opacity-70">Astra</p>
		</div>
		<div class="w-full max-w-xl">
			<AppearanceModeSelector />
		</div>
	</header>

	<main class="app-body">
		{@render children()}
	</main>
</div>
