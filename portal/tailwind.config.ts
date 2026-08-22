import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // OpenX Live Core Tokens
        background: '#131314',
        surface: '#201f20',
        'surface-container-lowest': '#0e0e0f',
        'surface-container-low': '#1c1b1c',
        'surface-container': '#201f20',
        'surface-container-high': '#2a2a2b',
        'surface-container-highest': '#353436',
        primary: '#00f0ff',
        'primary-container': '#00f0ff',
        'on-primary': '#00363a',
        'primary-text': '#dbfcff',
        secondary: '#13ff43',
        'secondary-container': '#13ff43',
        'on-secondary': '#003907',
        tertiary: '#d1bcff',
        error: '#ffb4ab',
        'on-surface': '#e5e2e3',
        'on-surface-variant': '#b9cacb',
        outline: '#849495',
        'outline-variant': '#3b494b',

        // Dedicated Subproject Accent (Violet Nav Chrome & Distinct Identity)
        'agent-accent': '#7c5cff',
        'on-agent-accent': '#f4f0ff',
        'agent-accent-dim': '#6344e6',
        'agent-accent-glow': 'rgba(124, 92, 255, 0.15)',
      },
      fontFamily: {
        headline: ['Geist', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        body: ['Geist', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        sm: '2px',
        DEFAULT: '4px',
        md: '6px',
        lg: '8px',
        xl: '12px',
        '2xl': '16px',
      },
      boxShadow: {
        'glow-cyan': '0 0 24px rgba(0, 240, 255, 0.18)',
        'glow-green': '0 0 24px rgba(19, 255, 67, 0.18)',
        'glow-agent': '0 0 24px rgba(124, 92, 255, 0.22)',
      },
      spacing: {
        'row-dense': '0.5rem',
        'table-cell': '0.375rem',
      },
    },
  },
  plugins: [],
};

export default config;
