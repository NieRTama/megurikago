import * as SecureStore from 'expo-secure-store';
import { splitSpoken } from './logic';

// Gemini の API キーはこの端末の SecureStore にだけ置く（state・バックアップ・ログには入れない）
const MODEL = 'gemini-flash-latest';
const KEY_NAME = 'gemini-key';

export const getKey = () => SecureStore.getItemAsync(KEY_NAME).catch(() => null);
/** 空文字なら消す */
export const setKey = (key: string) => (key ? SecureStore.setItemAsync(KEY_NAME, key) : SecureStore.deleteItemAsync(KEY_NAME));

/** Gemini に聞いて JSON を受け取る。キー無し・通信失敗・形式違いはすべて undefined（投げない） */
async function ask(parts: object[]): Promise<Record<string, unknown> | undefined> {
  const key = await getKey();
  if (!key) return;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15000);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: 'application/json' } }),
      signal: ctl.signal,
    });
    if (!res.ok) return;
    const data = await res.json();
    const text = (data.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('');
    return JSON.parse(text);
  } catch {
    return;
  } finally {
    clearTimeout(timer);
  }
}

/** 写真から品名を1つ読み取る。enabled=false（設定オフ）なら何も送らない */
export async function nameFromPhoto(base64Jpeg: string, enabled: boolean): Promise<string | undefined> {
  if (!enabled) return;
  const r = await ask([
    { text: '写真に写っている日用品・食品の、一般的な品名を日本語で短く1つ答えてください。ブランド名・容量・個数は省きます。分からなければ空文字にします。{ "name": string } の JSON だけを返します。' },
    { inlineData: { mimeType: 'image/jpeg', data: base64Jpeg } },
  ]);
  return typeof r?.name === 'string' ? r.name.trim() || undefined : undefined;
}

/** 話した文字を品ごとに分ける。enabled=false・キー無し・失敗のときは端末内の splitSpoken で分ける */
export async function splitItems(text: string, enabled: boolean): Promise<string[]> {
  const r = enabled ? await ask([{ text: `買い物の品を話した文章を、品ごとに分けてください。品名だけにして、数量や「と」「や」は取り除きます。{ "items": string[] } の JSON だけを返します。\n文章: ${text}` }]) : undefined;
  const items = Array.isArray(r?.items) ? r.items.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean) : [];
  return items.length ? items : splitSpoken(text);
}
