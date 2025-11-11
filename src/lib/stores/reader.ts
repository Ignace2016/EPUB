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

// Distraction-Free Mode
function createDistractionFreeStore() {
    const { subscribe, set, update } = writable(false);
    return {
        subscribe,
        enable: () => set(true),
        disable: () => set(false),
        toggle: () => update((v) => !v)
    };
}

export const distractionFreeStore = createDistractionFreeStore();

// Font size (px) for reader content
function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n));
}

export const fontSizeStore = (() => {
    const MIN = 14;
    const MAX = 28;
    const STEP = 2;
    const DEFAULT = 22;
    const { subscribe, set, update } = writable<number>(DEFAULT);
    return {
        subscribe,
        set: (px: number) => set(clamp(px, MIN, MAX)),
        increase: () => update((v) => clamp(v + STEP, MIN, MAX)),
        decrease: () => update((v) => clamp(v - STEP, MIN, MAX)),
        reset: () => set(DEFAULT),
        limits: { MIN, MAX, STEP, DEFAULT }
    };
})();
