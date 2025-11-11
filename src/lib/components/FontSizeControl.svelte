<script lang="ts">
  import { fontSizeStore } from '$lib/stores/reader';
  let value = $state(18);
  $effect(() => {
    const unsub = fontSizeStore.subscribe((v) => (value = v));
    return () => unsub();
  });
</script>

<div class="inline-flex items-center gap-2">
  <button
    type="button"
    class="reader-button rounded-full border px-2 py-1 text-xs transition"
    title="Reset font size"
    onclick={() => fontSizeStore.reset()}
  >
    Reset
  </button>
  <button
    type="button"
    class="reader-button rounded-full border px-2 py-1 text-xs transition"
    title="Smaller"
    onclick={() => fontSizeStore.decrease()}
  >
    A-
  </button>
  <button
    type="button"
    class="reader-button rounded-full border px-2 py-1 text-xs transition"
    title="Larger"
    onclick={() => fontSizeStore.increase()}
  >
    A+
  </button>
  <span class="text-xs opacity-70 w-8 text-center">{value}px</span>
</div>
