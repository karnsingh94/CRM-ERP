import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextVitals,
  {
    files: ['src/**/*.{js,jsx}'],
    rules: {
      // Preserve the existing client-side UI behavior while the project moves to
      // Next 16. These compiler-oriented rules can be enabled incrementally.
      'react-hooks/globals': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files: ['src/hooks/useCompanyAuth.js'],
    rules: {
      // This compatibility hook delegates to context when the unified provider
      // is present, and otherwise runs the legacy standalone implementation.
      'react-hooks/rules-of-hooks': 'off',
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
]);
