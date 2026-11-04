import { FadeIn, FadeInDown, ReduceMotion } from 'react-native-reanimated';

// Short entering animations (Reanimated, already a dependency). ReduceMotion.System follows the phone's
// "reduce motion" setting: with it on, elements simply appear.
export const fadeIn = (delayMs = 0) => FadeIn.duration(220).delay(delayMs).reduceMotion(ReduceMotion.System);
export const riseIn = (delayMs = 0) => FadeInDown.duration(320).delay(delayMs).reduceMotion(ReduceMotion.System);
