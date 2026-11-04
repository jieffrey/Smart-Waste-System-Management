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

// Font families loaded in the root layout (@expo-google-fonts). Archivo has no expanded width in that package,
// so display titles use Archivo Black (900) with tight tracking instead.
export const FontFamily = {
  regular: 'Archivo_400Regular',
  medium: 'Archivo_500Medium',
  semibold: 'Archivo_600SemiBold',
  bold: 'Archivo_700Bold',
  extrabold: 'Archivo_800ExtraBold',
  black: 'Archivo_900Black',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
  monoSemibold: 'IBMPlexMono_600SemiBold',
} as const;

// The type scale: these 6 sizes only (mobile version of the web scale).
export const Type = {
  display: { fontFamily: FontFamily.black, fontSize: 44, lineHeight: 46, letterSpacing: -1.5 },
  title: { fontFamily: FontFamily.black, fontSize: 28, lineHeight: 32, letterSpacing: -0.8 },
  heading: { fontFamily: FontFamily.bold, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  body: { fontFamily: FontFamily.regular, fontSize: 16, lineHeight: 24 },
  small: { fontFamily: FontFamily.regular, fontSize: 14, lineHeight: 20 },
  micro: { fontFamily: FontFamily.monoMedium, fontSize: 12, lineHeight: 16, letterSpacing: 0.6, textTransform: 'uppercase' },
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
