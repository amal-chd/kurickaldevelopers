module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  plugins: ['react-hooks', 'react-refresh', 'unused-imports'],
  ignorePatterns: ['dist', 'node_modules', 'api', '.eslintrc.cjs', 'vite.config.ts', 'tailwind.config.js', 'postcss.config.js'],
  rules: {
    // Real-bug rules
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'no-constant-condition': 'error',
    'no-unreachable': 'error',
    'no-dupe-keys': 'error',
    'no-self-assign': 'error',
    // unused-imports auto-removes dead imports on --fix; its no-unused-vars
    // replaces the TS one (which cannot auto-fix).
    'unused-imports/no-unused-imports': 'warn',
    'unused-imports/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
    '@typescript-eslint/no-unused-vars': 'off',
    // Relax stylistic / non-bug rules
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',
    'no-empty': 'off',
  },
};
