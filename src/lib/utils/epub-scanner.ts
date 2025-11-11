import path from 'node:path';
import type { Dirent } from 'node:fs';
import { promises as fs } from 'node:fs';

import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';

const LIBRARY_ROOT_NAME = 'Books';
const LIBRARY_ROOT = path.resolve(LIBRARY_ROOT_NAME);
const PUBLIC_PREFIX = '/EPUB';
const ROOT_PREFIX_REGEX = new RegExp(`^${LIBRARY_ROOT_NAME}/`);
const CACHE_WINDOW_MS = 60 * 1000;

const xmlParser = new XMLParser({
	ignoreDeclaration: true,
	trimValues: true,
	removeNSPrefix: true,
	ignoreAttributes: false,
	attributeNamePrefix: '',
	textNodeName: 'text'
});

export type TocNode = {
	title: string;
	href?: string;
	children?: TocNode[];
};

export type EpubMetadata = {
	title: string;
	author?: string;
	description?: string;
	coverImage?: string;
	fileUrl: string;
	filePath: string;
	fileSize: number;
	lastModified: string;
	folderTrail: string[];
	slug: string;
	isMagazine: boolean;
	issueLabel?: string;
	toc?: TocNode[];
};

export type LibraryFile = {
	type: 'epub';
	name: string;
	path: string;
	metadata: EpubMetadata;
};

export type LibraryFolder = {
	type: 'folder';
	name: string;
	path: string;
	children: LibraryNode[];
};

export type LibraryNode = LibraryFolder | LibraryFile;

let cachedLibrary: LibraryFolder | null = null;
let lastScan = 0;

export async function getLibrary(options?: { force?: boolean }): Promise<LibraryFolder> {
	const shouldReuseCache = cachedLibrary && Date.now() - lastScan < CACHE_WINDOW_MS && !options?.force;
	if (shouldReuseCache && cachedLibrary) {
		return cachedLibrary;
	}

	const library = await scanDirectory(LIBRARY_ROOT, LIBRARY_ROOT_NAME);
	cachedLibrary = library;
	lastScan = Date.now();
	return library;
}

async function scanDirectory(absPath: string, relativePath: string): Promise<LibraryFolder> {
	let dirEntries: Dirent[] = [];

	try {
		dirEntries = await fs.readdir(absPath, { withFileTypes: true });
	} catch (error) {
		console.error(`Unable to read directory ${absPath}`, error);
	}

	const children: LibraryNode[] = [];

	for (const entry of dirEntries) {
		if (entry.name.startsWith('.')) continue;
		const childAbs = path.join(absPath, entry.name);
		const childRel = path.posix.join(relativePath, entry.name);

		if (entry.isDirectory()) {
			const folder = await scanDirectory(childAbs, childRel);
			children.push(folder);
		} else if (entry.isFile() && entry.name.toLowerCase().endsWith('.epub')) {
			const metadata = await extractEpubMetadata(childAbs, childRel);
			children.push({
				type: 'epub',
				name: entry.name,
				path: childRel,
				metadata
			});
		}
	}

	children.sort((a, b) => {
		if (a.type === b.type) {
			return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
		}

		return a.type === 'folder' ? -1 : 1;
	});

	return {
		type: 'folder',
		name: path.basename(absPath),
		path: relativePath,
		children
	};
}

