import SwiftUI
import WidgetKit

struct VoiceEntry: TimelineEntry {
  let date: Date
}

struct VoiceProvider: TimelineProvider {
  func placeholder(in context: Context) -> VoiceEntry { VoiceEntry(date: Date()) }
  func getSnapshot(in context: Context, completion: @escaping (VoiceEntry) -> Void) {
    completion(VoiceEntry(date: Date()))
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<VoiceEntry>) -> Void) {
    completion(Timeline(entries: [VoiceEntry(date: Date())], policy: .never))
  }
}

struct VoiceView: View {
  @Environment(\.widgetFamily) var family

  var body: some View {
    Group {
      if family == .accessoryCircular {
        ZStack {
          AccessoryWidgetBackground()
          Image(systemName: "mic.fill").font(.system(size: 22, weight: .semibold))
        }
      } else {
        VStack(spacing: 8) {
          Image(systemName: "mic.fill").font(.system(size: 34, weight: .semibold)).foregroundColor(.mgBrass)
          Text("話して入れる").font(.system(size: 14, weight: .semibold)).foregroundColor(.mgIndigo)
        }
      }
    }
    .widgetURL(URL(string: "megurikago://add?voice=1"))
    .megurikagoBackground(.mgPaper)
  }
}

struct VoiceWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "MegurikagoVoice", provider: VoiceProvider()) { _ in
      VoiceView()
    }
    .configurationDisplayName("話して入れる")
    .description("タップすると声で品を入れられます。")
    .supportedFamilies([.systemSmall, .accessoryCircular])
  }
}
