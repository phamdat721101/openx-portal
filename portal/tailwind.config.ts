import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // OpenX Dynamic Core Tokens (Backed by CSS Variables)
        background: 'var(--background)',
        surface: 'var(--surface)',
        'surface-container-lowest': 'var(--surface-container-lowest)',
        'surface-container-low': 'var(--surface-container-low)',
        'surface-container': 'var(--surface-container)',
        'surface-container-high': 'var(--surface-container-high)',
        'surface-container-highest': 'var(--surface-container-highest)',
        primary: 'var(--primary)',
        'primary-container': 'var(--primary-container)',
        'on-primary': 'var(--on-primary)',
        'primary-text': 'var(--primary-text)',
        secondary: 'var(--secondary)',
        'secondary-container': 'var(--secondary-container)',
        'on-secondary': 'var(--on-secondary)',
        tertiary: 'var(--tertiary)',
        error: 'var(--error)',
        'on-surface': 'var(--on-surface)',
        'on-surface-variant': 'var(--on-surface-variant)',
        outline: 'var(--outline)',
        'outline-variant': 'var(--outline-variant)',

        // Dedicated Subproject Accent (Violet Nav Chrome & Distinct Identity)
        'agent-accent': 'var(--agent-accent)',
        'on-agent-accent': 'var(--on-agent-accent)',
        'agent-accent-dim': 'var(--agent-accent-dim)',
        'agent-accent-glow': 'var(--agent-accent-glow)',
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
