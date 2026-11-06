import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { BackHandler, Platform } from 'react-native';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { t } from '@/constants/strings';

// Android: on the screen where the back button would close the app (the first tab's root), ask first.
// Only active while that screen is focused. An open Paper dialog handles the back button itself (it registers
// later, so it runs first), so back inside this dialog simply cancels it.
export function ExitConfirmOnBack() {
  const [visible, setVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return;
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        setVisible(true);
        return true;
      });
      return () => subscription.remove();
    }, [])
  );

  return (
    <ConfirmDialog
      visible={visible}
      title={t.exitApp.title}
      message={t.exitApp.message}
      confirmLabel={t.exitApp.confirm}
      onDismiss={() => setVisible(false)}
      onConfirm={() => {
        setVisible(false);
        BackHandler.exitApp();
      }}
    />
  );
}
