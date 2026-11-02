import * as Notifications from 'expo-notifications';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Share, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { newId, type Settings, type State } from '../../logic';
import { useStore } from '../../store';
import { C, s } from '../../ui';

export default function Me() {
  const { state, update } = useStore();
  const [allowed, setAllowed] = useState(true);
  const st = state.settings;
  const setS = (patch: Partial<Settings>) => update((x) => ({ ...x, settings: { ...x.settings, ...patch } }));

  useFocusEffect(
    useCallback(() => {
      Notifications.getPermissionsAsync().then((p) => setAllowed(p.granted || p.canAskAgain));
    }, []),
  );

  const moveTag = (i: number, d: number) =>
    update((x) => {
      const tags = [...x.tags];
      [tags[i], tags[i + d]] = [tags[i + d], tags[i]];
      return { ...x, tags };
    });

  const importJson = () =>
    Alert.prompt('バックアップを読み込む', '書き出した文字をそのまま貼り付けてください。いまのデータは置き換わります。', (text) => {
      try {
        const data = JSON.parse(text) as State;
        if (data.version !== 1 || ![data.items, data.list, data.purchases, data.tags].every(Array.isArray)) throw new Error('形式が違います');
        update(() => data);
        Alert.alert('読み込みました', '写真はバックアップに含まれないため、必要なら撮り直してください。');
      } catch (e) {
        Alert.alert('読み込めませんでした', String(e));
      }
    });

  return (
    <SafeAreaView edges={['top']} style={s.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} automaticallyAdjustKeyboardInsets>
        <Text style={s.title}>わたし</Text>

        {st.notify && !allowed && (
          <Pressable onPress={() => Linking.openSettings()} style={[s.card, { backgroundColor: C.soonSoft, gap: 4 }]}>
            <Text style={[s.text, { fontWeight: '700' }]}>通知がオフになっています</Text>
            <Text style={s.small}>買う時期のお知らせを受け取るには、設定アプリで通知を許可してください ›</Text>
          </Pressable>
        )}

        <Link href="/history" asChild>
          <Pressable style={[s.card, s.row, { marginTop: 12 }]}>
            <Text style={[s.text, { flex: 1 }]}>購入履歴</Text>
            <Text style={s.small}>{state.purchases.length}件 ›</Text>
          </Pressable>
        </Link>

        <Text style={s.h2}>お知らせ</Text>
        <View style={[s.card, { gap: 14 }]}>
          <View style={s.row}>
            <Text style={[s.text, { flex: 1 }]}>買う時期を通知する</Text>
            <Switch value={st.notify} onValueChange={(notify) => setS({ notify })} trackColor={{ true: C.main }} />
          </View>
          <Stepper label="何日前に知らせる" value={st.notifyDaysBefore} unit="日前" min={0} max={30} onChange={(notifyDaysBefore) => setS({ notifyDaysBefore })} />
          <Stepper label="通知の時刻" value={st.notifyHour} unit="時" min={5} max={22} onChange={(notifyHour) => setS({ notifyHour })} />
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.text}>近づいたらリストに自動で入れる</Text>
              <Text style={s.small}>オフのときは通知だけ</Text>
            </View>
            <Switch value={st.autoAdd} onValueChange={(autoAdd) => setS({ autoAdd })} trackColor={{ true: C.main }} />
          </View>
        </View>

        <Text style={s.h2}>お店（並び順はリストの見出し順）</Text>
        <View style={[s.card, { paddingVertical: 4 }]}>
          {state.tags.map((t, i) => (
            <View key={t.id} style={[s.row, { paddingVertical: 12 }, !!i && s.divider]}>
              <Pressable style={{ flex: 1 }} onPress={() => Alert.prompt('名前を変える', undefined, (name) => name.trim() && update((x) => ({ ...x, tags: x.tags.map((y) => (y.id === t.id ? { ...y, name: name.trim() } : y)) })), 'plain-text', t.name)}>
                <Text style={s.text}>{t.name}</Text>
              </Pressable>
              <Pressable disabled={!i} onPress={() => moveTag(i, -1)} hitSlop={6} accessibilityLabel="上へ">
                <Text style={[s.link, !i && { color: C.line }]}>↑</Text>
              </Pressable>
              <Pressable disabled={i === state.tags.length - 1} onPress={() => moveTag(i, 1)} hitSlop={6} accessibilityLabel="下へ">
                <Text style={[s.link, i === state.tags.length - 1 && { color: C.line }]}>↓</Text>
              </Pressable>
              <Pressable
                hitSlop={6}
                onPress={() =>
                  Alert.alert(`「${t.name}」を削除しますか？`, 'このお店の品は「指定なし」になります。', [
                    { text: 'やめる', style: 'cancel' },
                    { text: '削除', style: 'destructive', onPress: () => update((x) => ({ ...x, tags: x.tags.filter((y) => y.id !== t.id) })) },
                  ])
                }>
                <Text style={[s.small, { color: C.danger }]}>削除</Text>
              </Pressable>
            </View>
          ))}
          <Pressable onPress={() => Alert.prompt('お店を追加', '例: コンビニ', (name) => name.trim() && update((x) => ({ ...x, tags: [...x.tags, { id: newId(), name: name.trim() }] })))} style={{ paddingVertical: 10 }}>
            <Text style={s.link}>＋ お店を追加</Text>
          </Pressable>
        </View>

        <Text style={s.h2}>よく使うネットスーパー</Text>
        <View style={[s.card, { gap: 6 }]}>
          <TextInput value={st.superUrl} onChangeText={(superUrl) => setS({ superUrl })} placeholder="https://…/search?q={q}" autoCapitalize="none" keyboardType="url" style={s.input} />
          <Text style={s.small}>検索結果ページのURLの、品名の部分を {'{q}'} にして入れてください。品の詳細から開けます。</Text>
        </View>

        <Text style={s.h2}>バックアップ</Text>
        <View style={[s.card, { gap: 12 }]}>
          <Pressable onPress={() => Share.share({ message: JSON.stringify(state) })}>
            <Text style={s.link}>データを書き出す（メモ・メールなどに保存）</Text>
          </Pressable>
          <Pressable onPress={importJson}>
            <Text style={s.link}>書き出したデータを読み込む</Text>
          </Pressable>
          <Text style={s.small}>入れ直すとデータが消えることがあるので、ときどき書き出しておくと安心です（写真は含みません）。</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stepper({ label, value, unit, min, max, onChange }: { label: string; value: number; unit: string; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <View style={s.row}>
      <Text style={[s.text, { flex: 1 }]}>{label}</Text>
      <Pressable onPress={() => onChange(Math.max(min, value - 1))} hitSlop={8} accessibilityLabel="減らす">
        <Text style={[s.link, { fontSize: 22 }]}>−</Text>
      </Pressable>
      <Text style={[s.text, { minWidth: 56, textAlign: 'center' }]}>
        {value}
        {unit}
      </Text>
      <Pressable onPress={() => onChange(Math.min(max, value + 1))} hitSlop={8} accessibilityLabel="増やす">
        <Text style={[s.link, { fontSize: 22 }]}>＋</Text>
      </Pressable>
    </View>
  );
}
