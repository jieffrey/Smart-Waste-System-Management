import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { STATUS_LABELS } from '@/constants/strings';
import { FontFamily, Palette } from '@/constants/theme';
import type { ReportStatus } from '@/types/api';

// Status has no color (same as the web): a square that fills up as the report moves along, plus the label.
//   Menunggu = empty, Diproses = half filled, Selesai = filled with a check, Ditolak = crossed + struck label.
export function StatusSquare({ status, size = 12 }: { status: ReportStatus; size?: number }) {
  return (
    <View style={[styles.square, { width: size, height: size }, status === 'completed' && styles.filled]}>
      {status === 'in_progress' ? <View style={[styles.half, { height: size / 2 - 1.5 }]} /> : null}
      {status === 'completed' ? <MaterialCommunityIcons name="check-bold" size={size - 4} color={Palette.snow} /> : null}
      {status === 'rejected' ? <MaterialCommunityIcons name="close-thick" size={size - 3} color={Palette.ink} /> : null}
    </View>
  );
}

export function StatusMarker({ status, size = 'small' }: { status: ReportStatus; size?: 'small' | 'large' }) {
  const large = size === 'large';
  return (
    <View style={styles.row} accessible accessibilityLabel={`Status: ${STATUS_LABELS[status]}`}>
      <StatusSquare status={status} size={large ? 22 : 12} />
      <Text
        style={[
          large ? styles.largeText : styles.smallText,
          status === 'rejected' && styles.struck,
        ]}>
        {STATUS_LABELS[status]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  square: {
    borderWidth: 1.5,
    borderColor: Palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  filled: {
    backgroundColor: Palette.ink,
  },
  half: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Palette.ink,
  },
  smallText: {
    fontFamily: FontFamily.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: Palette.ink,
  },
  largeText: {
    fontFamily: FontFamily.black,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.8,
    color: Palette.ink,
  },
  struck: {
    textDecorationLine: 'line-through',
  },
});
