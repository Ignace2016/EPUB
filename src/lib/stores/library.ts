import { writable } from 'svelte/store';
import type { LibraryFolder, LibraryNode } from '$lib/utils/epub-scanner';

export const libraryStore = writable<LibraryFolder | null>(null);
export const activeFolderPath = writable<string>('Books');
export const highlightedNode = writable<LibraryNode | null>(null);
