import { Link, type Href } from 'expo-router';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { realTags, type Settings, type State } from '../../logic';
import { useStore, withDefaults } from '../../store';
import { C, Chip, s } from '../../ui';

export default function Me() {
  const { state, update } = useStore();
  const st = state.settings;
  const setS = (patch: Partial<Settings>) => update((x) => ({ ...x, settings: { ...x.settings, ...patch } }));

  const importJson = () =>
    Alert.prompt('バックアップを読み込む', '書き出した文字をそのまま貼り付けてください。いまのデータは置き換わります。', (text) => {
      try {
        const data = JSON.parse(text) as State;
        if (data.version !== 1 || ![data.items, data.list, data.purchases, data.tags].every(Array.isArray)) throw new Error('形式が違います');
        // 家族グループの参加状態は書き出しに頼らず、この端末のものを保つ（クラウドの内容は、参加中なら読み込んだ内容に合わせて更新される）
        const go = () => {
          update((cur) => ({ ...withDefaults(data), cloud: cur.cloud }));
          Alert.alert('読み込みました', '写真はバックアップに含まれないため、必要なら撮り直してください。');
        };
        if (!state.cloud) return go();
        Alert.alert('家族のクラウドのデータも置き換わります', '家族グループに参加中なので、読み込んだ内容がクラウドにも送られ、ほかの人の端末のデータも置き換わります。', [
          { text: 'やめる', style: 'cancel' },
          { text: '読み込む', style: 'destructive', onPress: go },
        ]);
      } catch (e) {
        Alert.alert('読み込めませんでした', String(e));
      }
    });

  return (
    <SafeAreaView edges={['top']} style={s.screen}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingBottom: 48 }} automaticallyAdjustKeyboardInsets>
        <Text style={s.title}>わたし</Text>

        <View style={[s.card, { paddingVertical: 4 }]}>
          <Go href="/history" label="購入履歴" note={`${state.purchases.length}件`} />
          <Go href="/share" label="家族と共有" note={state.cloud ? '参加中' : 'オフ'} divider />
          <Go href="/notify" label="通知" note={st.notify ? 'オン' : 'オフ'} divider />
          <Go href="/stores" label="お店と売り場の順" note={`${realTags(state.tags).length}件`} divider />
        </View>

        <Text style={s.h2}>よく使うネットスーパー</Text>
        <View style={[s.card, { gap: 6 }]}>
          <TextInput value={st.superUrl} onChangeText={(superUrl) => setS({ superUrl })} placeholder="https://…/search?q={q}" autoCapitalize="none" keyboardType="url" style={s.input} />
          <Text style={s.small}>検索結果ページのURLの、品名の部分を {'{q}'} にして入れてください。品の詳細やネット検索から開けます。</Text>
        </View>

        <View style={[s.card, { marginTop: 16 }]}>
          <View style={s.row}>
            <Text style={[s.text, { flex: 1 }]}>品の絵を表示する</Text>
            <Switch value={st.showPics} onValueChange={(showPics) => setS({ showPics })} trackColor={{ true: C.main }} />
          </View>
          <Text style={[s.small, { marginTop: 4 }]}>オフにすると、写真やイラストの代わりに頭文字の札を出します。</Text>
        </View>

        <Text style={s.h2}>棚の見え方（写真つきの品）</Text>
        <View style={[s.row, { paddingHorizontal: 16 }]}>
          <Chip label="切り抜き" on={st.shelfView === 'cutout'} onPress={() => setS({ shelfView: 'cutout' })} />
          <Chip label="元の写真" on={st.shelfView === 'photo'} onPress={() => setS({ shelfView: 'photo' })} />
        </View>

        {!!st.iconOff.length && (
          <>
            <Text style={s.h2}>外したアイコン（{st.iconOff.length}件）</Text>
            <View style={[s.card, { paddingVertical: 4 }]}>
              {st.iconOff.map((name, i) => (
                <View key={name} style={[s.row, { paddingVertical: 12 }, !!i && s.divider]}>
                  <Text style={[s.text, { flex: 1 }]}>{name}</Text>
                  <Pressable onPress={() => setS({ iconOff: st.iconOff.filter((x) => x !== name) })} hitSlop={6}>
                    <Text style={s.link}>戻す</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={[s.card, { marginTop: 16, paddingVertical: 4 }]}>
          <Go href="/ai" label="AI の利用" note={st.aiPhoto || st.aiVoice ? 'オン' : 'オフ'} />
          <Go href="/help" label="使い方" divider />
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

/** 行を押すと別の画面へ。Link asChild の style に配列は渡せないので flatten する */
function Go({ href, label, note, divider }: { href: Href; label: string; note?: string; divider?: boolean }) {
  return (
    <Link href={href} asChild>
      <Pressable style={StyleSheet.flatten([s.row, { paddingVertical: 12 }, divider && s.divider])}>
        <Text style={[s.text, { flex: 1 }]}>{label}</Text>
        <Text style={s.small}>{note ? `${note} ›` : '›'}</Text>
      </Pressable>
    </Link>
  );
}
