import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        Buffer: 'readonly',
        URLSearchParams: 'readonly',
        AbortSignal: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^(req|res|next|t|_)',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true
        }
      ],
      'no-console': 'off'
    }
  },
  {
    ignores: ['node_modules/', 'coverage/']
  }
];
