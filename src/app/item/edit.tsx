import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { newId, today, type Item } from '../../logic';
import { nameFromPhoto } from '../../ai';
import { deletePhoto, pastePhoto, pickPhoto, toggleIconOff, useStore } from '../../store';
import { Button, C, Chip, hasIcon, s, TagBar, Thumb } from '../../ui';

const PRESETS: [string, number][] = [
  ['1週間', 7],
  ['2週間', 14],
  ['1か月', 30],
  ['3か月', 90],
  ['半年', 180],
  ['1年', 365],
];

/** 登録（id なし）と編集（id あり）の共通フォーム */
export default function EditItem() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { state, update } = useStore();
  const old = state.items.find((i) => i.id === id);
  const [reading, setReading] = useState(false);
  const [f, setF] = useState<Item>(old ?? { id: newId(), name: '', memo: '', cycleDays: 30, url: '', createdAt: today() });
  const set = (patch: Partial<Item>) => setF((x) => ({ ...x, ...patch }));

  const photo = async (camera: boolean | 'paste') => {
    try {
      const r: { photo: string; photoOrig?: string; base64?: string } | undefined = camera === 'paste' ? await pastePhoto().then((photo) => (photo ? { photo } : undefined)) : await pickPhoto(camera, state.settings.aiPhoto && !f.name.trim());
      if (!r) return;
      // ponytail: 選び直した写真や保存しなかった写真は消さない。容量が気になったら孤児ファイルを掃除する
      set({ photo: r.photo, photoOrig: r.photoOrig });
      // 品名が空のときだけ、設定がオンでキーもあれば写真から読み取る（入れるだけ。保存は人が押す）
      const { base64 } = r;
      if (!base64 || f.name.trim() || !state.settings.aiPhoto) return;
      setReading(true);
      const name = await nameFromPhoto(base64, state.settings.aiPhoto);
      setReading(false);
      if (name) setF((x) => (x.name.trim() ? x : { ...x, name }));
    } catch (e) {
      setReading(false);
      Alert.alert('写真を取り込めませんでした', String(e));
    }
  };

  const save = () => {
    const name = f.name.trim();
    if (!name) return;
    const item = { ...f, name, memo: f.memo.trim(), url: f.url.trim(), cycleDays: Math.max(1, f.cycleDays || 1) };
    if (old?.photo && old.photo !== item.photo) deletePhoto(old.photo);
    if (old?.photoOrig && old.photoOrig !== item.photoOrig) deletePhoto(old.photoOrig);
    update((st) => ({ ...st, items: old ? st.items.map((i) => (i.id === item.id ? item : i)) : [...st.items, item] }));
    router.back();
  };

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 60, gap: 4 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <Stack.Screen
        options={{
          title: old ? '編集' : 'いつもの品を登録',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <Text style={s.link}>やめる</Text>
            </Pressable>
          ),
          headerRight: () => (
            <Pressable onPress={save} disabled={!f.name.trim()} hitSlop={8}>
              <Text style={[s.link, !f.name.trim() && { color: C.sub }]}>保存</Text>
            </Pressable>
          ),
        }}
      />
      <View style={{ alignItems: 'center', gap: 12, paddingVertical: 16 }}>
        <Thumb item={f} name={f.name || '？'} size={140} />
        <View style={s.row}>
          <Button kind="ghost" label="撮る" onPress={() => photo(true)} />
          <Button kind="ghost" label="写真から選ぶ" onPress={() => photo(false)} />
          {f.photo && <Button kind="ghost" label="外す" onPress={() => set({ photo: undefined, photoOrig: undefined })} />}
        </View>
        <Pressable onPress={() => photo('paste')} hitSlop={6} style={{ alignItems: 'center', paddingHorizontal: 32 }}>
          <Text style={s.link}>切り抜きを貼り付け</Text>
          <Text style={[s.small, { textAlign: 'center' }]}>「写真」アプリで品を長押し →「コピー」すると、背景を消した品だけをアイコンにできます</Text>
        </Pressable>
        {!f.photo && hasIcon(f.name) && (
          <Pressable onPress={() => update((st) => toggleIconOff(st, f.name))} hitSlop={6}>
            <Text style={s.link}>{state.settings.iconOff.includes(f.name.trim()) ? 'アイコンを戻す' : 'このアイコンを外す'}</Text>
          </Pressable>
        )}
      </View>

      <Text style={s.h2}>品名（必須）</Text>
      <TextInput value={f.name} onChangeText={(name) => set({ name })} placeholder={reading ? '読み取り中…' : '例: 食器用洗剤'} style={[s.input, { marginHorizontal: 16 }]} />

      <Text style={s.h2}>買う店</Text>
      <TagBar tags={state.tags} value={f.tagId} onChange={(tagId) => set({ tagId })} allLabel="指定なし" style={{ flexGrow: 0 }} />

      <Text style={s.h2}>だいたい何日ごとに買う？</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 }}>
        {PRESETS.map(([label, days]) => (
          <Chip key={days} label={label} on={f.cycleDays === days} onPress={() => set({ cycleDays: days })} />
        ))}
      </View>
      <View style={[s.row, { paddingHorizontal: 16, marginTop: 8 }]}>
        <TextInput
          value={f.cycleDays ? String(f.cycleDays) : ''}
          onChangeText={(v) => set({ cycleDays: Number(v.replace(/\D/g, '')) })}
          keyboardType="number-pad"
          style={[s.input, { width: 90, textAlign: 'right' }]}
        />
        <Text style={s.text}>日ごと</Text>
      </View>
      <Text style={[s.small, { paddingHorizontal: 16, marginTop: 6 }]}>2回以上買うと、実際の間隔から自動で計算します。</Text>
      <Pressable onPress={() => router.navigate('/me')} style={{ paddingHorizontal: 16, marginTop: 6 }}>
        <Text style={s.link}>通知の設定を開く ›</Text>
      </Pressable>

      <Text style={s.h2}>メモ</Text>
      <TextInput value={f.memo} onChangeText={(memo) => set({ memo })} placeholder="例: 詰め替え用・大きいほう" multiline style={[s.input, { marginHorizontal: 16, minHeight: 70 }]} />

      <Text style={s.h2}>商品のリンク</Text>
      <TextInput value={f.url} onChangeText={(url) => set({ url })} placeholder="https://…" autoCapitalize="none" keyboardType="url" style={[s.input, { marginHorizontal: 16 }]} />

      {state.cloud && (
        <>
          <Text style={s.h2}>家族との共有</Text>
          <View style={[s.card, { gap: 6 }]}>
            <View style={s.row}>
              <Text style={[s.text, { flex: 1 }]}>家族と共有する</Text>
              <Switch value={!f.private} onValueChange={(on) => set({ private: on ? undefined : true })} trackColor={{ true: C.main }} />
            </View>
            <Text style={s.small}>オフにすると、この品とその購入記録・リスト行は、この端末だけのものになります。共有済みの品をオフにすると、ほかの人の端末からは消えます。</Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}
