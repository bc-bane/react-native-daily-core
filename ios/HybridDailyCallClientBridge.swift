import Foundation
import NitroModules

public class HybridDailyCallClientBridge: HybridDailyCallClientBridgeSpec_base, HybridDailyCallClientBridgeSpec_protocol {
  private let listenerOwner = UUID()

  public override init() {
    super.init()
  }

  public func createClient() throws -> Promise<Double> {
    Promise.async {
      await MainActor.run {
        Double(DailyClientRegistry.shared.createOnMain())
      }
    }
  }

  public func destroyClient(clientId: Double) throws {
    DispatchQueue.main.async {
      MainActor.assumeIsolated {
        DailyClientRegistry.shared.destroy(Int(clientId))
      }
    }
  }

  public func perform(clientId: Double, action: String, payloadJson: String) throws -> Promise<String> {
    Promise.async {
      try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<String, Error>) in
        let once = OnceResume { json, error in
          if let error {
            continuation.resume(throwing: RuntimeError.error(withMessage: error))
          } else {
            continuation.resume(returning: json ?? "{}")
          }
        }
        DispatchQueue.main.async {
          MainActor.assumeIsolated {
            DailyClientRegistry.shared.perform(Int(clientId), action: action, payloadJson: payloadJson) { json, error in
              once.call(json, error)
            }
          }
        }
      }
    }
  }

  public func setEventListener(listener: @escaping (DailyCallClientEvent) -> Void) throws {
    let owner = listenerOwner
    let assign = {
      MainActor.assumeIsolated {
        DailyClientRegistry.shared.setEventListener(owner: owner) { clientId, type, payloadJson in
          listener(
            DailyCallClientEvent(
              clientId: clientId.doubleValue,
              type: type as String,
              payloadJson: payloadJson as String
            )
          )
        }
      }
    }
    if Thread.isMainThread {
      assign()
    } else {
      DispatchQueue.main.async(execute: assign)
    }
  }

  public func setAudioLevelListener(listener: @escaping (Double, Double, String) -> Void) throws {
    let owner = listenerOwner
    let assign = {
      MainActor.assumeIsolated {
        DailyClientRegistry.shared.setAudioLevelListener(owner: owner) { clientId, audioLevel, participantId in
          listener(clientId.doubleValue, audioLevel.doubleValue, participantId as String)
        }
      }
    }
    if Thread.isMainThread {
      assign()
    } else {
      DispatchQueue.main.async(execute: assign)
    }
  }

  public func setRemoteAudioLevelsListener(listener: @escaping (Double, String) -> Void) throws {
    let owner = listenerOwner
    let assign = {
      MainActor.assumeIsolated {
        DailyClientRegistry.shared.setRemoteAudioLevelsListener(owner: owner) { clientId, levelsJson in
          listener(clientId.doubleValue, levelsJson as String)
        }
      }
    }
    if Thread.isMainThread {
      assign()
    } else {
      DispatchQueue.main.async(execute: assign)
    }
  }

  public func dispose() {
    let owner = listenerOwner
    let clear = {
      MainActor.assumeIsolated {
        DailyClientRegistry.shared.clearEventListener(owner: owner)
        DailyClientRegistry.shared.clearAudioLevelListener(owner: owner)
      }
    }
    if Thread.isMainThread {
      clear()
    } else {
      DispatchQueue.main.async(execute: clear)
    }
  }
}

private final class OnceResume: @unchecked Sendable {
  private let lock = NSLock()
  private var resume: ((String?, String?) -> Void)?

  init(_ resume: @escaping (String?, String?) -> Void) {
    self.resume = resume
  }

  func call(_ json: String?, _ error: String?) {
    lock.lock()
    let resume = self.resume
    self.resume = nil
    lock.unlock()
    resume?(json, error)
  }
}
