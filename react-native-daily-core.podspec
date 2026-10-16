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
  s.platforms    = { :ios => "14.0" }
  s.source       = { :git => "https://github.com/bc-bane/react-native-daily-core.git", :tag => "#{s.version}" }
  s.source_files = "ios/**/*.{h,m,mm,swift}"
  s.pod_target_xcconfig = {
    "DEFINES_MODULE" => "YES",
    "SWIFT_VERSION" => "5.0"
  }

  s.dependency "Daily", "0.40.0"
  s.dependency "DailySystemBroadcast", "0.40.0"

  install_modules_dependencies(s)
end
