import SwiftUI
import WidgetKit

@main
struct MegurikagoWidgets: WidgetBundle {
  var body: some Widget {
    ListWidget()
    VoiceWidget()
    if #available(iOS 18.0, *) {
      VoiceControl()
    }
  }
}
