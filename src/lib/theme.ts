import type { ThemeTokens } from '../../site.config';

const TOKEN_MAP: Record<keyof ThemeTokens, string> = {
  bg: '--bg',
  surface: '--surface',
  surface2: '--surface-2',
  line: '--line',
  ink: '--ink',
  inkMuted: '--ink-muted',
  accent: '--accent',
  accentHover: '--accent-hover',
  accentInk: '--accent-ink',
  highlight: '--highlight',
  success: '--success',
  danger: '--danger',
};

/** Преобразует токены тенанта в inline CSS-переменные для :root */
export function themeToStyle(theme: ThemeTokens): Record<string, string> {
  const style: Record<string, string> = {};
  for (const [key, cssVar] of Object.entries(TOKEN_MAP)) {
    style[cssVar] = theme[key as keyof ThemeTokens];
  }
  return style;
}
