import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          amber: '#F59E0B',
          'amber-dark': '#B45309',
          cream: '#FFF7ED',
          charcoal: '#111827',
          ink: '#0B1220',
          red: '#EF4444',
        },
      },
    },
  },
  plugins: [],
}
export default config
