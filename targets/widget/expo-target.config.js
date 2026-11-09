/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'widget',
  // AltStore は表示名を Apple の App ID 名に使い、日本語だと登録で失敗する（AppleDeveloperError 3009）
  displayName: 'Megurikago Widget',
  // 本体は 16.4 から。コントロール（iOS 18）はコード側で @available 分岐
  deploymentTarget: '16.4',
  colors: {
    $accent: '#2C4A63',
    $widgetBackground: '#EDEFF2',
  },
  entitlements: {
    // 本体と同じ App Group（app.json の ios.entitlements）
    'com.apple.security.application-groups':
      config.ios.entitlements['com.apple.security.application-groups'],
  },
});
