package com.daily.reactlibrary

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.ModuleSpec
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.margelo.nitro.daily.reactlibrary.ReactNativeDailyCoreOnLoad
import com.margelo.nitro.daily.reactlibrary.views.HybridDailyVideoViewManager

class DailyCallClientPackage : BaseReactPackage() {
  init {
    ReactNativeDailyCoreOnLoad.initializeNative()
  }

  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
    if (name == DailyCallClientRuntimeModule.NAME) {
      return DailyCallClientRuntimeModule(reactContext)
    }
    return null
  }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
    return ReactModuleInfoProvider {
      mapOf(
        DailyCallClientRuntimeModule.NAME to ReactModuleInfo(
          DailyCallClientRuntimeModule.NAME,
          DailyCallClientRuntimeModule.NAME,
          false,
          true,
          false,
          true,
        ),
      )
    }
  }

  override fun getViewManagers(reactContext: ReactApplicationContext): List<ModuleSpec> {
    return listOf(ModuleSpec.viewManagerSpec { HybridDailyVideoViewManager() })
  }
}