async function extractEpubMetadata(absPath: string, relPath: string): Promise<EpubMetadata> {
	const fallbackTitle = deriveTitleFromFilename(relPath);
	const folderTrail = relPath.split('/').slice(1, -1);

	try {
		const [fileBuffer, stats] = await Promise.all([fs.readFile(absPath), fs.stat(absPath)]);
		const zip = await JSZip.loadAsync(fileBuffer);

		const containerXml = await zip.file('META-INF/container.xml')?.async('text');
		if (!containerXml) throw new Error('Missing container.xml');

		const containerDoc = xmlParser.parse(containerXml);
		const rootfile =
			containerDoc?.container?.rootfiles?.rootfile?.['full-path'] ??
			containerDoc?.container?.rootfiles?.rootfile?.['fullPath'];

		if (!rootfile) throw new Error('Missing OPF rootfile');

		const opfText = await zip.file(rootfile)?.async('text');
		if (!opfText) throw new Error('Missing OPF file');

		const opfDoc = xmlParser.parse(opfText);
		const pkg = opfDoc?.package ?? {};
		const metadataNode = pkg.metadata ?? {};

		const manifestItems = toArray(pkg?.manifest?.item);
		const metaEntries = toArray(metadataNode.meta);

		const title = sanitizeText(pickText(metadataNode.title)) ?? fallbackTitle;
		let author = sanitizeText(pickText(metadataNode.creator)) ?? '';
		const description = sanitizeText(pickText(metadataNode.description));

		const coverImage = await extractCover(zip, manifestItems, metaEntries, rootfile);
		const toc = await buildToc(zip, pkg, manifestItems, rootfile);

		const relativeFromRoot = relPath.replace(ROOT_PREFIX_REGEX, '');
		const fileUrl = `${PUBLIC_PREFIX}/${relativeFromRoot}`;

		const slug = relPath
			.replace(ROOT_PREFIX_REGEX, '')
			.replace(/\.epub$/i, '')
			.replace(/[^\w/]+/g, '-')
			.replace(/-+/g, '-')
			.toLowerCase();

		const isMagazine = relPath.includes('Magazines/The Economist');
		const issueLabel = isMagazine ? deriveIssueLabel(path.basename(relPath)) : undefined;

return {
	title,
	author,
			description,
			coverImage,
			fileUrl,
			filePath: relPath,
			fileSize: stats.size,
			lastModified: stats.mtime.toISOString(),
			folderTrail,
			slug,
			isMagazine,
			issueLabel,
			toc
		};
	} catch (error) {
		console.error(`Failed to parse EPUB metadata for ${relPath}`, error);
return {
	title: fallbackTitle,
	author: undefined,
			description: undefined,
			coverImage: undefined,
			fileUrl: `${PUBLIC_PREFIX}/${relPath.replace(ROOT_PREFIX_REGEX, '')}`,
			filePath: relPath,
			fileSize: 0,
			lastModified: new Date().toISOString(),
			folderTrail,
			slug: fallbackTitle.toLowerCase().replace(/\s+/g, '-'),
			isMagazine: relPath.includes('Magazines/The Economist')
		};
	}
}

async function extractCover(
	zip: JSZip,
	manifestItems: any[],
	metaEntries: any[],
	rootfile: string
): Promise<string | undefined> {
	const opfDir = path.posix.dirname(rootfile);
	const coverMeta = metaEntries.find((meta) => meta.name === 'cover' || meta['property'] === 'cover');

	let coverHref: string | undefined;

	if (coverMeta?.content) {
		const coverItem = manifestItems.find((item) => item.id === coverMeta.content);
		coverHref = coverItem?.href;
	}

	const propertiesCover = manifestItems.find((item) =>
		String(item.properties ?? '')
			.split(/\s+/)
			.includes('cover-image')
	);

	if (!coverHref && propertiesCover?.href) {
		coverHref = propertiesCover.href;
	}

	const fallbackCover = manifestItems.find((item) => item.id?.toLowerCase().includes('cover'));
	if (!coverHref && fallbackCover?.href) {
		coverHref = fallbackCover.href;
	}

	if (!coverHref) return undefined;

	const normalizedCoverPath = path.posix.join(opfDir === '.' ? '' : opfDir, coverHref);
	const coverFile = zip.file(normalizedCoverPath);
	if (!coverFile) return undefined;

	const mimeType =
		propertiesCover?.['media-type'] ?? fallbackCover?.['media-type'] ?? guessMimeType(coverHref);
	const base64 = await coverFile.async('base64');
	return `data:${mimeType ?? 'image/jpeg'};base64,${base64}`;
}

async function buildToc(
	zip: JSZip,
	pkg: any,
	manifestItems: any[],
	rootfile: string
): Promise<TocNode[] | undefined> {
	const opfDir = path.posix.dirname(rootfile);

	const navItem = manifestItems.find((item) =>
		String(item.properties ?? '')
			.split(/\s+/)
			.includes('nav')
	);

	if (navItem?.href) {
		const navPath = path.posix.join(opfDir === '.' ? '' : opfDir, navItem.href);
		return parseNavDocument(zip, navPath);
	}

	const tocId = pkg?.spine?.toc;
	if (!tocId) return undefined;
	const ncxItem = manifestItems.find((item) => item.id === tocId);
	if (!ncxItem?.href) return undefined;

	const ncxPath = path.posix.join(opfDir === '.' ? '' : opfDir, ncxItem.href);
	return parseNcx(zip, ncxPath);
}

async function parseNavDocument(zip: JSZip, navPath: string): Promise<TocNode[] | undefined> {
	const navFile = zip.file(navPath);
	if (!navFile) return undefined;

	const navText = await navFile.async('text');
	const navDoc = xmlParser.parse(navText);

	const navNode = findFirstNav(navDoc);
	if (!navNode) return undefined;

	const orderedList = navNode.ol ?? navNode.div?.ol;
	if (!orderedList) return undefined;

	return normalizeList(orderedList);
}

