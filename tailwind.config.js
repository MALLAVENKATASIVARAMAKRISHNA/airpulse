/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        darkBg:     '#080705',
        darkCard:   'rgba(255,255,255,0.04)',
        brandBlue:  '#006aff',
        brandGreen: '#10d343',
        brandCyan:  '#00a2ff',
        aqi: {
          good:         '#00E400',
          satisfactory: '#76C442',
          moderate:     '#FFFF00',
          poor:         '#FF7E00',
          veryPoor:     '#FF0000',
          severe:       '#8F3F97',
        },
      },
      borderRadius: { card: '16px', btn: '12px' },
      fontFamily:   { sans: ['Inter', 'DM Sans', 'sans-serif'] },
    },
  },
  plugins: [],
}
