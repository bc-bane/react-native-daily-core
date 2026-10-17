package com.daily.reactlibrary

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import org.json.JSONObject

class DailyCallClientModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("DailyCallClient")

    Events("DailyCallClientEvent")

    OnCreate {
      val context = appContext.reactContext
      if (context != null) {
        DailyRuntime.attach(context.applicationContext) { appContext.currentActivity }
      }
      DailyClientRegistry.eventSink = EventSink { clientId, type, payloadJson ->
        sendEvent(
          "DailyCallClientEvent",
          mapOf(
            "clientId" to clientId,
            "type" to type,
            "payloadJson" to payloadJson,
          ),
        )
      }
    }

    OnDestroy {
      DailyClientRegistry.destroyAll()
      DailyClientRegistry.eventSink = null
      DailyRuntime.detach()
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode != DailyRuntime.SCREEN_SHARE_REQUEST) {
        return@OnActivityResult
      }
      DailyRuntime.handleScreenShareResult(payload.resultCode, payload.data)
    }

    AsyncFunction("createClient") { promise: Promise ->
      DailyClientRegistry.postToMain {
        try {
          promise.resolve(DailyClientRegistry.createOnMain())
        } catch (error: Exception) {
          promise.reject("E_DAILY", error.message, error)
        }
      }
    }

    Function("destroyClient") { clientId: Int ->
      DailyClientRegistry.destroy(clientId)
    }

    AsyncFunction("perform") { clientId: Int, action: String, payloadJson: String, promise: Promise ->
      val payload = if (payloadJson.isBlank()) JSONObject() else JSONObject(payloadJson)
      if (action == "startScreenShare") {
        val activity = appContext.currentActivity
        if (activity == null) {
          promise.reject("E_NO_ACTIVITY", "Screen share needs a foreground activity", null)
          return@AsyncFunction
        }
        startScreenShareFromActivity(activity, clientId) { json, error ->
          if (error != null) promise.reject("E_DAILY", error, null) else promise.resolve(json ?: "{}")
        }
        return@AsyncFunction
      }
      DailyClientRegistry.perform(clientId, action, payload) { json, error ->
        if (error != null) promise.reject("E_DAILY", error, null) else promise.resolve(json ?: "{}")
      }
    }

    View(DailyVideoHostView::class) {
      Name("DailyVideoView")

      Prop("clientId") { view: DailyVideoHostView, clientId: Int ->
        view.clientId = clientId
        view.refresh()
      }

      Prop("participantId") { view: DailyVideoHostView, participantId: String ->
        view.participantId = participantId
        view.refresh()
      }

      Prop("videoSource") { view: DailyVideoHostView, videoSource: String ->
        view.videoSource = videoSource
        view.refresh()
      }

      Prop("mirror") { view: DailyVideoHostView, mirror: Boolean ->
        view.setMirror(mirror)
      }

      Prop("objectFit") { view: DailyVideoHostView, objectFit: String ->
        view.setFit(objectFit == "contain")
      }
    }
  }
}
