import SwiftUI
import WidgetKit

struct ListEntry: TimelineEntry {
  let date: Date
  let data: WidgetData?
}

struct ListProvider: TimelineProvider {
  func placeholder(in context: Context) -> ListEntry {
    ListEntry(
      date: Date(),
      data: WidgetData(items: [WidgetItem(name: "牛乳", store: nil), WidgetItem(name: "卵", store: nil)], count: 2, updatedAt: "")
    )
  }

  func getSnapshot(in context: Context, completion: @escaping (ListEntry) -> Void) {
    completion(ListEntry(date: Date(), data: loadWidgetData()))
  }

  // 更新は本体が setWidgetData で reloadAllTimelines を呼んだときだけ
  func getTimeline(in context: Context, completion: @escaping (Timeline<ListEntry>) -> Void) {
    completion(Timeline(entries: [ListEntry(date: Date(), data: loadWidgetData())], policy: .never))
  }
}

struct ListView: View {
  let entry: ListEntry
  @Environment(\.widgetFamily) var family

  private var limit: Int { family == .systemMedium ? 6 : 4 }

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      if let data = entry.data, !data.items.isEmpty {
        HStack(alignment: .firstTextBaseline) {
          Text("買うもの").font(.system(size: 13, weight: .semibold)).foregroundColor(.mgIndigo)
          Spacer()
          Text("\(data.count)").font(.system(size: 15, weight: .bold)).foregroundColor(.mgBrass)
        }
        ForEach(Array(data.items.prefix(limit).enumerated()), id: \.offset) { _, item in
          HStack(spacing: 6) {
            Circle().fill(Color.mgBrass).frame(width: 5, height: 5)
            Text(item.name).font(.system(size: 14)).foregroundColor(.mgInk).lineLimit(1)
          }
        }
        if data.count > limit {
          Text("ほか \(data.count - limit) 件").font(.system(size: 11)).foregroundColor(.mgIndigo.opacity(0.7))
        }
        Spacer(minLength: 0)
      } else {
        Text("買うもの").font(.system(size: 13, weight: .semibold)).foregroundColor(.mgIndigo)
        Spacer()
        Text("アプリを開くと表示されます").font(.system(size: 12)).foregroundColor(.mgIndigo.opacity(0.7))
        Spacer()
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .widgetURL(URL(string: "megurikago://list"))
    .megurikagoBackground(.mgPaper)
  }
}

struct ListWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "MegurikagoList", provider: ListProvider()) { entry in
      ListView(entry: entry)
    }
    .configurationDisplayName("買うもの")
    .description("まだ買っていない品を並べます。")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}
