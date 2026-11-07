import CoreImage
import ExpoModulesCore
import ImageIO
import UIKit
import Vision
import WidgetKit

/// App Group 名: AltStore / SideStore が書く ALTAppGroups の先頭 → なければ既定。
/// ウィジェット側（targets/widget）にも同じ関数がある。変えるときは両方そろえる。
private func resolveAppGroup() -> String {
  if let groups = Bundle.main.object(forInfoDictionaryKey: "ALTAppGroups") as? [String],
     let first = groups.first {
    return first
  }
  return "group.com.niertama.megurikago"
}

private let maxEdge: CGFloat = 512

public final class MegurikagoNativeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MegurikagoNative")

    // 被写体を切り抜いた透過 PNG を Documents に保存してファイル名を返す。できなければ nil
    AsyncFunction("liftSubject") { (srcUri: String) -> String? in
      guard #available(iOS 17.0, *) else { return nil }
      return Self.lift(srcUri: srcUri)
    }

    // JSON 文字列を App Group の UserDefaults（キー widget）に書いてウィジェットを更新
    Function("setWidgetData") { (json: String) in
      UserDefaults(suiteName: resolveAppGroup())?.set(json, forKey: "widget")
      WidgetCenter.shared.reloadAllTimelines()
    }
  }

  @available(iOS 17.0, *)
  private static func lift(srcUri: String) -> String? {
    let url: URL
    if let u = URL(string: srcUri), u.scheme != nil { url = u } else { url = URL(fileURLWithPath: srcUri) }
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }

    // EXIF の向きを反映した縮小画像を作る（向きは画素に焼き込むので Vision には .up で渡す）
    let thumbOptions: [CFString: Any] = [
      kCGImageSourceCreateThumbnailFromImageAlways: true,
      kCGImageSourceCreateThumbnailWithTransform: true,
      kCGImageSourceThumbnailMaxPixelSize: 1536,
    ]
    guard let upright = CGImageSourceCreateThumbnailAtIndex(source, 0, thumbOptions as CFDictionary) else { return nil }

    do {
      let request = VNGenerateForegroundInstanceMaskRequest()
      let handler = VNImageRequestHandler(cgImage: upright, orientation: .up, options: [:])
      try handler.perform([request])
      guard let observation = request.results?.first, !observation.allInstances.isEmpty else { return nil }

      let buffer = try observation.generateMaskedImage(
        ofInstances: observation.allInstances,
        from: handler,
        croppedToInstancesExtent: true
      )
      let ci = CIImage(cvPixelBuffer: buffer)
      let context = CIContext()
      guard let cut = context.createCGImage(ci, from: ci.extent) else { return nil }

      // 長辺 512px に縮小し、正方形の透明キャンバスの中央に置く
      let w = CGFloat(cut.width), h = CGFloat(cut.height)
      let scale = min(maxEdge / w, maxEdge / h, 1)
      let size = CGSize(width: w * scale, height: h * scale)
      let format = UIGraphicsImageRendererFormat()
      format.scale = 1
      format.opaque = false
      let canvas = CGSize(width: maxEdge, height: maxEdge)
      let image = UIGraphicsImageRenderer(size: canvas, format: format).image { _ in
        UIImage(cgImage: cut).draw(in: CGRect(
          x: (canvas.width - size.width) / 2,
          y: (canvas.height - size.height) / 2,
          width: size.width,
          height: size.height
        ))
      }
      guard let png = image.pngData() else { return nil }

      let name = "\(UUID().uuidString).png"
      let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
      try png.write(to: docs.appendingPathComponent(name), options: .atomic)
      return name
    } catch {
      return nil
    }
  }
}
