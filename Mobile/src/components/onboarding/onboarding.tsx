import { useRef, useState, type ComponentRef } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SortComposition, SpotComposition, TrackComposition } from '@/components/onboarding/compositions';
import { t } from '@/constants/strings';
import { FontFamily, Palette, Spacing } from '@/constants/theme';

// First-launch onboarding: three swipeable, full-color slides with their own animated sticker composition,
// chunky progress segments, "Lewati" to skip and a big "Mulai lapor" at the end.
// Each slide's colors (ink text on yellow / white on cobalt / ink on snow) keep at least 6.7:1.
const SLIDES = [
  { background: Palette.highlight, text: Palette.ink, muted: 'rgba(18, 18, 18, 0.72)', Composition: SpotComposition },
  { background: Palette.cobalt, text: Palette.white, muted: 'rgba(255, 255, 255, 0.85)', Composition: SortComposition },
  { background: Palette.snow, text: Palette.ink, muted: Palette.gray700, Composition: TrackComposition },
] as const;

export function Onboarding({ onDone, onStart }: { onDone: () => void; onStart: () => void }) {
  const { width } = useWindowDimensions();
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const [index, setIndex] = useState(0);
  const last = SLIDES.length - 1;

  function onScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  }

  function goTo(next: number) {
    scroller.current?.scrollTo({ x: next * width, animated: true });
    setIndex(next);
  }

  return (
    <Animated.View entering={FadeIn.duration(200).reduceMotion(ReduceMotion.System)} style={styles.root}>
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        accessibilityRole="adjustable">
        {SLIDES.map((slide, slideIndex) => {
          const copy = t.onboarding.slides[slideIndex];
          const isLast = slideIndex === last;
          return (
            <View key={copy.kicker} style={[styles.slide, { width, backgroundColor: slide.background }]}>
              <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
                <View style={styles.topRow}>
                  <View style={styles.segments} accessible accessibilityLabel={t.onboarding.progress(slideIndex + 1, SLIDES.length)}>
                    {SLIDES.map((_, segment) => (
                      <View
                        key={segment}
                        style={[styles.segment, { borderColor: slide.text }, segment <= slideIndex && { backgroundColor: slide.text }]}
                      />
                    ))}
                  </View>
                  {!isLast ? (
                    <Pressable accessibilityRole="button" onPress={onDone} hitSlop={12} style={({ pressed }) => pressed && styles.pressed}>
                      <Text style={[styles.skip, { color: slide.text }]}>{t.onboarding.skip}</Text>
                    </Pressable>
                  ) : (
                    <View />
                  )}
                </View>

                <slide.Composition active={index === slideIndex} />

                <View style={styles.copy}>
                  <Text style={[styles.kicker, { color: slide.muted }]}>{copy.kicker}</Text>
                  <Text style={[styles.title, { color: slide.text }]} accessibilityRole="header">
                    {copy.title}
                  </Text>
                  <Text style={[styles.body, { color: slide.muted }]}>{copy.body}</Text>
                </View>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => (isLast ? onStart() : goTo(slideIndex + 1))}
                  style={({ pressed }) => [
                    styles.cta,
                    isLast ? styles.ctaFinal : { backgroundColor: slide.text, borderColor: slide.text },
                    pressed && styles.pressed,
                  ]}>
                  <Text style={[styles.ctaLabel, isLast ? styles.ctaFinalLabel : { color: slide.background }]}>
                    {isLast ? t.onboarding.start : t.onboarding.next}
                  </Text>
                </Pressable>
              </SafeAreaView>
            </View>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 10,
    backgroundColor: Palette.snow,
  },
  slide: {
    flex: 1,
  },
  safe: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.three,
    gap: Spacing.three,
  },
  segments: {
    flexDirection: 'row',
    gap: 6,
  },
  segment: {
    width: 34,
    height: 12,
    borderRadius: 6,
    borderWidth: 2.5,
  },
  skip: {
    fontFamily: FontFamily.extrabold,
    fontSize: 16,
    lineHeight: 22,
    textDecorationLine: 'underline',
  },
  copy: {
    gap: Spacing.two,
  },
  kicker: {
    fontFamily: FontFamily.monoSemibold,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: FontFamily.extrabold,
    fontSize: 50,
    lineHeight: 52,
    letterSpacing: -2.2,
  },
  body: {
    fontFamily: FontFamily.semibold,
    fontSize: 17,
    lineHeight: 25,
  },
  cta: {
    minHeight: 60,
    borderRadius: 30,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaFinal: {
    minHeight: 68,
    borderRadius: 34,
    backgroundColor: Palette.signal,
    borderColor: Palette.ink,
  },
  ctaLabel: {
    fontFamily: FontFamily.extrabold,
    fontSize: 18,
    lineHeight: 24,
  },
  ctaFinalLabel: {
    fontSize: 22,
    lineHeight: 28,
    color: Palette.ink, // ink on red orange: 5.57:1
  },
  pressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
});
