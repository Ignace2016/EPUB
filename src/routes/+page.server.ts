import type { PageServerLoad } from './$types';
import { getLibrary } from '$lib/utils/epub-scanner';

export const load: PageServerLoad = async () => {
	const library = await getLibrary();
	return {
		library
	};
};
