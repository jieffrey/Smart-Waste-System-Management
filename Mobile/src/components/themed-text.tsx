import { StyleSheet, Text, type TextProps } from 'react-native';

import { FontFamily, Type, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Text in the type scale (src/constants/theme.ts). Older type names map onto the new scale.
export type ThemedTextProps = TextProps & {
  type?:
    | 'display'
    | 'title'
    | 'heading'
    | 'default'
    | 'small'
    | 'smallBold'
    | 'micro'
    | 'mono'
    | 'subtitle'
    | 'link'
    | 'linkPrimary'
    | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  return <Text style={[{ color: theme[themeColor ?? 'text'] }, styles[type], style]} {...rest} />;
}

const styles = StyleSheet.create({
  display: Type.display,
  title: Type.title,
  subtitle: Type.title,
  heading: Type.heading,
  default: Type.body,
  small: Type.small,
  smallBold: { ...Type.small, fontFamily: FontFamily.semibold },
  micro: Type.micro,
  mono: { ...Type.small, fontFamily: FontFamily.mono },
  code: { ...Type.small, fontFamily: FontFamily.mono },
  link: { ...Type.small, fontFamily: FontFamily.semibold, textDecorationLine: 'underline' },
  linkPrimary: { ...Type.small, fontFamily: FontFamily.semibold, textDecorationLine: 'underline' },
});
