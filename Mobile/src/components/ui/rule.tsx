import { View } from 'react-native';

import { Palette } from '@/constants/theme';

// Rules instead of cards: `strong` = 2px ink (top of a major region), default = 1px ink, `faint` = 1px gray-200
// (between list rows).
export function Rule({ weight = 'default' }: { weight?: 'strong' | 'default' | 'faint' }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{
        height: weight === 'strong' ? 2 : 1,
        backgroundColor: weight === 'faint' ? Palette.gray200 : Palette.ink,
      }}
    />
  );
}
