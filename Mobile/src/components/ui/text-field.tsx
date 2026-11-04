import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FieldMessage } from '@/components/ui/field-message';
import { FontFamily, Palette, Spacing } from '@/constants/theme';

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
}

// Square input, 1px ink border (2px when focused or invalid). Errors are ink text with an icon, never red.
export function TextField({ label, error, multiline, style, onFocus, onBlur, ...inputProps }: TextFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <TextInput
        placeholderTextColor={Palette.gray500}
        multiline={multiline}
        accessibilityLabel={label}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[styles.input, multiline && styles.multiline, (focused || error) && styles.strong, style]}
        {...inputProps}
      />
      {error ? <FieldMessage>{error}</FieldMessage> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.two,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: Palette.ink,
    backgroundColor: Palette.snow,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontFamily: FontFamily.regular,
    fontSize: 16,
    color: Palette.ink,
  },
  strong: {
    borderWidth: 2,
  },
  multiline: {
    minHeight: 112,
    textAlignVertical: 'top',
  },
});
