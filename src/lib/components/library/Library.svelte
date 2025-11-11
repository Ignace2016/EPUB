<script lang="ts">
import { invalidateAll } from '$app/navigation';
import { get } from 'svelte/store';
import { fade } from 'svelte/transition';
import type { LibraryFile, LibraryFolder, LibraryNode } from '$lib/utils/epub-scanner';
import FolderNode from './FolderNode.svelte';
import EpubCard from './EpubCard.svelte';
import { activeFolderPath } from '$lib/stores/library';

let { root } = $props<{ root: LibraryFolder }>();

let expandedPaths = $state(bootstrapExpansion(root));

const initialSelectedPath = get(activeFolderPath) ?? root.path;

let selectedPath = $state(root.path);

expandForPath(root.path);

$effect(() => {
	activeFolderPath.set(selectedPath);
});

$effect(() => {
	if (initialSelectedPath !== root.path) {
		const existing = findFolder(root, initialSelectedPath);
		if (existing) {
			selectedPath = initialSelectedPath;
			expandForPath(initialSelectedPath);
		}
	}
});

const currentFolder = $derived(findFolder(root, selectedPath) ?? root);
const currentFiles = $derived(sortByUpdated(collectFiles(currentFolder)));
const breadcrumb = $derived(buildBreadcrumb(selectedPath));
const totalTitles = $derived(countTitles(root));
const sidebarFolders = $derived(
	root.children
		.filter((child: LibraryNode): child is LibraryFolder => child.type === 'folder')
		.sort((a: LibraryFolder, b: LibraryFolder) => {
			const isMagA = a.name.toLowerCase().includes('magazine');
			const isMagB = b.name.toLowerCase().includes('magazine');
			if (isMagA === isMagB) {
				return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
			}
			return isMagA ? 1 : -1;
		})
);

function onSelect(path: string) {
	selectedPath = path;
	expandForPath(path);
}

function onToggle(path: string) {
	const next = new Set(expandedPaths);
	next.has(path) ? next.delete(path) : next.add(path);
	expandedPaths = next;
}

async function rescan() {
	await invalidateAll();
}

function showEntireCollection() {
	if (selectedPath !== root.path) {
		selectedPath = root.path;
		expandForPath(root.path);
	}
}

function findFolder(node: LibraryFolder, pathValue: string): LibraryFolder | null {
	if (node.path === pathValue) return node;
	for (const child of node.children) {
		if (child.type === 'folder') {
			const match = findFolder(child, pathValue);
			if (match) return match;
		}
	}
	return null;
}

function buildBreadcrumb(pathValue: string) {
	const parts = pathValue.split('/').slice(1);
	return parts.join(' / ') || 'Books';
}

function bootstrapExpansion(folder: LibraryFolder) {
	const defaults = new Set<string>([folder.path]);
	folder.children
		.filter((child): child is LibraryFolder => child.type === 'folder')
		.forEach((child) => defaults.add(child.path));
	return defaults;
}

function syncSelectionPath(paths: Set<string>, pathValue: string, folder: LibraryFolder): Set<string> {
	const selectionTrail = pathValue.split('/');
	const next = new Set(paths);
	let cursor = folder;
	let prefix = cursor.path;

	for (let i = 1; i < selectionTrail.length; i += 1) {
		const segment = selectionTrail[i];
		prefix = `${prefix}/${segment}`;
		next.add(prefix);
		const nextFolder = cursor.children.find(
			(child): child is LibraryFolder => child.type === 'folder' && child.path === prefix
		);
		if (!nextFolder) break;
		cursor = nextFolder;
	}

	return next;
}

function countTitles(node: LibraryFolder): number {
	return node.children.reduce((acc, child: LibraryNode) => {
		if (child.type === 'epub') return acc + 1;
		if (child.type === 'folder') return acc + countTitles(child);
		return acc;
	}, 0);
}

function expandForPath(path: string) {
	expandedPaths = syncSelectionPath(expandedPaths, path, root);
}

function collectFiles(folder: LibraryFolder): LibraryFile[] {
	return folder.children.flatMap((child) => {
		if (child.type === 'epub') return [child];
		return collectFiles(child);
	});
}

function sortByUpdated(files: LibraryFile[]): LibraryFile[] {
	return [...files].sort((a, b) => {
		const aTime = new Date(a.metadata.lastModified).getTime();
		const bTime = new Date(b.metadata.lastModified).getTime();
		return bTime - aTime;
	});
}
</script>

<div class="grid gap-6 lg:grid-cols-[320px,1fr]">
	<aside
		class="space-y-5 rounded-3xl border border-slate-900/80 bg-gradient-to-b from-slate-900/60 to-slate-950/60 p-5"
	>
		<button
			type="button"
			class="w-full rounded-2xl border border-slate-900/70 bg-slate-950/40 p-4 text-left text-sm transition hover:border-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
			onclick={showEntireCollection}
		>
			<p class="text-xs uppercase tracking-[0.35em] text-strong">Collection Overview</p>
			<h2 class="text-2xl font-semibold text-strong">{totalTitles} books</h2>
			<p class="text-muted">Select a shelf to explore.</p>
		</button>

		<div class="space-y-3">
			{#each sidebarFolders as folder (folder.path)}
				<FolderNode
					node={folder}
					{selectedPath}
					{expandedPaths}
					onSelectFolder={onSelect}
					onToggleFolder={onToggle}
				/>
			{/each}
		</div>
	</aside>

	<main class="space-y-6 rounded-3xl border border-slate-900/70 bg-slate-950/40 p-6">
		<div class="flex flex-col gap-4 border-b border-slate-900/60 pb-6 lg:flex-row lg:items-center lg:justify-between">
			<div>
				<p class="text-xs uppercase tracking-[0.4em] text-strong">Current folder</p>
				<h2 class="text-2xl font-semibold text-strong">{currentFolder.name}</h2>
				<p class="text-sm text-strong/70">{breadcrumb}</p>
			</div>

			<div class="flex flex-wrap gap-3">
				<button
					class="secondary-cta inline-flex items-center gap-2"
					onclick={rescan}
					type="button"
				>
					<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path
							d="M21 2v6h-6M3 22v-6h6m-6-4a9 9 0 0 1 15-6.7M21 12a9 9 0 0 1-15 6.7"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
					Rescan Library
				</button>
			</div>
		</div>

		{#if currentFiles.length}
			<div
				class="grid gap-5 md:grid-cols-2"
				in:fade={{ duration: 200 }}
				out:fade={{ duration: 150 }}
			>
				{#each currentFiles as file (file.path)}
					<EpubCard {file} />
				{/each}
			</div>
		{:else}
				<div class="rounded-2xl border border-dashed border-slate-800 bg-slate-950/30 p-10 text-center">
					<p class="text-lg font-semibold text-strong">No EPUB files in this folder yet</p>
					<p class="text-sm text-muted">
						Drop <code class="rounded bg-slate-900/60 px-2 py-1 text-xs">.epub</code> files into the matching directory inside
						<code class="rounded bg-slate-900/60 px-2 py-1 text-xs">/Books</code>.
					</p>
				</div>
		{/if}
	</main>
</div>
