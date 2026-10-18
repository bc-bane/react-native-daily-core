import NitroModules
import UIKit

public class HybridDailyVideoView: HybridDailyVideoViewSpec_base, HybridDailyVideoViewSpec_protocol {
  public typealias ViewType = DailyVideoHost

  private let host = DailyVideoHost(frame: .zero)

  public var view: DailyVideoHost { host }

  public var clientId: Double = 0 {
    didSet { host.clientId = Int(clientId) }
  }

  public var participantId: String = "" {
    didSet { host.participantId = participantId }
  }

  public var videoSource: String = "camera" {
    didSet { host.videoSource = videoSource }
  }

  public var mirror: Bool? = false {
    didSet { host.setMirrored(mirror ?? false) }
  }

  public var objectFit: String? = "cover" {
    didSet { host.setObjectFit(objectFit ?? "cover") }
  }

  public override init() {
    super.init()
    host.clipsToBounds = true
    host.isUserInteractionEnabled = false
  }

  public func afterUpdate() {
    host.refreshTrack()
  }

  public func onDropView() {
    host.clearTrack()
  }
}
