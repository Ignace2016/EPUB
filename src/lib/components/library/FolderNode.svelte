<script lang="ts">
import { slide } from 'svelte/transition';
import RecursiveFolderNode from './FolderNode.svelte';
import type { LibraryFolder, LibraryNode } from '$lib/utils/epub-scanner';

let { node, selectedPath, expandedPaths, depth = 0, onSelectFolder, onToggleFolder } = $props<{
	node: LibraryFolder;
	selectedPath: string;
	expandedPaths: Set<string>;
	depth?: number;
	onSelectFolder: (path: string) => void;
	onToggleFolder: (path: string) => void;
}>();

const folderChildren = $derived(
	node.children.filter((child: LibraryNode): child is LibraryFolder => child.type === 'folder')
);
const epubCount = $derived(countEpubs(node));

	const isOpen = $derived(expandedPaths.has(node.path));
	const isSelected = $derived(selectedPath === node.path);

	function onToggle(event: MouseEvent) {
		event.stopPropagation();
		onToggleFolder(node.path);
	}

function onSelect() {
	onSelectFolder(node.path);
}

function countEpubs(folder: LibraryFolder): number {
	return folder.children.reduce((total, child) => {
		if (child.type === 'epub') return total + 1;
		if (child.type === 'folder') return total + countEpubs(child);
		return total;
	}, 0);
}
</script>

<div class="space-y-2">
	<div
		class={`folder-node ${isSelected ? 'folder-node--active' : ''}`}
		style={`padding-left: ${depth * 0.5}rem`}
	>
		<button
			type="button"
			class="folder-toggle rounded-lg border border-transparent p-1"
			onclick={onToggle}
			aria-label={isOpen ? 'Collapse folder' : 'Expand folder'}
		>
			<svg
				class={`h-4 w-4 transition ${isOpen ? 'rotate-90' : ''}`}
				viewBox="0 0 20 20"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<path d="M7 5l6 5-6 5" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
		</button>

		<button
			type="button"
			class={`flex flex-1 items-center justify-between text-left text-sm font-medium ${
				isSelected ? 'text-strong' : 'text-muted'
			}`}
			onclick={onSelect}
		>
			<span class="flex items-center gap-2">
				<span class="folder-icon inline-flex h-6 w-6 items-center justify-center rounded-lg text-xs">
					📁
				</span>
				{node.name}
			</span>
			<span class="folder-count rounded-full px-2 py-0.5 text-xs">
				{epubCount}
			</span>
		</button>
	</div>

	{#if isOpen && folderChildren.length}
		<div class="space-y-2 border-l border-slate-900/70 pl-4" in:slide={{ duration: 180 }}>
			{#each folderChildren as child}
				<RecursiveFolderNode
					node={child}
					{selectedPath}
					{expandedPaths}
					depth={depth + 1}
					onSelectFolder={onSelectFolder}
					onToggleFolder={onToggleFolder}
				/>
			{/each}
		</div>
	{/if}
</div>
