import { configureFonts, MD3LightTheme, type MD3Theme } from 'react-native-paper';

import { FontFamily, Palette } from './theme';

// React Native Paper, re-themed so it no longer looks like stock Material Design: our palette, square corners,
// no elevation tint, Plus Jakarta Sans / JetBrains Mono everywhere (wired through configureFonts). Light only.

const family = (fontFamily: string) => ({ fontFamily, fontWeight: 'normal' as const, letterSpacing: 0 });

const fonts = configureFonts({
  config: {
    displayLarge: { ...family(FontFamily.extrabold), fontSize: 44, lineHeight: 48, letterSpacing: -1.6 },
    displayMedium: { ...family(FontFamily.extrabold), fontSize: 36, lineHeight: 42, letterSpacing: -1.2 },
    displaySmall: { ...family(FontFamily.extrabold), fontSize: 28, lineHeight: 34, letterSpacing: -0.8 },
    headlineLarge: { ...family(FontFamily.extrabold), fontSize: 28, lineHeight: 34, letterSpacing: -0.8 },
    headlineMedium: { ...family(FontFamily.extrabold), fontSize: 24, lineHeight: 28 },
    headlineSmall: { ...family(FontFamily.semibold), fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
    titleLarge: { ...family(FontFamily.semibold), fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
    titleMedium: { ...family(FontFamily.semibold), fontSize: 16, lineHeight: 24 },
    titleSmall: { ...family(FontFamily.semibold), fontSize: 14, lineHeight: 20 },
    labelLarge: { ...family(FontFamily.semibold), fontSize: 14, lineHeight: 20 },
    labelMedium: { ...family(FontFamily.monoMedium), fontSize: 12, lineHeight: 16, letterSpacing: 0.4 },
    labelSmall: { ...family(FontFamily.monoMedium), fontSize: 12, lineHeight: 16, letterSpacing: 0.4 },
    bodyLarge: { ...family(FontFamily.regular), fontSize: 16, lineHeight: 24 },
    bodyMedium: { ...family(FontFamily.regular), fontSize: 14, lineHeight: 20 },
    bodySmall: { ...family(FontFamily.regular), fontSize: 14, lineHeight: 20 },
  },
});

// Every elevation level is plain snow: no shadows, no tinted surfaces.
const flat = {
  level0: 'transparent',
  level1: Palette.snow,
  level2: Palette.snow,
  level3: Palette.snow,
  level4: Palette.snow,
  level5: Palette.snow,
};

export const paperTheme: MD3Theme = {
  ...MD3LightTheme,
  dark: false,
  roundness: 0,
  fonts,
  colors: {
    ...MD3LightTheme.colors,
    primary: Palette.signal,
    onPrimary: Palette.ink,
    primaryContainer: Palette.highlight,
    onPrimaryContainer: Palette.ink,
    secondary: Palette.ink,
    onSecondary: Palette.snow,
    secondaryContainer: Palette.highlight, // selected state: ink on yellow
    onSecondaryContainer: Palette.ink,
    tertiary: Palette.cobalt,
    onTertiary: Palette.white,
    tertiaryContainer: Palette.gray100,
    onTertiaryContainer: Palette.ink,
    background: Palette.snow,
    onBackground: Palette.ink,
    surface: Palette.snow,
    onSurface: Palette.ink,
    surfaceVariant: Palette.gray100,
    onSurfaceVariant: Palette.gray600,
    outline: Palette.ink,
    outlineVariant: Palette.gray200,
    error: Palette.ink, // errors are ink + icon, never red
    onError: Palette.snow,
    errorContainer: Palette.gray100,
    onErrorContainer: Palette.ink,
    inverseSurface: Palette.ink,
    inverseOnSurface: Palette.snow,
    inversePrimary: Palette.signal,
    shadow: 'transparent',
    scrim: 'rgba(18, 18, 18, 0.5)',
    backdrop: 'rgba(18, 18, 18, 0.45)',
    surfaceDisabled: Palette.gray100,
    onSurfaceDisabled: Palette.gray600,
    elevation: flat,
  },
};
