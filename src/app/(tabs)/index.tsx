import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { diffDays, inList, nextDate, SOON_DAYS, type Item } from '../../logic';
import { addToList, useStore } from '../../store';
import { C, s, TagBar, Thumb } from '../../ui';

const SORTS = ['期限順', '追加順', '店ごと'] as const;

export default function Shelf() {
  const { state, day, update } = useStore();
  const [tagId, setTagId] = useState<string>();
  const [sort, setSort] = useState<(typeof SORTS)[number]>('期限順');
  const [query, setQuery] = useState<string>();

  const left = (item: Item) => diffDays(day, nextDate(item, state.purchases));
  const q = query?.trim();
  let items = state.items.filter(
    (i) => (!tagId || i.tagId === tagId) && (!q || i.name.includes(q) || i.memo.includes(q)),
  );
  items = sort === '追加順' ? [...items].reverse() : [...items].sort((a, b) => left(a) - left(b));

  const sections: [string, Item[]][] =
    sort === '店ごと'
      ? [...state.tags.map((t) => [t.name, items.filter((i) => i.tagId === t.id)] as [string, Item[]]), ['お店の指定なし', items.filter((i) => !state.tags.some((t) => t.id === i.tagId))]]
      : sort === '期限順'
        ? [
            ['もうすぐ', items.filter((i) => left(i) <= SOON_DAYS)],
            ['まだ先', items.filter((i) => left(i) > SOON_DAYS)],
          ]
        : [['', items]];

  return (
    <SafeAreaView edges={['top']} style={s.screen}>
      <View style={[s.row, { paddingRight: 16 }]}>
        <Text style={[s.title, { flex: 1 }]}>いつもの</Text>
        <Pressable onPress={() => setQuery(query === undefined ? '' : undefined)} hitSlop={8}>
          <Text style={s.link}>{query === undefined ? '検索' : '閉じる'}</Text>
        </Pressable>
        <Pressable onPress={() => setSort(SORTS[(SORTS.indexOf(sort) + 1) % SORTS.length])} hitSlop={8}>
          <Text style={s.link}>{sort} ⇅</Text>
        </Pressable>
        <Link href="/item/edit" asChild>
          <Pressable hitSlop={8} accessibilityLabel="登録する">
            <Text style={[s.link, { fontSize: 28, lineHeight: 30 }]}>＋</Text>
          </Pressable>
        </Link>
      </View>
      {query !== undefined && (
        <TextInput autoFocus value={query} onChangeText={setQuery} placeholder="品名・メモで探す" style={[s.input, { marginHorizontal: 16, marginBottom: 10 }]} clearButtonMode="while-editing" />
      )}
      <TagBar tags={state.tags} value={tagId} onChange={setTagId} allLabel="すべて" style={{ flexGrow: 0 }} />

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {!state.items.length && (
          <View style={[s.card, { marginTop: 24, gap: 8 }]}>
            <Text style={s.text}>くり返し買う日用品を登録しましょう。</Text>
            <Text style={s.small}>買うたびに記録すると、次に買う日をだいたいで教えてくれます。右上の＋から登録できます。</Text>
          </View>
        )}
        {sections.map(([label, list]) =>
          list.length ? (
            <View key={label}>
              {label ? <Text style={s.h2}>{label}</Text> : <View style={{ height: 12 }} />}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12 }}>
                {list.map((item) => (
                  <Card key={item.id} item={item} left={left(item)} listed={inList(item.id, state.list)} onAdd={() => update((st) => addToList(st, { name: item.name, tagId: item.tagId, memo: '', itemId: item.id }))} />
                ))}
              </View>
            </View>
          ) : null,
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Card({ item, left, listed, onAdd }: { item: Item; left: number; listed: boolean; onAdd: () => void }) {
  const soon = left <= SOON_DAYS;
  return (
    <View style={{ width: '33.33%', padding: 4 }}>
      <Pressable onPress={() => router.push(`/item/${item.id}`)} style={{ backgroundColor: C.card, borderRadius: 14, padding: 8, alignItems: 'center', gap: 6 }}>
        <View>
          <Thumb item={item} name={item.name} size={84} />
          <Text style={{ position: 'absolute', top: -4, left: -4, overflow: 'hidden', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, fontSize: 11, fontWeight: '700', backgroundColor: soon ? C.soon : C.mainSoft, color: soon ? '#fff' : C.main }}>
            {left <= 0 ? '買い時' : `あと${left}日`}
          </Text>
        </View>
        <Text numberOfLines={1} style={{ fontSize: 14, color: C.ink, fontWeight: '600' }}>
          {item.name}
        </Text>
        {listed ? (
          <Text style={[s.small, { paddingVertical: 4 }]}>リストにあり</Text>
        ) : (
          <Pressable onPress={onAdd} hitSlop={6} style={{ backgroundColor: soon ? C.soonSoft : C.bg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: soon ? C.soon : C.main }}>＋リストへ</Text>
          </Pressable>
        )}
      </Pressable>
    </View>
  );
}