async function parseNcx(zip: JSZip, ncxPath: string): Promise<TocNode[] | undefined> {
	const ncxFile = zip.file(ncxPath);
	if (!ncxFile) return undefined;

	const ncxText = await ncxFile.async('text');
	const ncxDoc = xmlParser.parse(ncxText);
	const navMap = ncxDoc?.ncx?.navMap;
	if (!navMap) return undefined;

	return normalizeNavPoints(toArray(navMap.navPoint));
}

function findFirstNav(node: any): any | undefined {
	if (!node || typeof node !== 'object') return undefined;
	if (node.nav) {
		return Array.isArray(node.nav) ? node.nav[0] : node.nav;
	}

	for (const value of Object.values(node)) {
		const candidate = typeof value === 'object' ? findFirstNav(value) : undefined;
		if (candidate) return candidate;
	}

	return undefined;
}

function normalizeList(listNode: any): TocNode[] {
	const listItems = toArray(listNode?.li);

	return listItems
		.map((item) => {
			const link =
				item.a ??
				(Array.isArray(item.p) ? item.p[0]?.a : item.p?.a) ??
				item.span?.a ??
				item.div?.a;

			const title = pickText(link?.text ?? link?.span?.text ?? item.span?.text ?? item.text);
			if (!title) return undefined;

			const href = link?.href;
			const children = item.ol ? normalizeList(item.ol) : undefined;

			return {
				title,
				href,
				children
			} as TocNode;
		})
		.filter(Boolean) as TocNode[];
}

function normalizeNavPoints(points: any[]): TocNode[] {
	return points
		.map((point) => {
			const title = pickText(point?.navLabel?.text ?? point?.navLabel);
			const href = point?.content?.src;
			const children = point?.navPoint ? normalizeNavPoints(toArray(point.navPoint)) : undefined;
			if (!title) return undefined;
			return { title, href, children };
		})
		.filter(Boolean) as TocNode[];
}

function toArray<T>(value: T | T[] | undefined): T[] {
	if (!value) return [];
	return Array.isArray(value) ? value : [value];
}

function pickText(value: any): string | undefined {
	if (!value) return undefined;
	if (typeof value === 'string') return value;
	if (Array.isArray(value)) return pickText(value[0]);
	if (typeof value === 'object') return value.text ?? value['#text'] ?? value._ ?? value.value;
	return undefined;
}

function guessMimeType(href: string | undefined): string | undefined {
	if (!href) return undefined;
	const ext = href.split('.').pop()?.toLowerCase();
	switch (ext) {
		case 'jpg':
		case 'jpeg':
			return 'image/jpeg';
		case 'png':
			return 'image/png';
		case 'gif':
			return 'image/gif';
		case 'webp':
			return 'image/webp';
		default:
			return undefined;
	}
}

function deriveTitleFromFilename(relPath: string): string {
	const filename = path.basename(relPath, path.extname(relPath));
	return filename
		.replace(/[_\-]+/g, ' ')
		.replace(/[\[(](?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[^\])]*[\])]/gi, '')
		.replace(/[\[(][^\])]*\]|\([^)]*\)/g, '')
		.replace(/\b\d{4}-\d{2}-\d{2}\b/gi, '')
		.replace(/\s+/g, ' ')
		.trim();
}

function deriveIssueLabel(basename: string): string | undefined {
	const dateMatch = basename.match(/(\d{4})-(\d{2})-(\d{2})/);
	if (!dateMatch) return undefined;
	const [, year, month, day] = dateMatch;
	const issueDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12));
	return issueDate.toLocaleDateString('en-US', {
		month: 'long',
		day: 'numeric',
		year: 'numeric'
	});
}

function sanitizeText(value?: string | null): string | undefined {
	if (!value) return undefined;
	const cleaned = value
		.replace(/<[^>]+>/g, '')
		.replace(/https?:\/\/\S+/gi, '')
		.replace(/[\[(](?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[^\])]*[\])]/gi, '')
		.replace(/[\[(][^\])]*\]|\([^)]*\)/g, '')
		.replace(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\.?(?:\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s*\d{4})?)?/gi, '')
		.replace(/\s+/g, ' ')
		.trim();
	return cleaned.length ? cleaned : undefined;
}

export function findBookBySlug(root: LibraryFolder, slug: string): LibraryFile | null {
	if (!slug) return null;
	const normalized = slug.toLowerCase();
	const queue: LibraryNode[] = [...root.children];

	while (queue.length) {
		const node = queue.shift();
		if (!node) continue;
		if (node.type === 'epub') {
			if (node.metadata.slug === normalized) {
				return node;
			}
		} else {
			queue.push(...node.children);
		}
	}

	return null;
}
