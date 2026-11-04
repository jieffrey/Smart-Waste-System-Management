import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { StatusSquare } from '@/components/ui/status-marker';
import { STATUS_LABELS, t } from '@/constants/strings';
import { FontFamily, Palette, Spacing } from '@/constants/theme';
import type { ReportStatus } from '@/types/api';

const OPTIONS: (ReportStatus | undefined)[] = [undefined, 'pending', 'in_progress', 'completed', 'rejected'];

interface StatusFilterProps {
  value: ReportStatus | undefined;
  onChange: (value: ReportStatus | undefined) => void;
}

// One compact control that always fits the screen width (360dp included): "Status · Semua ▾".
// Tapping it opens a short list of statuses in the restyled dialog.
export function StatusFilter({ value, onChange }: StatusFilterProps) {
  const [open, setOpen] = useState(false);
  const current = value ? STATUS_LABELS[value] : t.filter.all;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t.filter.label}: ${current}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}>
        <Text style={styles.label}>{t.filter.label}</Text>
        <Text style={styles.value} numberOfLines={1}>
          {current}
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={20} color={Palette.ink} />
      </Pressable>

      <ConfirmDialog
        visible={open}
        title={t.filter.dialogTitle}
        confirmLabel=""
        onConfirm={() => setOpen(false)}
        onDismiss={() => setOpen(false)}
        hideActions>
        <View style={styles.options}>
          {OPTIONS.map((option) => {
            const selected = option === value;
            return (
              <Pressable
                key={option ?? 'all'}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => {
                  setOpen(false);
                  onChange(option);
                }}
                style={({ pressed }) => [styles.option, selected && styles.selected, pressed && styles.pressed]}>
                {option ? <StatusSquare status={option} /> : <View style={styles.allSquare} />}
                <Text style={[styles.optionText, selected && styles.optionSelected]}>
                  {option ? STATUS_LABELS[option] : t.filter.all}
                </Text>
                {selected ? <MaterialCommunityIcons name="check" size={18} color={Palette.ink} /> : null}
              </Pressable>
            );
          })}
        </View>
      </ConfirmDialog>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: Palette.ink,
    backgroundColor: Palette.snow,
  },
  label: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Palette.gray600,
  },
  value: {
    flex: 1,
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: Palette.ink,
  },
  pressed: {
    backgroundColor: Palette.gray50,
  },
  options: {
    marginTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: Palette.gray200,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 48,
    paddingHorizontal: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: Palette.gray200,
  },
  selected: {
    backgroundColor: Palette.highlight, // ink on yellow, 15.34:1
  },
  allSquare: {
    width: 12,
    height: 12,
    borderWidth: 1.5,
    borderColor: Palette.ink,
    borderStyle: 'dashed',
  },
  optionText: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: 16,
    color: Palette.ink,
  },
  optionSelected: {
    fontFamily: FontFamily.bold,
  },
});
