// いらすとや（https://www.irasutoya.com/）の画像を取ってきて assets/irasutoya/ に置き、
// 品名→画像の対応表 src/icons.generated.ts を作る。npm install / npm ci のたびに postinstall で動く。
// 規約で素材の再配布ができないため、画像も対応表もリポジトリには入れない（.gitignore）。
// 取れなかった画像は表から外すだけで、失敗してもインストールは止めない（その品は頭文字表示になる）。
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const B = 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/';
// [ファイル名, 画像URLの固有部分, 品名に含まれていたら使う言葉…]
const ICONS = [
  ['toilet_paper', 'AVvXsEjivDPDJeks1SLXSwBZ6mrvd6vdYf9Lm_u-kx-1KwfmBs8sdUaFHrSCRap-Z9vfa4wckF_hf43knxbLHjbT0D8rUHvvwOiiXBUWh98OkdlAbzr_lUEQZe_7e_IBZXxwJFDLsirYs6K7A6C8', 'トイレットペーパー', 'トイペ'],
  ['tissue', 'AVvXsEgtAOOTS9CAno1RIuWZN4sorJqURpq0CfxCwpu1FxWG5_AncIefQQ7Rs71ZUEiHz3kRswDd9it_CtXntzzgXjmLyrhyZhTm2cVLZqnGP5RsMPBy7-HwFWsJ2irQOyfqCb8gcjMgS5v-6HD-', 'ティッシュ'],
  ['drink_milk_pack', 'AVvXsEj6Kw9nxhMhbvZv9Qdmtu-QLqCBtUUfgrf1FuBkR22805MEQove4mzB_UfFrH4JCfCRzFzUNRF6EShMSaoqlnbXXfsR2Ss7WWYIRxRroYcIorl9-ac5Z2qhtzMlL7lXjg026chNiAIcDJh-', '牛乳', 'ミルク'],
  ['tamago_pack', 'AVvXsEi35mKKNNLDfWd81HWiaJXkVRoIBSQct7b8wsjhFPFOdYQvx4fnoUxppzdOMTU_J7aatl089X1fQa-YFqQAYuAcK3ECdQNZwBibg0IT848CUPMVn7iC3865uKHa-fqSIguAb9ZHi8Whzh0', '卵', 'たまご', '玉子'],
  ['bread_syokupan', 'AVvXsEgEVwmsSjgvzI4cK9rT_R781js3ZPl0vGi07I81fl4us3KxMIxG08-rbciiUUE-Auc-_K4FUZ_EpP1jppY7_aYl6mPaNee1qmaF8A_Go8AqFBnTRJIV8nR3aYykw52aFnEyK1Q4TjMoDOIU', '食パン', 'パン'],
  ['food_kome_pack_big', 'AVvXsEjbF19T-Tr_BCfBRA2msvL_Y1N5HAdEtZQ2y4qndHhP8UI2lRpUuc5uCOiZSWf7mMUEQyalkSOLPBlvmQ4WCCw2kK9S8vpZkK1F1346DwmGeYK_M0zxwCxFSkkjwI_QsWe3bWhjeowsXnIu', '米', 'こめ'],
  ['sentaku_senzai', 'AVvXsEhnuugkn6zMbgciWKx3wd6ydPAiTgsohKlpfP1WObmoa0K9wC9LbJmVLWJcBwsWv3ZOqZsJtb8XeV3IJIMOVm34xwwP3FR5MATcDihy4Fe5IHGMj1iQuvwdV48cJrgcmEOEyaaN_aqnWMs', '洗濯洗剤', '洗剤'],
  ['senzai_syokki', 'AVvXsEgufb7X_4rb6flfcCOBDUzULzI7KtdA8ZEnse6KMlnvVk_AmEjMxioRRMJdkBmZq5VsLLQpEc5-2YLmXtl2slVCt1ElWF4BQYWUUhgwEUOqU1d3gIad3yaaxliuJKWquBG-9MCz34JFWyet', '食器用洗剤', '食器洗剤', '台所用洗剤'],
  ['ofuro_shampoo', 'AVvXsEhyAkyST26cI6Ss_Lm6wWbFkkUCNhRiiIHIrxrUpEYTsox64IeCuKe_WqIW606prYYinVM2xCfOuDoldi7dL9E9Er9QFswIUtQCkwM0n9vd67CV6LuaOy4sost4asVcSLXey04n7hC8OgK_', 'シャンプー', 'リンス', 'コンディショナー', 'ボディソープ'],
  ['hamigakiko', 'AVvXsEiLkxPgBvq4XmdCP3eM50TTlQTDlw0GnzgXepWJSHKv7FY_s0gBV4U1gPoRQDYynU62Q2t8nmtqNVUmm5UkoAsxuiTpwyGgCRjFOpUTn0309zK8UZ-5cM_ujLTeVyL753eHAN1Hx5xrgPH2', '歯みがき粉', '歯磨き粉', 'はみがき粉', '歯磨き'],
  ['haburashi', 'AVvXsEgROkpaMzdY8y-HYajGtgfRNOJoNJYRaNGA1N88L6v2b4omwesQxBSHpGFQTMtA24yWbpoldNwhBvplBmMzcrVDQUse-eKUjvS36ja0XG3jWF8GO4YAVzKHWvUUvrjh1R-UH2a8ppiXaPs', '歯ブラシ'],
  ['gomibukuro_single', 'AVvXsEi7gulaBoH6lc2RGazycciThhCmEX2x0N5uSvh_sxtQv84twST_GLanD1VN1AfzC3wuFc1_vPQNYBc4bBJgPP2lQp7cUwzDkVjuaiPzTelpNCoXQp-dgYrtZPmrUznfeQsF7yUS55N0kJq3', 'ゴミ袋', 'ごみ袋'],
  ['cafe_coffee_bag', 'AVvXsEgVNNtyOcuMtS5LE9wIpRkJT_Rilu1nOSszr-tXZrIzc5acV3O8t0CAWPQVPAGPngq_lrHHsk-HnLxhQebWrQFFZp9F4-_DEzSG1ugDLiqhOLVZx6OJeVNnGZvgaB3hXTGZII0qRphdOKo', 'コーヒー'],
  ['food_nattou_pack', 'AVvXsEhjEuCXHd44blL5UQ0kP3UcGt7ZIKQ6CIdm5QJmVY0rI3bnb4436XLkYsbHu3D3Gb_QCz3oI4O7WjyumexfkcPlWkm51ceH3AXJjntWStz5fDybvIGYKj_u4NnQS1s2AsczpZCEUhFdons', '納豆'],
  ['food_toufu_pack', 'AVvXsEipn9Pa6hVNUczFoEumJceeGQau3OPEBYrNbJywEjYapVhTyvrTT_NtioQLrqcVM7hIYZSzl7iUzcvsbA-6OC36k4NN3IrSwubowRX7l46rEMrwVCvAt22fiebUKsiA_LvDZG6SklQcJJja', '豆腐', 'とうふ'],
  ['bousai_denchi', 'AVvXsEhpVgnjkQuGbd5cCZKcjeTbgp_wwHLCsohIYCrdsvaGBi1Y1xlE2lLvijOUqyQXJvxY2XTmlHnQECUya4Pec3G0f1LBx6cANtdEwIVMAqqpMdWh7SQSQXaLS6vrC4v_uZ57evdwQaxHLv8', '電池'],
  ['sentaku_junanzai', 'AVvXsEjAOtL1Y4RvM9vw08kQIJCL7nZJt6-7pyKI3NNsR9-92HGckFmMDT7qZOK40ihLJn54E6liVextL8WbUuMQScYnScIldocLD0InukCEkVKf0Fv-6QFkAUANvI49r-XqUDG-I7O6gsEHkxA', '柔軟剤'],
  ['sekken_hand_soap_bottle', 'AVvXsEiZhT1OHyz3ecWku0YSfBXPYhn9WjmFJcpbsvN7YBGvZzSORKstM1bRgSWhj2Q3bjjpfh22bHvNjC0r2-l3el8Vlc5pYBB-3TTVAKXq0igoxmPkmRUZ3BPHyo22ycd55_-UmaqdqO85UYGN', 'ハンドソープ', '石鹸', 'せっけん'],
  ['cooking_kitchen_paper_pack', 'AVvXsEgctpJHLfrMOyhcclgqEFlm4WwdIsvxXBjfKA4XOxttUm3V8nGt7oFc9pRnzftdpLAGwFE-Gs4SsDR7xArADdEQDDPcWTDXjYjkGY8_E0WJQpUGNMI4qXO97bu4C1_O2BdrbAVOL112rvfb', 'キッチンペーパー'],
  ['cooking_wrap', 'AVvXsEjzxM0gMEOc89vzO-FlU73fC5gdTAPP1QwFph_5Yy5Ic36hgIOKWkALSFQ0kLl8SuiZIHPBMwkcn6KmjIVtK0INUs3UnEoijWXhNud8mSTzQ2aMuhnLN-hk4mrrTCO519Z3PTHsroWjW1Zj', 'ラップ'],
];

const dir = new URL('../assets/irasutoya/', import.meta.url);
mkdirSync(dir, { recursive: true });
const ok = [];
for (const [file, key, ...words] of ICONS) {
  const dest = new URL(`${file}.png`, dir);
  try {
    if (!existsSync(dest)) {
      const res = await fetch(`${B}${key}/s400/${file}.png`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    }
    ok.push(`  [${JSON.stringify(words)}, require('../assets/irasutoya/${file}.png')],`);
  } catch (e) {
    console.warn(`fetch-icons: ${file} を取得できませんでした (${e.message})`);
  }
}
writeFileSync(
  new URL('../src/icons.generated.ts', import.meta.url),
  `// scripts/fetch-icons.mjs が作るファイル（手で編集しない・コミットしない）\nexport const ICONS: [string[], number][] = [\n${ok.join('\n')}\n];\n`,
);
console.log(`fetch-icons: ${ok.length}/${ICONS.length} 点`);
