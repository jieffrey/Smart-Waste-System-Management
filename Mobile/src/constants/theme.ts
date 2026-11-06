/**
 * SWMS design tokens for the mobile app: the same system as the web (docs/design-system.md).
 * Light mode only. Colors, category colors, fonts, the type scale and spacing live here; the React Native
 * Paper theme is built from them in src/constants/paper-theme.ts.
 */
import { Platform } from 'react-native';

export const Palette = {
  snow: '#FBFBF8',
  ink: '#121212',
  white: '#FFFFFF',
  signal: '#FF4A1C', // red orange: the primary CTA, the key number, the active state. Never errors.
  highlight: '#E8F23A', // yellow punk: only behind ink text, or on ink
  cobalt: '#2B4BD8',
  gray50: '#F2F2EF',
  gray100: '#E8E8E6',
  gray200: '#D6D6D3',
  gray300: '#BABAB8',
  gray400: '#929291',
  gray500: '#747473',
  gray600: '#5D5D5C', // secondary text (6.36:1 on snow)
  gray700: '#454545',
  gray800: '#2E2E2E',
} as const;

// Category colors, one place (same mapping as web/src/lib/categories.ts).
export const CategoryColors = {
  organic: { fill: Palette.signal, onFill: Palette.ink }, // ink on red orange 5.57:1
  paper: { fill: Palette.ink, onFill: Palette.snow }, // snow on ink 18.07:1
  plastic: { fill: Palette.cobalt, onFill: Palette.white }, // white on cobalt 6.77:1
} as const;

// The app's theme colors (kept under the names the screens already use). Errors are ink, never red.
export const AppColors = {
  ...Palette,
  text: Palette.ink,
  textSecondary: Palette.gray600,
  background: Palette.snow,
  backgroundElement: Palette.gray50,
  backgroundSelected: Palette.gray100,
  border: Palette.ink,
  rule: Palette.gray200,
  primary: Palette.signal,
  onPrimary: Palette.ink,
  danger: Palette.ink,
} as const;

export type ThemeColor = keyof typeof AppColors;

// Font families loaded in the root layout (@expo-google-fonts): Plus Jakarta Sans (designed for Jakarta's city
// identity) and JetBrains Mono. Jakarta tops out at 800, so `black` is an alias for 800 (kept so screens don't
// change). The scale itself uses 400 / 600 / 800, with tighter tracking on the display sizes.
export const FontFamily = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
  black: 'PlusJakartaSans_800ExtraBold',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
  monoSemibold: 'JetBrainsMono_600SemiBold',
} as const;

// The type scale: these 6 sizes only (mobile version of the web scale).
export const Type = {
  display: { fontFamily: FontFamily.extrabold, fontSize: 44, lineHeight: 48, letterSpacing: -1.6 },
  title: { fontFamily: FontFamily.extrabold, fontSize: 28, lineHeight: 34, letterSpacing: -0.8 },
  heading: { fontFamily: FontFamily.semibold, fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
  body: { fontFamily: FontFamily.regular, fontSize: 16, lineHeight: 24 },
  small: { fontFamily: FontFamily.regular, fontSize: 14, lineHeight: 20 },
  micro: { fontFamily: FontFamily.monoMedium, fontSize: 12, lineHeight: 16, letterSpacing: 0.4, textTransform: 'uppercase' },
} as const;

// 4px base.
export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
