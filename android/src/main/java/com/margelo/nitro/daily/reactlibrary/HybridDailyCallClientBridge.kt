package com.margelo.nitro.daily.reactlibrary

import com.daily.reactlibrary.DailyClientRegistry
import com.daily.reactlibrary.EventSink
import com.daily.reactlibrary.OnceCallback
import com.daily.reactlibrary.DailyRuntime
import com.daily.reactlibrary.startScreenShareFromActivity
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.core.Promise
import org.json.JSONObject
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.coroutines.suspendCoroutine

@DoNotStrip
class HybridDailyCallClientBridge : HybridDailyCallClientBridgeSpec() {
  private val listenerOwner = Any()

  override fun createClient(): Promise<Double> {
    return Promise.async {
      suspendCoroutine { continuation ->
        DailyClientRegistry.postToMain {
          try {
            continuation.resume(DailyClientRegistry.createOnMain().toDouble())
          } catch (error: Exception) {
            continuation.resumeWithException(error)
          }
        }
      }
    }
  }

  override fun destroyClient(clientId: Double) {
    DailyClientRegistry.destroy(clientId.toInt())
  }

  override fun perform(clientId: Double, action: String, payloadJson: String): Promise<String> {
    val payload = if (payloadJson.isBlank()) JSONObject() else JSONObject(payloadJson)
    if (action == "startScreenShare") {
      val activity = DailyRuntime.currentActivity()
      if (activity == null) {
        return Promise.rejected(IllegalStateException("Screen share needs a foreground activity"))
      }
      return Promise.async {
        suspendCoroutine { continuation ->
          val once = OnceCallback { json, error ->
            if (error != null) {
              continuation.resumeWithException(IllegalStateException(error))
            } else {
              continuation.resume(json ?: "{}")
            }
          }
          startScreenShareFromActivity(activity, clientId.toInt(), once::call)
        }
      }
    }
    return Promise.async {
      suspendCoroutine { continuation ->
        val once = OnceCallback { json, error ->
          if (error != null) {
            continuation.resumeWithException(IllegalStateException(error))
          } else {
            continuation.resume(json ?: "{}")
          }
        }
        DailyClientRegistry.perform(clientId.toInt(), action, payload, once::call)
      }
    }
  }

  override fun setEventListener(listener: (event: DailyCallClientEvent) -> Unit) {
    DailyClientRegistry.setEventListener(
      listenerOwner,
      EventSink { clientId, type, payloadJson ->
        listener(
          DailyCallClientEvent(
            clientId = clientId.toDouble(),
            type = type,
            payloadJson = payloadJson,
          ),
        )
      },
    )
  }

  override fun dispose() {
    super.dispose()
    DailyClientRegistry.clearEventListener(listenerOwner)
  }
}
