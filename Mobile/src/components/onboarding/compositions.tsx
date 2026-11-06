import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { Sticker, StickerText } from '@/components/onboarding/stickers';
import { StatusMarker } from '@/components/ui/status-marker';
import { CATEGORY_LABELS, t } from '@/constants/strings';
import { CategoryColors, Palette } from '@/constants/theme';

// One animated composition per onboarding slide (290px tall, drawn inside the slide's padding).
export const COMPOSITION_HEIGHT = 290;

// 01 · Lihat: a camera viewfinder snaps around a pile of category shapes, then a "cekrek!" sticker pops on top.
export function SpotComposition({ active }: { active: boolean }) {
  return (
    <View style={styles.box}>
      <Corner active={active} style={{ top: 8, left: 8 }} rotate={0} />
      <Corner active={active} style={{ top: 8, right: 8 }} rotate={90} />
      <Corner active={active} style={{ bottom: 8, right: 8 }} rotate={180} />
      <Corner active={active} style={{ bottom: 8, left: 8 }} rotate={270} />

      <Sticker active={active} delay={180} drift rotate={-12} width={96} height={96} radius={48} color={CategoryColors.organic.fill} style={{ position: 'absolute', left: '16%', top: 92 }} />
      <Sticker active={active} delay={300} drift rotate={14} width={84} height={84} radius={10} color={CategoryColors.plastic.fill} style={{ position: 'absolute', left: '44%', top: 128 }} />
      <Sticker active={active} delay={420} drift rotate={-4} width={120} height={46} radius={23} color={Palette.snow} style={{ position: 'absolute', right: '10%', top: 70 }}>
        <MaterialCommunityIcons name="camera" size={24} color={Palette.ink} />
      </Sticker>
      <Sticker active={active} delay={700} rotate={-9} width={150} height={60} radius={16} color={Palette.snow} style={{ position: 'absolute', left: '30%', top: 24 }}>
        <StickerText size={24}>{t.onboarding.stickers.snap}</StickerText>
      </Sticker>
    </View>
  );
}

function Corner({ active, style, rotate }: { active: boolean; style: object; rotate: number }) {
  return (
    <Sticker bare active={active} rotate={rotate} width={46} height={46} color="transparent" style={[{ position: 'absolute' }, style]}>
      <View style={styles.corner} />
    </Sticker>
  );
}

// 02 · Pilah: three category stickers snap in from the sides and land in their own row; an "AI" badge spins in.
export function SortComposition({ active }: { active: boolean }) {
  const rows = [
    { category: 'organic' as const, motion: 'snapLeft' as const, radius: 28, text: Palette.ink },
    { category: 'paper' as const, motion: 'snapRight' as const, radius: 6, text: Palette.snow },
    { category: 'plastic' as const, motion: 'snapLeft' as const, radius: 28, text: Palette.white },
  ];
  return (
    <View style={styles.box}>
      <Sticker active={active} delay={60} rotate={10} width={84} height={84} radius={42} color={Palette.highlight} style={{ position: 'absolute', right: 6, top: 0, zIndex: 2 }}>
        <StickerText size={30}>{t.onboarding.stickers.ai}</StickerText>
      </Sticker>
      <View style={styles.sortRows}>
        {rows.map((row, index) => (
          <Sticker
            key={row.category}
            active={active}
            motion={row.motion}
            delay={260 + index * 170}
            rotate={index === 1 ? 3 : -3}
            width={index === 1 ? 210 : 190}
            height={64}
            radius={row.radius}
            color={CategoryColors[row.category].fill}
            style={{ alignSelf: index === 1 ? 'flex-end' : 'flex-start' }}>
            <StickerText size={24} color={row.text}>
              {CATEGORY_LABELS[row.category]}
            </StickerText>
          </Sticker>
        ))}
      </View>
    </View>
  );
}

// 03 · Beres: the three status steps stamp in one after another, then a big "beres!" sticker drops and floats.
export function TrackComposition({ active }: { active: boolean }) {
  const steps = ['pending', 'in_progress', 'completed'] as const;
  return (
    <View style={styles.box}>
      <View style={styles.trackRows}>
        {steps.map((status, index) => (
          <Sticker
            key={status}
            active={active}
            motion="pop"
            delay={120 + index * 220}
            rotate={index % 2 === 0 ? -2 : 2}
            width={200}
            height={54}
            radius={12}
            color={Palette.snow}
            style={{ marginLeft: index * 22 }}>
            <StatusMarker status={status} />
          </Sticker>
        ))}
      </View>
      <Sticker active={active} motion="drop" delay={820} drift rotate={-10} width={150} height={150} radius={75} color={Palette.signal} style={{ position: 'absolute', right: 4, bottom: 6 }}>
        <StickerText size={34}>{t.onboarding.stickers.done}</StickerText>
      </Sticker>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    height: COMPOSITION_HEIGHT,
    width: '100%',
  },
  // A corner of the viewfinder: an ink L with a rounded outer corner.
  corner: {
    flex: 1,
    borderTopWidth: 7,
    borderLeftWidth: 7,
    borderColor: Palette.ink,
    borderTopLeftRadius: 14,
  },
  sortRows: {
    flex: 1,
    justifyContent: 'center',
    gap: 14,
    paddingTop: 40,
  },
  trackRows: {
    gap: 14,
    paddingTop: 10,
  },
});
