import js from '@eslint/js'
import typescript from '@typescript-eslint/eslint-plugin'
import typescriptParser from '@typescript-eslint/parser'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import prettier from 'eslint-plugin-prettier'
import prettierConfig from 'eslint-config-prettier'

export default [
  // 忽略的文件
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'dist/**',
      '*.config.js',
      '*.config.mjs',
      '*.config.ts',
    ],
  },

  // 基础配置
  js.configs.recommended,

  // 所有文件的通用配置
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      parser: typescriptParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        prompt: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        FormData: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        FileReader: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        Worker: 'readonly',
        // DOM types
        HTMLElement: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLVideoElement: 'readonly',
        Element: 'readonly',
        Node: 'readonly',
        Event: 'readonly',
        MouseEvent: 'readonly',
        KeyboardEvent: 'readonly',
        MessageEvent: 'readonly',
        // Node.js globals
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
        NodeJS: 'readonly',
        // Web Workers
        self: 'readonly',
        crypto: 'readonly',
        // Additional DOM types
        HTMLButtonElement: 'readonly',
        // ES2021+
        Promise: 'readonly',
        Set: 'readonly',
        Map: 'readonly',
        WeakMap: 'readonly',
        WeakSet: 'readonly',
        Symbol: 'readonly',
        BigInt: 'readonly',
        // React (for JSX)
        React: 'readonly',
        JSX: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      react: react,
      'react-hooks': reactHooks,
      prettier: prettier,
    },
    rules: {
      // Prettier 集成
      'prettier/prettier': 'warn',

      // React 规则
      'react/react-in-jsx-scope': 'off', // Next.js 不需要导入 React
      'react/prop-types': 'off', // 使用 TypeScript

      // TypeScript 规则
      '@typescript-eslint/no-unused-vars': 'off', // 完全关闭未使用变量检查
      '@typescript-eslint/no-explicit-any': 'off', // 允许使用 any 类型
      '@typescript-eslint/explicit-module-boundary-types': 'off',

      // 通用规则
      // 'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'warn',
      'no-var': 'error',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },

  // TypeScript 特定配置
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      ...typescript.configs.recommended.rules,
      // 覆盖 TypeScript 推荐配置中的规则
      '@typescript-eslint/no-explicit-any': 'off', // 允许使用 any 类型
      '@typescript-eslint/no-unused-vars': 'off', // 允许未使用的变量
    },
  },

  // React Hooks 规则
  {
    files: ['**/*.{jsx,tsx}'],
    rules: {
      ...reactHooks.configs.recommended.rules,
      // 关闭严格的 React Hooks 规则
      'react-hooks/exhaustive-deps': 'warn', // 依赖检查改为警告
      'react-hooks/rules-of-hooks': 'warn', // Hooks 调用规则改为警告
      'react-hooks/set-state-in-effect': 'off', // 允许在 effect 中设置状态
      'react-hooks/purity': 'off', // 允许在 render 中调用不纯函数
      'react-hooks/incompatible-library': 'off', // 允许使用不兼容的库
    },
  },

  // Prettier 配置（必须放在最后）
  prettierConfig,
]
