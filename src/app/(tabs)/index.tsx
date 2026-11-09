import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cycleOf, diffDays, inList, nextDate, realTags, SOON_DAYS, type Item } from '../../logic';
import { addToList, useStore } from '../../store';
import { C, press, RhythmBar, s, smooth, TagBar, Thumb } from '../../ui';

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
      <View style={[s.row, { paddingRight: 20, gap: 16 }]}>
        <Text style={[s.title, { flex: 1 }]}>いつもの</Text>
        <Pressable onPress={() => (smooth(), setQuery(query === undefined ? '' : undefined))} hitSlop={8}>
          <Text style={s.link}>{query === undefined ? '検索' : '閉じる'}</Text>
        </Pressable>
        <Pressable onPress={() => (smooth(), setSort(SORTS[(SORTS.indexOf(sort) + 1) % SORTS.length]))} hitSlop={8}>
          <Text style={s.link}>{sort} ⇅</Text>
        </Pressable>
        <Link href="/item/edit" asChild>
          <Pressable hitSlop={8} accessibilityLabel="登録する">
            <Text style={[s.link, { fontSize: 28, lineHeight: 30 }]}>＋</Text>
          </Pressable>
        </Link>
      </View>
      {query !== undefined && (
        <TextInput autoFocus value={query} onChangeText={setQuery} placeholder="品名・メモで探す" style={[s.input, { marginHorizontal: 16, marginBottom: 12 }]} clearButtonMode="while-editing" />
      )}
      <TagBar tags={realTags(state.tags)} value={tagId} onChange={setTagId} allLabel="すべて" style={{ flexGrow: 0, marginBottom: 4 }} addable />

      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingBottom: 40 }}>
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
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10 }}>
                {list.map((item) => (
                  <Card key={item.id} item={item} left={left(item)} cycle={cycleOf(item, state.purchases)} listed={inList(item.id, state.list)} onAdd={() => update((st) => addToList(st, { name: item.name, tagId: item.tagId, memo: '', itemId: item.id }))} />
                ))}
              </View>
            </View>
          ) : null,
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Card({ item, left, cycle, listed, onAdd }: { item: Item; left: number; cycle: number; listed: boolean; onAdd: () => void }) {
  const soon = left <= SOON_DAYS;
  return (
    <View style={{ width: '50%', padding: 6 }}>
      <Pressable onPress={() => router.push(`/item/${item.id}`)} style={(st) => [s.card, { marginHorizontal: 0, padding: 12, gap: 10 }, press(st)]}>
        <View style={s.row}>
          <Thumb item={item} name={item.name} size={52} />
          <View style={{ flex: 1 }}>
            <Text style={[s.num, { fontSize: 26, fontWeight: '300', letterSpacing: -0.5, color: soon ? C.soon : C.ink }]}>
              {left <= 0 ? '今' : left}
              <Text style={{ fontSize: 12, fontWeight: '500', color: C.sub }}>{left <= 0 ? ' が買い時' : ' 日後'}</Text>
            </Text>
          </View>
        </View>
        <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '600', color: C.ink }}>
          {item.name}
        </Text>
        <RhythmBar progress={1 - left / cycle} soon={soon} />
        {listed ? (
          <Text style={[s.small, { paddingVertical: 3 }]}>リストに入っています</Text>
        ) : (
          <Pressable onPress={onAdd} hitSlop={6} style={(st) => [{ alignSelf: 'flex-start', paddingVertical: 3 }, press(st)]}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: C.main }}>＋ リストへ</Text>
          </Pressable>
        )}
      </Pressable>
    </View>
  );
}
