import { writable } from 'svelte/store';

export type AppearanceModeId = 'day' | 'night' | 'sepia';

export type AppearanceModeConfig = {
	id: AppearanceModeId;
	label: string;
	description: string;
	swatch: [string, string];
	surface: {
		background: string;
		border: string;
		text: string;
		muted: string;
	};
	reader: {
		background: string;
		text: string;
		link: string;
	};
};

export const appearanceModes: AppearanceModeConfig[] = [
	{
		id: 'day',
		label: 'Day',
		description: 'Bright and crisp',
		swatch: ['#f3f4f6', '#cbd5f5'],
		surface: {
			background: '#f3f4f6',
			border: '#d7dee8',
			text: '#0f172a',
			muted: '#1f2937'
		},
		reader: {
			background: '#ffffff',
			text: '#111827',
			link: '#c2791a'
		}
	},
	{
		id: 'night',
		label: 'Night',
		description: 'Deep charcoal',
		swatch: ['#0f172a', '#1e293b'],
		surface: {
			background: '#0f172a',
			border: '#1e293b',
			text: '#f1f5f9',
			muted: '#94a3b8'
		},
		reader: {
			background: '#06090f',
			text: '#edf1f7',
			link: '#2fd4a7'
		}
	},
	{
		id: 'sepia',
		label: 'Sepia',
		description: 'Warm paper',
		swatch: ['#fbf3e2', '#d8c3a4'],
		surface: {
			background: '#f4ecdb',
			border: '#eadcc3',
			text: '#3b2f1d',
			muted: '#2c1f10'
		},
		reader: {
			background: '#fbf3e2',
			text: '#3b2f1d',
			link: '#a45a11'
		}
	}
];

const DEFAULT_APPEARANCE: AppearanceModeId = 'day';

function createAppearanceModeStore() {
	const { subscribe, set } = writable<AppearanceModeId>(DEFAULT_APPEARANCE);
	return {
		subscribe,
		setMode: (modeId: AppearanceModeId) => {
			const safeMode =
				appearanceModes.find((mode) => mode.id === modeId)?.id ?? DEFAULT_APPEARANCE;
			set(safeMode);
		}
	};
}

export const appearanceModeStore = createAppearanceModeStore();

export function getAppearanceConfig(modeId: AppearanceModeId) {
	return appearanceModes.find((mode) => mode.id === modeId) ?? appearanceModes[0];
}
