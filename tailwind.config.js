/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				slate: {
					950: '#050607',
					900: '#0b0d12',
					800: '#161823',
					700: '#1f2233',
					600: '#2b2f46',
					500: '#4f5977'
				},
				accent: {
					emerald: '#2fd4a7',
					sky: '#6f9cff'
				}
			},
			fontFamily: {
				sans: ['Inter', 'system-ui', 'sans-serif']
			},
			boxShadow: {
				card: '0 10px 40px -25px rgba(111, 156, 255, 0.75)'
			}
		}
	},
	plugins: []
};
