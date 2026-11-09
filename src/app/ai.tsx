import { useEffect, useState } from 'react';
import { Alert, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { getKey, setKey } from '../ai';
import { type Settings } from '../logic';
import { useStore } from '../store';
import { Button, C, s } from '../ui';

/** AI の利用: 使うかどうかと Gemini の API キー（キーはこの端末の安全な保管場所にだけ置く） */
export default function AiSettings() {
  const { state, update } = useStore();
  const st = state.settings;
  const setS = (patch: Partial<Settings>) => update((x) => ({ ...x, settings: { ...x.settings, ...patch } }));
  // キーそのものは画面に持たない。末尾4文字だけ
  const [last4, setLast4] = useState<string | null>();
  const [input, setInput] = useState('');

  useEffect(() => {
    getKey().then((k) => setLast4(k ? k.slice(-4) : null));
  }, []);

  const save = async () => {
    const k = input.trim();
    if (!k) return;
    try {
      await setKey(k);
      setLast4(k.slice(-4));
      setInput('');
    } catch (e) {
      Alert.alert('キーを保存できませんでした', String(e));
    }
  };

  const clear = () =>
    Alert.alert('キーを消しますか？', 'このiPhoneに保存したキーを削除します。AI の機能は使えなくなります。', [
      { text: 'やめる', style: 'cancel' },
      { text: '消す', style: 'destructive', onPress: () => setKey('').then(() => setLast4(null)) },
    ]);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingBottom: 48 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <Text style={s.h2}>写真から品名</Text>
      <View style={[s.card, { gap: 6 }]}>
        <View style={s.row}>
          <Text style={[s.text, { flex: 1 }]}>写真から品名を読み取る</Text>
          <Switch value={st.aiPhoto} onValueChange={(aiPhoto) => setS({ aiPhoto })} trackColor={{ true: C.main }} />
        </View>
        <Text style={s.small}>品名が空のときだけ、撮った写真を Google の Gemini に送り、品名の候補を入れます。個人情報が写った写真には使わないでください。Gemini の無料枠では、送った内容が Google のサービス改善に使われることがあります。</Text>
      </View>

      <Text style={s.h2}>音声の分け方</Text>
      <View style={[s.card, { gap: 6 }]}>
        <View style={s.row}>
          <Text style={[s.text, { flex: 1 }]}>話した内容を AI で品ごとに分ける</Text>
          <Switch value={st.aiVoice} onValueChange={(aiVoice) => setS({ aiVoice })} trackColor={{ true: C.main }} />
        </View>
        <Text style={s.small}>声は送りません。聞き取った文字だけを Gemini に送ります（無料枠では、Google のサービス改善に使われることがあります）。オフのときは、「、」や「それと」「あと」で区切り、この iPhone の中だけで分けます。</Text>
      </View>

      <Text style={s.h2}>Gemini の API キー</Text>
      <View style={[s.card, { gap: 10 }]}>
        {last4 ? (
          <View style={s.row}>
            <Text style={[s.text, { flex: 1 }]}>設定済み（…{last4}）</Text>
            <Button kind="ghost" label="消す" onPress={clear} />
          </View>
        ) : (
          <>
            <TextInput value={input} onChangeText={setInput} placeholder="キーを貼り付け" secureTextEntry autoCapitalize="none" autoCorrect={false} style={s.input} />
            <Button label="保存" onPress={save} disabled={!input.trim()} />
          </>
        )}
        <Text style={s.small}>
          キーは Google AI Studio（aistudio.google.com）の「Get API key」で作れます。この iPhone の安全な保管場所にだけ保存し、バックアップの書き出しには含まれません。キーがないと、上の設定がオンでも何も送られません。
        </Text>
      </View>
    </ScrollView>
  );
}
