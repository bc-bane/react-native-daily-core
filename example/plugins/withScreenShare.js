const fs = require('fs');
const path = require('path');
const {
  withDangerousMod,
  withEntitlementsPlist,
  withInfoPlist,
  withPodfile,
  withXcodeProject,
} = require('@expo/config-plugins');

const APP_GROUP = 'group.com.dailyexample';
const EXTENSION_BUNDLE_ID = 'com.dailyexample.ScreenCaptureExtension';
const TARGET_NAME = 'ScreenCaptureExtension';

function withScreenShare(config) {
  config = withInfoPlist(config, config => {
    config.modResults.RTCAppGroupIdentifier = APP_GROUP;
    config.modResults.DailyScreenCaptureExtensionBundleIdentifier = EXTENSION_BUNDLE_ID;
    return config;
  });
  config = withEntitlementsPlist(config, config => {
    const key = 'com.apple.security.application-groups';
    const current = config.modResults[key] ?? [];
    if (!current.includes(APP_GROUP)) {
      current.push(APP_GROUP);
    }
    config.modResults[key] = current;
    return config;
  });
  config = withDangerousMod(config, [
    'ios',
    config => {
      writeExtensionFiles(config.modRequest.platformProjectRoot);
      return config;
    },
  ]);
  config = withXcodeProject(config, config => {
    ensureExtensionTarget(config.modResults);
    return config;
  });
  config = withPodfile(config, config => {
    config.modResults.contents = podfileWithExtension(config.modResults.contents);
    return config;
  });
  return config;
}

function writeExtensionFiles(iosRoot) {
  const directory = path.join(iosRoot, TARGET_NAME);
  fs.mkdirSync(directory, {recursive: true});
  fs.writeFileSync(path.join(directory, 'SampleHandler.swift'), sampleHandlerSource());
  fs.writeFileSync(path.join(directory, `${TARGET_NAME}-Info.plist`), extensionInfoPlist());
  fs.writeFileSync(path.join(directory, `${TARGET_NAME}.entitlements`), extensionEntitlements());
}

function ensureExtensionTarget(project) {
  const objects = project.hash.project.objects;
  objects.PBXTargetDependency = objects.PBXTargetDependency || {};
  objects.PBXContainerItemProxy = objects.PBXContainerItemProxy || {};
  let targetUuid = extensionTargetUuid(project);
  if (!targetUuid) {
    const created = project.addTarget(TARGET_NAME, 'app_extension', TARGET_NAME, EXTENSION_BUNDLE_ID);
    targetUuid = created.uuid;
    const group = project.addPbxGroup(
      [`${TARGET_NAME}-Info.plist`, `${TARGET_NAME}.entitlements`],
      TARGET_NAME,
      TARGET_NAME,
    );
    project.addToPbxGroup(group.uuid, project.getFirstProject().firstProject.mainGroup);
    project.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', targetUuid);
    project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', targetUuid);
    project.addSourceFile('SampleHandler.swift', {target: targetUuid}, group.uuid);
    const team = developmentTeam(project);
    const configurations = project.pbxXCBuildConfigurationSection();
    Object.keys(configurations).forEach(key => {
      const item = configurations[key];
      if (typeof item === 'string' || item.buildSettings?.PRODUCT_NAME !== `"${TARGET_NAME}"`) {
        return;
      }
      Object.assign(item.buildSettings, {
        APPLICATION_EXTENSION_API_ONLY: 'YES',
        CODE_SIGN_ENTITLEMENTS: `"${TARGET_NAME}/${TARGET_NAME}.entitlements"`,
        CODE_SIGN_STYLE: 'Automatic',
        CURRENT_PROJECT_VERSION: '1',
        GENERATE_INFOPLIST_FILE: 'NO',
        INFOPLIST_FILE: `"${TARGET_NAME}/${TARGET_NAME}-Info.plist"`,
        IPHONEOS_DEPLOYMENT_TARGET: '16.4',
        MARKETING_VERSION: '1.0',
        PRODUCT_BUNDLE_IDENTIFIER: `"${EXTENSION_BUNDLE_ID}"`,
        SWIFT_VERSION: '5.9',
        TARGETED_DEVICE_FAMILY: '"1,2"',
        ...(team ? {DEVELOPMENT_TEAM: team} : {}),
      });
    });
  }
  const appTarget = project.getFirstTarget().uuid;
  const app = objects.PBXNativeTarget[appTarget];
  const alreadyDepends = (app.dependencies || []).some(item => {
    const dependency = objects.PBXTargetDependency[item.value];
    return dependency && dependency.target === targetUuid;
  });
  if (!alreadyDepends) {
    project.addTargetDependency(appTarget, [targetUuid]);
  }
}

function extensionTargetUuid(project) {
  const targets = project.pbxNativeTargetSection();
  for (const key of Object.keys(targets)) {
    if (String(key).endsWith('_comment')) {
      continue;
    }
    const name = String(targets[key].name || '').replace(/"/g, '');
    if (name === TARGET_NAME) {
      return key;
    }
  }
  return null;
}

function developmentTeam(project) {
  const configurations = project.pbxXCBuildConfigurationSection();
  for (const key of Object.keys(configurations)) {
    const team = configurations[key]?.buildSettings?.DEVELOPMENT_TEAM;
    if (team && team !== '""') {
      return team;
    }
  }
  return null;
}

function podfileWithExtension(contents) {
  if (contents.includes(`target '${TARGET_NAME}'`)) {
    return contents;
  }
  return `${contents}
target '${TARGET_NAME}' do
  use_frameworks! :linkage => podfile_properties['ios.useFrameworks'].to_sym if podfile_properties['ios.useFrameworks']
  use_frameworks! :linkage => ENV['USE_FRAMEWORKS'].to_sym if ENV['USE_FRAMEWORKS']
  pod 'DailySystemBroadcast', '0.40.0'
end
`;
}

function sampleHandlerSource() {
  return `import DailySystemBroadcast

class SampleHandler: DailyBroadcastSampleHandler {
  override init() {
    super.init(appGroupIdentifier: "${APP_GROUP}")
  }
}
`;
}

function extensionInfoPlist() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>$(DEVELOPMENT_LANGUAGE)</string>
  <key>CFBundleDisplayName</key>
  <string>Daily Screen Share</string>
  <key>CFBundleExecutable</key>
  <string>$(EXECUTABLE_NAME)</string>
  <key>CFBundleIdentifier</key>
  <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>$(PRODUCT_NAME)</string>
  <key>CFBundlePackageType</key>
  <string>XPC!</string>
  <key>CFBundleShortVersionString</key>
  <string>$(MARKETING_VERSION)</string>
  <key>CFBundleVersion</key>
  <string>$(CURRENT_PROJECT_VERSION)</string>
  <key>NSExtension</key>
  <dict>
    <key>NSExtensionPointIdentifier</key>
    <string>com.apple.broadcast-services-upload</string>
    <key>NSExtensionPrincipalClass</key>
    <string>$(PRODUCT_MODULE_NAME).SampleHandler</string>
    <key>RPBroadcastProcessMode</key>
    <string>RPBroadcastProcessModeSampleBuffer</string>
  </dict>
</dict>
</plist>
`;
}

function extensionEntitlements() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.application-groups</key>
  <array>
    <string>${APP_GROUP}</string>
  </array>
</dict>
</plist>
`;
}

module.exports = withScreenShare;
module.exports.writeExtensionFiles = writeExtensionFiles;
module.exports.ensureExtensionTarget = ensureExtensionTarget;
module.exports.podfileWithExtension = podfileWithExtension;
