<script lang="ts">
	import Library from '$lib/components/library/Library.svelte';
	import { libraryStore } from '$lib/stores/library';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();

	$effect(() => {
		libraryStore.set(data.library);
	});
</script>

<section class="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 lg:py-16">
	<Library root={data.library} />
</section>
