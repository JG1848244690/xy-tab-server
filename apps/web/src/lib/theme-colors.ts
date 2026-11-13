/**
 * 站内可选的主题色。
 *
 * 和 components/theme-color-provider.tsx 里的 `theme-*` class 一一对应,
 * 这里的 `color` 只用于设置页 / 下拉里的色块展示。
 */
export const THEME_COLORS = [
  { value: 'zinc', name: '朱砂', color: '#b5342a' },
  { value: 'slate', name: '墨蓝', color: '#24406b' },
  { value: 'rose', name: '胭脂', color: '#a63b52' },
  { value: 'blue', name: '石青', color: '#2f5d9e' },
  { value: 'green', name: '松绿', color: '#2f6b57' },
  { value: 'orange', name: '赭石', color: '#a15c2f' },
  { value: 'purple', name: '黛紫', color: '#6b4e8e' },
] as const

export type ThemeColorName = (typeof THEME_COLORS)[number]['value']
