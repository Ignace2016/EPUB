import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { findBookBySlug, getLibrary } from '$lib/utils/epub-scanner';

export const load: PageServerLoad = async ({ url }) => {
	const slug = url.searchParams.get('book');
	const href = url.searchParams.get('href');

	if (!slug) {
		throw error(400, 'Missing `book` query parameter');
	}

    const library = await getLibrary({ force: true });
	const book = findBookBySlug(library, slug);

	if (!book) {
		throw error(404, `Unable to locate book "${slug}"`);
	}

	return {
		book,
		initialHref: href ?? null
	};
};
