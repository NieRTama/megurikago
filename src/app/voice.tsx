import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { splitItems } from '../ai';
import { newId, parseSpoken, realTags, storeKey } from '../logic';
import { addToList, smooth, useStore } from '../store';
import { Button, C, Chip, s, TempBadge } from '../ui';

type Speech = typeof import('expo-speech-recognition').ExpoSpeechRecognitionModule;

/** 音声認識。Expo Go には入っていないので、読み込めたときだけ使う */
function loadSpeech(): Speech | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m: Speech = require('expo-speech-recognition').ExpoSpeechRecognitionModule;
    return m.isRecognitionAvailable() ? m : undefined;
  } catch {
    return;
  }
}

type Row = { id: string; on: boolean; name: string; store?: string; memo: string };

const key = storeKey;

/** 話して追加（下から出るシート）。開いたらすぐ聞き取り、［話し終えた］で品ごとに分けて確かめる */
export default function VoiceSheet() {
  const { state, update } = useStore();
  const [speech] = useState(loadSpeech);
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [heard, setHeard] = useState('');
  const [said, setSaid] = useState('');
  const [note, setNote] = useState<string | undefined>(speech ? undefined : 'この環境（Expo Go など）では音声認識を使えません。下の［＋ 品を足す］から入力してください');
  const [rows, setRows] = useState<Row[]>([]);
  const [picking, setPicking] = useState<string>();
  const spoken = useRef(''); // いま認識中の（まだ確定していない）文
  const confirmed = useRef(''); // 確定した（isFinal）文のつなぎ。続けて聞くとき用
  const live = useRef(false);
  const mounted = useRef(true);
  const onEnd = useRef<(text: string) => void>(undefined);

  const real = realTags(state.tags);
  const isReal = (name: string) => real.some((t) => key(t.name) === key(name));
  const patch = (id: string, p: Partial<Row>) => setRows((r) => r.map((x) => (x.id === id ? { ...x, ...p } : x)));

  // 聞き取りが終わったときに、そのときの最新の画面状態で呼ぶ
  useEffect(() => {
    onEnd.current = async (text) => {
      setSaid((x) => (x ? `${x} ${text}` : text));
      setBusy(true);
      const names = real.map((t) => t.name);
      try {
        let pieces: Awaited<ReturnType<typeof splitItems>>;
        try {
          pieces = await splitItems(text, state.settings.aiVoice, names);
        } catch {
          pieces = parseSpoken(text, names); // 想定外の失敗でも端末内の分け方で続ける
        }
        smooth();
        // お店は、言ったお店を棚の品のお店より優先する（その品をそのお店で買う、と言っているため）
        setRows((r) => [...r, ...pieces.map((p) => ({ id: newId(), on: true, name: p.name, store: p.store, memo: p.memo }))]);
      } finally {
        setBusy(false);
      }
    };
  });

  /** 止めるまで聞き続ける（間があいても止めない） */
  const listen = async () => {
    if (!speech || live.current) return;
    live.current = true; // 許可待ちの間の二重起動を防ぐ
    // 端末内で認識できるときは音声を外へ出さない。許可は、端末内でもマイクと音声認識の両方を求める
    const onDevice = speech.supportsOnDeviceRecognition();
    const perm = await speech.requestPermissionsAsync();
    if (!mounted.current || !perm.granted) {
      live.current = false;
      if (mounted.current) Alert.alert('マイクを使えません', '設定アプリで、マイクと音声認識を許可してください。');
      return;
    }
    spoken.current = '';
    confirmed.current = '';
    speech.start({ lang: 'ja-JP', continuous: true, interimResults: true, addsPunctuation: true, requiresOnDeviceRecognition: onDevice });
  };

  useEffect(() => {
    if (!speech) return;
    const subs = [
      speech.addListener('start', () => {
        setNote(undefined);
        setListening(true);
      }),
      speech.addListener('result', (e) => {
        spoken.current = e.results[0]?.transcript ?? spoken.current;
        // 確定したぶんは取っておき、続きの認識と合わせて表示する
        if (e.isFinal) {
          confirmed.current += spoken.current;
          spoken.current = '';
        }
        setHeard(confirmed.current + spoken.current);
      }),
      speech.addListener('error', (e) => {
        if (e.error === 'no-speech') setNote('聞き取れませんでした。もう一度［もう一度話す］を押してください');
        else if (e.error === 'not-allowed') setNote('マイクか音声認識が許可されていません。設定アプリで許可してください');
        else if (e.error !== 'aborted') setNote(`聞き取れませんでした（${e.message}）`);
      }),
      speech.addListener('end', () => {
        live.current = false;
        setListening(false);
        const text = (confirmed.current + spoken.current).trim();
        confirmed.current = '';
        spoken.current = '';
        setHeard('');
        if (text) onEnd.current?.(text);
      }),
    ];
    mounted.current = true;
    listen();
    return () => {
      mounted.current = false;
      subs.forEach((x) => x.remove());
      if (live.current) speech.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech]);

  const chosen = rows.filter((r) => r.on && r.name.trim());
  // お店の選択肢: 登録済み + 今ある一時的なお店 + この画面で言ったお店（名前の重なりは1つに）
  // 同じお店（アマゾン＝Amazon など）は 1 つにまとめ、登録してある名前で出す
  const options = [...new Map([...rows.map((r) => r.store ?? ''), ...state.tags.map((t) => t.name)].filter(Boolean).map((n) => [key(n), n])).values()];

  const submit = () => {
    update((st) => {
      let cur = st;
      for (const r of chosen) {
        const name = r.name.trim();
        const store = r.store?.trim();
        const item = cur.items.find((i) => i.name === name);
        let tagId = item?.tagId;
        if (store) {
          // 登録済み（または先の行で作った一時的な）お店と同じ名前ならそれ。無ければ一時的なお店を1つ作る
          let id = cur.tags.find((t) => key(t.name) === key(store))?.id;
          if (!id) {
            id = newId();
            cur = { ...cur, tags: [...cur.tags, { id, name: store, temp: true }] };
          }
          tagId = id;
        }
        cur = addToList(cur, { name, tagId, memo: r.memo.trim(), itemId: item?.id });
      }
      return cur;
    });
    router.back();
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[s.row, { padding: 16, paddingTop: 20 }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={s.link}>閉じる</Text>
        </Pressable>
        <Text style={[s.text, { flex: 1, textAlign: 'center', fontWeight: '700' }]}>話して入れる</Text>
        <View style={{ minWidth: 40 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 10 }} keyboardShouldPersistTaps="handled">
        <View style={[s.card, { marginHorizontal: 0, gap: 4 }]}>
          <Text style={s.small}>{listening ? '聞いています…（話し終えたら［話し終えた］）' : busy ? '品ごとに分けています…' : '聞き取った文'}</Text>
          <Text style={s.text}>{listening ? heard || ' ' : said || '（まだありません）'}</Text>
        </View>
        {!!note && <Text style={[s.small, { color: C.danger }]}>{note}</Text>}

        {rows.map((r) => (
          <View key={r.id} style={[s.card, { marginHorizontal: 0, gap: 8, opacity: r.on ? 1 : 0.55 }]}>
            <View style={s.row}>
              <Pressable onPress={() => patch(r.id, { on: !r.on })} hitSlop={8} accessibilityRole="checkbox" accessibilityState={{ checked: r.on }}>
                <View style={{ width: 26, height: 26, borderRadius: 7, borderWidth: 1.5, borderColor: C.main, backgroundColor: r.on ? C.main : C.card, alignItems: 'center', justifyContent: 'center' }}>
                  {r.on && <Text style={{ color: '#fff', fontWeight: '700' }}>✓</Text>}
                </View>
              </Pressable>
              <TextInput value={r.name} onChangeText={(v) => patch(r.id, { name: v })} placeholder="品名" style={[s.input, { flex: 1 }]} />
            </View>
            <View style={s.row}>
              <Pressable onPress={() => (smooth(), setPicking(picking === r.id ? undefined : r.id))} style={[s.row, { gap: 6, flex: 1 }]} accessibilityRole="button">
                <Text style={[s.link, !r.store && { color: C.sub }]}>{r.store ?? 'お店の指定なし'}</Text>
                {!!r.store && !isReal(r.store) && <TempBadge />}
              </Pressable>
              <TextInput value={r.memo} onChangeText={(v) => patch(r.id, { memo: v })} placeholder="メモ（例: 2本）" style={[s.input, { flex: 1 }]} />
            </View>
            {picking === r.id && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                <Chip label="指定なし" on={!r.store} onPress={() => (patch(r.id, { store: undefined }), setPicking(undefined))} />
                {options.map((n) => (
                  <Chip key={n} label={isReal(n) ? n : `${n}（一時的）`} on={!!r.store && key(r.store) === key(n)} onPress={() => (patch(r.id, { store: n }), setPicking(undefined))} />
                ))}
              </ScrollView>
            )}
          </View>
        ))}

        <View style={[s.row, { justifyContent: 'space-between' }]}>
          <Pressable onPress={() => (smooth(), setRows((r) => [...r, { id: newId(), on: true, name: '', memo: '' }]))} hitSlop={6}>
            <Text style={s.link}>＋ 品を足す</Text>
          </Pressable>
          {speech && (listening ? <Button label="話し終えた" onPress={() => speech.stop()} /> : <Button kind="ghost" label="もう一度話す" onPress={listen} disabled={busy} />)}
        </View>
      </ScrollView>

      <View style={{ padding: 16, paddingBottom: 28, borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: C.card }}>
        <Button label={`${chosen.length}品を追加`} onPress={submit} disabled={!chosen.length || listening || busy} />
      </View>
    </KeyboardAvoidingView>
  );
}
