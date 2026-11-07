import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { splitItems } from '../ai';
import { newId, type ListEntry } from '../logic';
import { addToList, removeEntry, useStore } from '../store';
import { Button, C, s, smooth, TagBar, tagName } from '../ui';

type Draft = Pick<ListEntry, 'id' | 'name' | 'tagId' | 'memo' | 'itemId'>;

type Speech = typeof import('expo-speech-recognition').ExpoSpeechRecognitionModule;

/** 音声認識。Expo Go には入っていないので、読み込めたときだけ使う（無ければマイクボタンを出さない） */
function loadSpeech(): Speech | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m: Speech = require('expo-speech-recognition').ExpoSpeechRecognitionModule;
    return m.isRecognitionAvailable() ? m : undefined;
  } catch {
    return;
  }
}

/** 入力して追加（下から出るシート）。return で追加して次の品へ */
export default function AddSheet() {
  const { state, update } = useStore();
  const [name, setName] = useState('');
  const [memo, setMemo] = useState<string>();
  const [tagId, setTagId] = useState<string>();
  const [added, setAdded] = useState<Draft[]>([]);
  const [undone, setUndone] = useState<Draft>();
  const input = useRef<ComponentRef<typeof TextInput>>(null);

  // ---- 音声: 話している間は文字を見せ、止めたら品ごとに分けてリストへ積む ----
  const { voice } = useLocalSearchParams<{ voice?: string }>();
  const [speech] = useState(loadSpeech);
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [heard, setHeard] = useState('');
  const [note, setNote] = useState<string>();
  const spoken = useRef('');
  const live = useRef(false);
  const onEnd = useRef<(text: string) => void>(undefined);

  const add = (e: Omit<Draft, 'id'> = { name: name.trim(), tagId, memo: memo?.trim() ?? '' }, fromVoice = false) => {
    if (!e.name) return;
    const item = state.items.find((i) => i.name === e.name);
    const entry = { ...e, tagId: e.tagId ?? item?.tagId, itemId: item?.id, id: newId() };
    update((st) => addToList(st, entry, entry.id));
    smooth();
    setAdded((a) => [...a, entry]);
    setUndone(undefined);
    // 音声で入れたときは、打ちかけの文字を消さない
    if (fromVoice) return;
    setName('');
    setMemo(memo === undefined ? undefined : '');
    input.current?.focus();
  };

  // 聞き取りが終わったときに、そのときの最新の画面状態で呼ぶ
  useEffect(() => {
    onEnd.current = async (text) => {
      setBusy(true);
      const pieces = await splitItems(text, state.settings.aiVoice);
      setBusy(false);
      pieces.forEach((name) => add({ name, tagId, memo: '' }, true));
    };
  });

  useEffect(() => {
    if (!speech) return;
    const subs = [
      speech.addListener('start', () => {
        setNote(undefined);
        setListening(true);
      }),
      speech.addListener('result', (e) => {
        spoken.current = e.results[0]?.transcript ?? spoken.current;
        setHeard(spoken.current);
      }),
      speech.addListener('error', (e) => {
        if (e.error === 'no-speech') setNote('聞き取れませんでした。もう一度［話す］を押してください');
        else if (e.error === 'not-allowed') setNote('マイクか音声認識が許可されていません。設定アプリで許可してください');
        else if (e.error !== 'aborted') setNote(`聞き取れませんでした（${e.message}）`);
      }),
      speech.addListener('end', () => {
        live.current = false;
        setListening(false);
        const text = spoken.current.trim();
        spoken.current = '';
        setHeard('');
        if (text) onEnd.current?.(text);
      }),
    ];
    return () => {
      subs.forEach((x) => x.remove());
      if (live.current) speech.abort();
    };
  }, [speech]);

  const listen = async () => {
    if (!speech || live.current) return;
    // 端末内で認識できるときは音声を外へ出さない。許可は、端末内でもマイクと音声認識の両方を求める
    const onDevice = speech.supportsOnDeviceRecognition();
    const perm = await speech.requestPermissionsAsync();
    if (!perm.granted) return Alert.alert('マイクを使えません', '設定アプリで、マイクと音声認識を許可してください。');
    live.current = true;
    spoken.current = '';
    speech.start({ lang: 'ja-JP', interimResults: true, requiresOnDeviceRecognition: onDevice });
  };

  // ウィジェットやコントロールから megurikago://add?voice=1 で開かれたら、すぐ聞き取りを始める
  useEffect(() => {
    if (voice === '1') listen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice, speech]);

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
        {!added.length && !undone && <Text style={[s.small, { textAlign: 'center', marginBottom: 12 }]}>品名を入れてキーボードの［次へ］を押すと、続けて次の品を入れられます{speech ? '。［話す］を押して声で入れることもできます' : ''}</Text>}
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

      <View style={{ paddingVertical: 12, gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: C.card }}>
        <TagBar tags={state.tags} value={tagId} onChange={setTagId} allLabel="店の指定なし" style={{ flexGrow: 0 }} />
        <View style={{ paddingHorizontal: 16, gap: 8 }}>
          <View style={s.row}>
            <TextInput
              ref={input}
              autoFocus
              value={name}
              onChangeText={setName}
              placeholder={tagId ? `${tagName(state.tags, tagId)}で買うもの` : '品名（例: 牛乳）'}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => add()}
              style={[s.input, { flex: 1 }]}
            />
            {speech && <Button kind="ghost" label={listening ? '止める' : '話す'} onPress={() => (listening ? speech.stop() : listen())} disabled={busy} />}
          </View>
          {(listening || busy || !!note) && <Text style={s.small}>{busy ? '品ごとに分けています…' : listening ? heard || '聞いています…（話し終えたら［止める］）' : note}</Text>}
          {memo !== undefined && <TextInput value={memo} onChangeText={setMemo} placeholder="メモ（例: 2本）" style={s.input} onSubmitEditing={() => add()} submitBehavior="submit" />}
          <View style={[s.row, { justifyContent: 'space-between' }]}>
            <Pressable onPress={() => (smooth(), setMemo(memo === undefined ? '' : undefined))} hitSlop={6}>
              <Text style={s.link}>{memo === undefined ? '＋メモ' : 'メモを消す'}</Text>
            </Pressable>
            <Button label="追加" onPress={() => add()} disabled={!name.trim()} />
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
