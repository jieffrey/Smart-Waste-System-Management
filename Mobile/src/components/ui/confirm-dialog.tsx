import { StyleSheet, View } from 'react-native';
import { Dialog, Portal } from 'react-native-paper';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { t } from '@/constants/strings';
import { Palette, Spacing } from '@/constants/theme';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onDismiss: () => void;
  children?: React.ReactNode;
  hideActions?: boolean;
}

// Paper's Dialog, restyled: square, 2px ink frame, no elevation, sentence-case actions (our Button), no
// uppercase Material text buttons.
export function ConfirmDialog({ visible, title, message, confirmLabel, onConfirm, onDismiss, children, hideActions }: ConfirmDialogProps) {
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <View style={styles.body}>
          <ThemedText type="heading">{title}</ThemedText>
          {message ? <ThemedText themeColor="textSecondary">{message}</ThemedText> : null}
          {children}
          {hideActions ? null : (
            <View style={styles.actions}>
              <Button title={confirmLabel} onPress={onConfirm} variant="ink" />
              <Button title={t.common.cancel} onPress={onDismiss} variant="text" style={styles.cancel} />
            </View>
          )}
        </View>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: {
    backgroundColor: Palette.snow,
    borderRadius: 0,
    borderWidth: 2,
    borderColor: Palette.ink,
    elevation: 0,
    shadowOpacity: 0,
  },
  body: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  actions: {
    marginTop: Spacing.three,
    gap: Spacing.one,
  },
  cancel: {
    alignSelf: 'center',
  },
});
