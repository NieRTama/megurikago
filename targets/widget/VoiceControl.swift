import AppIntents
import SwiftUI
import WidgetKit

// コントロールセンターに置ける。アクションボタンにも割り当てられる（iOS 18 以上）
@available(iOS 18.0, *)
struct VoiceControl: ControlWidget {
  var body: some ControlWidgetConfiguration {
    StaticControlConfiguration(kind: "MegurikagoVoiceControl") {
      ControlWidgetButton(action: OpenURLIntent(URL(string: "megurikago://add?voice=1")!)) {
        Label("話して入れる", systemImage: "mic.fill")
      }
    }
    .displayName("話して入れる")
    .description("めぐりかごを開いて、声で品を入れます。")
  }
}
