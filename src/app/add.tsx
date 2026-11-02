import { router } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { newId, type ListEntry } from '../logic';
import { addToList, removeEntry, useStore } from '../store';
import { Button, C, s, TagBar, tagName } from '../ui';

type Draft = Pick<ListEntry, 'id' | 'name' | 'tagId' | 'memo' | 'itemId'>;

/** 入力して追加（下から出るシート）。return で追加して次の品へ */
export default function AddSheet() {
  const { state, update } = useStore();
  const [name, setName] = useState('');
  const [memo, setMemo] = useState<string>();
  const [tagId, setTagId] = useState<string>();
  const [added, setAdded] = useState<Draft[]>([]);
  const [undone, setUndone] = useState<Draft>();
  const input = useRef<ComponentRef<typeof TextInput>>(null);

  const add = (e: Omit<Draft, 'id'> = { name: name.trim(), tagId, memo: memo?.trim() ?? '' }) => {
    if (!e.name) return;
    const item = state.items.find((i) => i.name === e.name);
    const entry = { ...e, tagId: e.tagId ?? item?.tagId, itemId: item?.id, id: newId() };
    update((st) => addToList(st, entry, entry.id));
    setAdded((a) => [...a, entry]);
    setName('');
    setMemo(memo === undefined ? undefined : '');
    setUndone(undefined);
    input.current?.focus();
  };

  const undo = (i: number) => {
    const e = added[i];
    update((st) => removeEntry(st, e.id));
    setAdded((a) => a.filter((_, j) => j !== i));
    setUndone(e);
    setName(e.name);
    input.current?.focus();
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[s.row, { padding: 16, paddingTop: 20 }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={s.link}>閉じる</Text>
        </Pressable>
        <Text style={[s.text, { flex: 1, textAlign: 'center', fontWeight: '700' }]}>買うものを入れる</Text>
        <Text style={[s.small, { minWidth: 60, textAlign: 'right' }]}>{added.length ? `${added.length}品 追加` : ''}</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end', padding: 16, gap: 8 }} keyboardShouldPersistTaps="handled">
        {!added.length && !undone && <Text style={[s.small, { textAlign: 'center', marginBottom: 12 }]}>品名を入れてキーボードの［次へ］を押すと、続けて次の品を入れられます</Text>}
        {added.map((e, i) => (
          <View key={e.id} style={[s.card, s.row, { marginHorizontal: 0, paddingVertical: 10 }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.text}>{e.name}</Text>
              <Text style={s.small}>{[tagName(state.tags, e.tagId), e.memo].filter(Boolean).join('・') || '店の指定なし'}</Text>
            </View>
            <Pressable onPress={() => undo(i)} hitSlop={6}>
              <Text style={s.link}>取り消す</Text>
            </Pressable>
          </View>
        ))}
        {undone && (
          <View style={[s.row, { paddingHorizontal: 4 }]}>
            <Text style={[s.small, { flex: 1 }]}>「{undone.name}」を取り消し、入力欄に戻しました</Text>
            <Pressable onPress={() => add(undone)} hitSlop={6}>
              <Text style={s.link}>戻す</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <View style={{ paddingVertical: 12, gap: 10, borderTopWidth: 1, borderColor: C.line, backgroundColor: C.card }}>
        <TagBar tags={state.tags} value={tagId} onChange={setTagId} allLabel="店の指定なし" style={{ flexGrow: 0 }} />
        <View style={{ paddingHorizontal: 16, gap: 8 }}>
          <TextInput
            ref={input}
            autoFocus
            value={name}
            onChangeText={setName}
            placeholder={tagId ? `${tagName(state.tags, tagId)}で買うもの` : '品名（例: 牛乳）'}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => add()}
            style={s.input}
          />
          {memo !== undefined && <TextInput value={memo} onChangeText={setMemo} placeholder="メモ（例: 2本）" style={s.input} onSubmitEditing={() => add()} submitBehavior="submit" />}
          <View style={[s.row, { justifyContent: 'space-between' }]}>
            <Pressable onPress={() => setMemo(memo === undefined ? '' : undefined)} hitSlop={6}>
              <Text style={s.link}>{memo === undefined ? '＋メモ' : 'メモを消す'}</Text>
            </Pressable>
            <Button label="追加" onPress={() => add()} disabled={!name.trim()} />
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
