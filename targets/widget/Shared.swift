import SwiftUI
import WidgetKit

// 色は src/ui.tsx の C と同じ
extension Color {
  static let mgIndigo = Color(red: 0x2C / 255, green: 0x4A / 255, blue: 0x63 / 255)  // #2C4A63 藍
  static let mgBrass = Color(red: 0xA9 / 255, green: 0x81 / 255, blue: 0x2F / 255)   // #A9812F 真鍮
  static let mgPaper = Color(red: 0xED / 255, green: 0xEF / 255, blue: 0xF2 / 255)   // #EDEFF2 地色
  static let mgInk = Color(red: 0x1E / 255, green: 0x27 / 255, blue: 0x33 / 255)
}

/// App Group 名: AltStore / SideStore が書く ALTAppGroups の先頭（ウィジェット自身 → 親アプリ）→ なければ既定。
/// 本体側（modules/megurikago-native）にも同じ関数がある。変えるときは両方そろえる。
func resolveAppGroup() -> String {
  // .appex は <app>/PlugIns/<appex> にあるので、2つ上が親アプリ
  let parent = Bundle(url: Bundle.main.bundleURL.deletingLastPathComponent().deletingLastPathComponent())
  for b in [Bundle.main, parent] {
    if let groups = b?.object(forInfoDictionaryKey: "ALTAppGroups") as? [String], let first = groups.first {
      return first
    }
  }
  return "group.com.niertama.megurikago"
}

struct WidgetItem: Decodable {
  let name: String
  let store: String?
}

struct WidgetData: Decodable {
  let items: [WidgetItem]
  let count: Int
  let updatedAt: String
}

func loadWidgetData() -> WidgetData? {
  guard let json = UserDefaults(suiteName: resolveAppGroup())?.string(forKey: "widget"),
        let data = json.data(using: .utf8) else { return nil }
  return try? JSONDecoder().decode(WidgetData.self, from: data)
}

extension View {
  /// iOS 17 以上は containerBackground、16 は background
  @ViewBuilder
  func megurikagoBackground(_ color: Color) -> some View {
    if #available(iOS 17.0, *) {
      self.containerBackground(color, for: .widget)
    } else {
      self.background(color)
    }
  }
}
