require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "react-native-daily-core"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.description  = package["description"]
  s.homepage     = "https://github.com/bc-bane/react-native-daily-core"
  s.license      = "BSD-2-Clause"
  s.authors      = { "react-native-daily-core" => "https://github.com/bc-bane/react-native-daily-core" }
  s.platforms    = { :ios => "16.4" }
  # Must match nitro.json iosModuleName so the Swift module and the clang module agree.
  s.module_name  = "ReactNativeDailyCore"
  s.source       = { :git => "https://github.com/bc-bane/react-native-daily-core.git", :tag => "#{s.version}" }
  s.source_files = "ios/**/*.{h,m,mm,swift}"
  s.static_framework = true
  s.swift_version = "5.9"
  s.pod_target_xcconfig = {
    "DEFINES_MODULE" => "YES",
    # Nitrogen's generated bridge includes ReactNativeDailyCore-Swift.h.
    "PRODUCT_MODULE_NAME" => "ReactNativeDailyCore",
  }

  s.dependency "React-Core"
  s.dependency "Daily", "0.40.0"
  s.dependency "DailySystemBroadcast", "0.40.0"

  load "nitrogen/generated/ios/ReactNativeDailyCore+autolinking.rb"
  add_nitrogen_files(s)
end
