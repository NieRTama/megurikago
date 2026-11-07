/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'widget',
  displayName: 'めぐりかご',
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
