import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { IconButton } from 'react-native-paper';

import { ThemedText } from '@/components/themed-text';
import { FieldMessage } from '@/components/ui/field-message';
import { t } from '@/constants/strings';
import { FontFamily, Palette, Spacing } from '@/constants/theme';

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
}

// Square input, 1px ink border (2px when focused or invalid). Errors are ink text with an icon, never red.
// A password field (`secureTextEntry`) gets an eye / eye-off toggle on the right (Paper IconButton, 44x44 touch
// target). Each field has its own state and starts hidden whenever the screen mounts.
export function TextField({ label, error, multiline, style, onFocus, onBlur, secureTextEntry, ...inputProps }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const toggleLabel = revealed ? t.common.hidePassword : t.common.showPassword;

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <View>
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
          style={[styles.input, multiline && styles.multiline, secureTextEntry && styles.withToggle, (focused || error) && styles.strong, style]}
          {...inputProps}
          secureTextEntry={secureTextEntry && !revealed}
        />
        {secureTextEntry ? (
          <IconButton
            icon={revealed ? 'eye-off' : 'eye'}
            iconColor={Palette.gray700}
            size={22}
            onPress={() => setRevealed((current) => !current)}
            accessibilityLabel={toggleLabel}
            accessibilityState={{ checked: revealed }}
            style={styles.toggle}
          />
        ) : null}
      </View>
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
  withToggle: {
    paddingRight: 52,
  },
  toggle: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 48,
    height: 48,
    margin: 0,
    borderRadius: 0,
  },
  multiline: {
    minHeight: 112,
    textAlignVertical: 'top',
  },
});
