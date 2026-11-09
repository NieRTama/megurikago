import SwiftUI
import WidgetKit

// 色は src/ui.tsx の C と同じ
extension Color {
  static let mgIndigo = Color(red: 0x7A / 255, green: 0x5B / 255, blue: 0x40 / 255)  // #7A5B40 焦げ茶（主色）
  static let mgBrass = Color(red: 0x9E / 255, green: 0x3D / 255, blue: 0x33 / 255)   // #9E3D33 えんじ（もうすぐ）
  static let mgPaper = Color(red: 0xF2 / 255, green: 0xEC / 255, blue: 0xE1 / 255)   // #F2ECE1 生成りの地色
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
