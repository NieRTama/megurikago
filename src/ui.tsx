import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { photoUri, smooth } from './store';
import { addDays, parseDateInput, type Item, type Tag } from './logic';

// 藍と真鍮。うす墨の地に白い面、色は「主色」と「もうすぐ」の2つだけ
export const C = {
  bg: '#EDEFF2',
  card: '#FFFFFF',
  ink: '#1E2733',
  sub: '#6B7480',
  line: '#DCE0E6',
  main: '#2C4A63',
  mainSoft: '#E1E7EE',
  soon: '#A9812F',
  soonSoft: '#F3ECDD',
  danger: '#B04A4A',
};

export { smooth };

/** 押したときに少し沈ませる */
export const press = ({ pressed }: { pressed: boolean }) => pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] };

/** めぐりの線: 前回の購入から次回までの経過。近づくと真鍮色で満ちる */
export function RhythmBar({ progress, soon }: { progress: number; soon: boolean }) {
  const p = Math.min(1, Math.max(0, progress));
  return (
    <View style={{ height: 3, borderRadius: 2, backgroundColor: C.line, overflow: 'hidden', alignSelf: 'stretch' }}>
      <View style={{ width: `${p * 100}%`, height: 3, backgroundColor: soon ? C.soon : C.main }} />
    </View>
  );
}

export function Chip({ label, on, onPress }: { label: string; on?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={() => (smooth(), onPress())} style={(st) => [s.chip, on && s.chipOn, press(st)]} accessibilityRole="button" accessibilityState={{ selected: on }}>
      <Text style={[s.chipText, on && s.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

/** 購入先タグの横スクロール。value=undefined は「すべて」/「指定なし」 */
export function TagBar({
  tags,
  value,
  onChange,
  allLabel,
  style,
}: {
  tags: Tag[];
  value?: string;
  onChange: (id?: string) => void;
  allLabel: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={style} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
      <Chip label={allLabel} on={!value} onPress={() => onChange(undefined)} />
      {tags.map((t) => (
        <Chip key={t.id} label={t.name} on={value === t.id} onPress={() => onChange(value === t.id ? undefined : t.id)} />
      ))}
    </ScrollView>
  );
}

/** 写真、なければ頭文字の丸 */
export function Thumb({ item, name, size }: { item?: Item; name: string; size: number }) {
  const style = { width: size, height: size, borderRadius: size * 0.28 };
  if (item?.photo) return <Image source={{ uri: photoUri(item.photo) }} style={style} />;
  return (
    <View style={[style, s.initial]}>
      <Text style={{ fontSize: size * 0.4, color: C.main, fontWeight: '300' }}>{name.slice(0, 1)}</Text>
    </View>
  );
}

export function Button({ label, onPress, kind = 'main', disabled }: { label: string; onPress: () => void; kind?: 'main' | 'ghost' | 'danger'; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={(st) => [s.btn, kind === 'main' ? s.btnMain : s.btnGhost, press(st), disabled && { opacity: 0.4 }]}>
      <Text style={[s.btnText, { color: kind === 'main' ? '#fff' : kind === 'danger' ? C.danger : C.main }]}>{label}</Text>
    </Pressable>
  );
}

/** 「いつ買いましたか？」今日 / きのう / 日付を入力（Alert.prompt は iOS のみ。iPhone 専用なので可） */
export function askDate(title: string, todayStr: string, onPick: (date: string) => void) {
  Alert.alert(title, undefined, [
    { text: '今日', onPress: () => onPick(todayStr) },
    { text: 'きのう', onPress: () => onPick(addDays(todayStr, -1)) },
    {
      text: '日付を入力…',
      onPress: () =>
        Alert.prompt('日付を入力', '例: 11/2', (v) => {
          const d = parseDateInput(v, todayStr);
          if (!d || d > todayStr) Alert.alert('日付が読めませんでした', '「11/2」のように、今日までの日付を入れてください。');
          else onPick(d);
        }),
    },
    { text: 'やめる', style: 'cancel' },
  ]);
}

export const tagName = (tags: Tag[], id?: string) => tags.find((t) => t.id === id)?.name;

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  title: { fontSize: 32, fontWeight: '700', letterSpacing: -0.8, color: C.ink, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14 },
  h2: { fontSize: 13, fontWeight: '600', letterSpacing: 0.4, color: C.sub, paddingHorizontal: 20, marginTop: 26, marginBottom: 8 },
  // 一覧は iOS の設定画面のような「まとまり」。角丸は面ごとに変える（まとまり 16 / 入力 12 / タグ 丸）
  card: { backgroundColor: C.card, borderRadius: 16, marginHorizontal: 16, paddingHorizontal: 16, paddingVertical: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  text: { fontSize: 16, color: C.ink, letterSpacing: 0.1 },
  small: { fontSize: 13, color: C.sub, lineHeight: 19 },
  num: { fontVariant: ['tabular-nums'] },
  input: { backgroundColor: C.card, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: C.ink },
  chip: { paddingHorizontal: 15, paddingVertical: 7, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: C.card },
  chipOn: { backgroundColor: C.ink, borderColor: C.ink },
  chipText: { fontSize: 14, color: C.ink },
  chipTextOn: { color: '#fff', fontWeight: '600' },
  initial: { backgroundColor: C.mainSoft, alignItems: 'center', justifyContent: 'center' },
  btn: { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center' },
  btnMain: { backgroundColor: C.main },
  btnGhost: { backgroundColor: C.card, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  btnText: { fontSize: 16, fontWeight: '600', letterSpacing: 0.2 },
  link: { color: C.main, fontSize: 15, fontWeight: '600' },
});
