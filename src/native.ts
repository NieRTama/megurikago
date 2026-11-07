import { requireOptionalNativeModule } from 'expo';

/** ネイティブ機能の窓口。Expo Go など、モジュールが無い環境では何もしない */
type Native = {
  liftSubject(srcUri: string): Promise<string | null>;
  setWidgetData(json: string): void;
};

const native = requireOptionalNativeModule<Native>('MegurikagoNative');

export type WidgetData = { items: { name: string; store?: string }[]; count: number; updatedAt: string };

/** 写真から被写体だけを切り抜き、透過 PNG のファイル名（Paths.document 直下）を返す。できなければ undefined */
export async function liftSubject(srcUri: string): Promise<string | undefined> {
  if (!native) return undefined;
  try {
    return (await native.liftSubject(srcUri)) ?? undefined;
  } catch {
    return undefined;
  }
}

/** ウィジェット用データを App Group に書いて更新する。使えない環境では何もしない */
export function setWidgetData(data: WidgetData): void {
  try {
    native?.setWidgetData(JSON.stringify(data));
  } catch {
    // ウィジェットが更新できなくても本体は動かす
  }
}
