import { useTheme } from '../contexts/ThemeContext'

/**
 * Returns the current theme's resolved color values as plain hex strings.
 * Use this when you need actual color values (not CSS variables) — for example
 * when passing `fill` props to Recharts SVG elements, which do not support
 * CSS custom properties in SVG presentation attributes.
 *
 * Re-renders whenever the active theme changes.
 *
 * @example
 * const { accentGreen, accentRed } = useThemeColors()
 * <Bar dataKey="Ingresos" fill={accentGreen} />
 */
export function useThemeColors() {
  return useTheme().colors
}

/**
 * Append a two-digit hex alpha suffix to a 6-digit hex color string.
 * Useful for creating semi-transparent background tints that follow the theme.
 *
 * @param hex   A 6-digit hex color like '#22c55e'
 * @param alpha Opacity between 0 and 1
 */
export function hexAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
  return `${hex}${a.toString(16).padStart(2, '0')}`
}
