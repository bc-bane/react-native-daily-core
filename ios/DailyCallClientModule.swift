import ExpoModulesCore

public class DailyCallClientModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DailyCallClient")

    Events("DailyCallClientEvent")

    OnCreate {
      DispatchQueue.main.async {
        MainActor.assumeIsolated {
          DailyClientRegistry.shared.eventSink = { [weak self] clientId, type, payloadJson in
            self?.sendEvent("DailyCallClientEvent", [
              "clientId": clientId.intValue,
              "type": type as String,
              "payloadJson": payloadJson as String,
            ])
          }
        }
      }
    }

    OnDestroy {
      DispatchQueue.main.async {
        MainActor.assumeIsolated {
          DailyClientRegistry.shared.eventSink = nil
          DailyClientRegistry.shared.destroyAll()
        }
      }
    }

    AsyncFunction("createClient") { (promise: Promise) in
      DispatchQueue.main.async {
        let clientId = MainActor.assumeIsolated {
          DailyClientRegistry.shared.createOnMain()
        }
        promise.resolve(clientId)
      }
    }

    Function("destroyClient") { (clientId: Int) in
      DispatchQueue.main.async {
        MainActor.assumeIsolated {
          DailyClientRegistry.shared.destroy(clientId)
        }
      }
    }

    AsyncFunction("perform") { (clientId: Int, action: String, payloadJson: String, promise: Promise) in
      DispatchQueue.main.async {
        MainActor.assumeIsolated {
          DailyClientRegistry.shared.perform(clientId, action: action, payloadJson: payloadJson) { json, error in
            if let error {
              promise.reject("E_DAILY", error)
            } else {
              promise.resolve(json ?? "{}")
            }
          }
        }
      }
    }

    View(DailyVideoExpoView.self) {
      ViewName("DailyVideoView")

      Prop("clientId") { (view: DailyVideoExpoView, clientId: Int) in
        view.host.clientId = clientId
        view.host.refreshTrack()
      }

      Prop("participantId") { (view: DailyVideoExpoView, participantId: String) in
        view.host.participantId = participantId
        view.host.refreshTrack()
      }

      Prop("videoSource") { (view: DailyVideoExpoView, videoSource: String) in
        view.host.videoSource = videoSource
        view.host.refreshTrack()
      }

      Prop("mirror") { (view: DailyVideoExpoView, mirror: Bool) in
        view.host.setMirrored(mirror)
      }

      Prop("objectFit") { (view: DailyVideoExpoView, objectFit: String) in
        view.host.setObjectFit(objectFit)
      }
    }
  }
}

public class DailyVideoExpoView: ExpoView {
  let host = DailyVideoHost(frame: .zero)

  public required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    isUserInteractionEnabled = false
    host.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    addSubview(host)
  }

  public override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    nil
  }

  public override func layoutSubviews() {
    super.layoutSubviews()
    host.frame = bounds
  }
}
