export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)', surface: 'var(--surface)', 'surface-elevated': 'var(--surface-elevated)',
        'border-subtle': 'var(--border-subtle)', border: 'var(--border)',
        text: 'var(--text)', 'text-secondary': 'var(--text-secondary)', 'text-muted': 'var(--text-muted)',
        accent: 'var(--accent)', success: 'var(--success)', warning: 'var(--warning)',
        push: 'var(--push)', pull: 'var(--pull)', legs: 'var(--legs)',
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'], mono: ['ui-monospace', 'monospace'] },
    },
  },
  plugins: [],
};
