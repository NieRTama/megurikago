import * as SecureStore from 'expo-secure-store';
import { parseSpoken } from './logic';

// Gemini の API キーはこの端末の SecureStore にだけ置く（state・バックアップ・ログには入れない）
const MODEL = 'gemini-flash-latest';
const KEY_NAME = 'gemini-key';

export const getKey = () => SecureStore.getItemAsync(KEY_NAME).catch(() => null);
/** 空文字なら消す */
export const setKey = (key: string) => (key ? SecureStore.setItemAsync(KEY_NAME, key) : SecureStore.deleteItemAsync(KEY_NAME));

/** Gemini に聞いて JSON を受け取る。キー無し・通信失敗・形式違いはすべて undefined（投げない） */
async function ask(parts: object[]): Promise<Record<string, unknown> | undefined> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15000);
  try {
    const key = await getKey();
    if (!key) return;
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

/** 話した文を 品名・お店・メモ(数量) に分ける。enabled=false・キー無し・空・失敗のときは端末内の parseSpoken で分ける */
export async function splitItems(text: string, enabled: boolean, storeNames: string[]): Promise<{ name: string; store?: string; memo: string }[]> {
  const prompt = `買い物の品を話した文章を、品ごとに 品名・お店・メモ に分けてください。
- 品名: 品の名前だけ（数量・助詞「を」「と」は取り除く）
- お店: 「〇〇で」と言ったお店（以降の品にも続く）。言っていなければ空文字
- メモ: 数量（漢数字は算用数字に、「箇」は「個」に）。無ければ空文字
登録済みのお店: ${storeNames.join('、') || 'なし'}
言ったお店が登録済みのお店と同じなら登録済みの名前で答えます。登録に無いお店は、言ったとおりの名前のまま答えます。
{ "items": [{ "name": string, "store": string, "memo": string }] } の JSON だけを返します。
文章: ${text}`;
  const r = enabled ? await ask([{ text: prompt }]) : undefined;
  const items = Array.isArray(r?.items)
    ? (r.items as unknown[]).flatMap((x) => {
        const o = x as { name?: unknown; store?: unknown; memo?: unknown };
        const name = typeof o?.name === 'string' ? o.name.trim() : '';
        const store = typeof o?.store === 'string' ? o.store.trim() : '';
        return name ? [{ name, ...(store ? { store } : {}), memo: typeof o.memo === 'string' ? o.memo.trim() : '' }] : [];
      })
    : [];
  return items.length ? items : parseSpoken(text, storeNames);
}
