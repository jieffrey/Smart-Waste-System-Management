import { AppColors } from '@/constants/theme';

// The app is light-only: it looks the same whatever the phone's dark-mode setting is.
export function useTheme() {
  return AppColors;
}
