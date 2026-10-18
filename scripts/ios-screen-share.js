const fs = require('fs');
const path = require('path');
const plist = require('plist');
const xcode = require('xcode');

const TARGET_NAME = 'DailyScreenCaptureExtension';
const BROADCAST_POD_VERSION = '0.40.0';

function screenShareIdentity(bundleId) {
  if (!bundleId || bundleId.includes('$')) {
    throw new Error(
      'The iOS app target needs a concrete PRODUCT_BUNDLE_IDENTIFIER before screen share can be set up.',
    );
  }
  return {
    bundleId,
    appGroup: `group.${bundleId}`,
    extensionBundleId: `${bundleId}.ScreenCaptureExtension`,
    targetName: TARGET_NAME,
  };
}

function writeExtensionFiles(iosRoot, identity) {
  const directory = path.join(iosRoot, identity.targetName);
  fs.mkdirSync(directory, {recursive: true});
  fs.writeFileSync(path.join(directory, 'SampleHandler.swift'), sampleHandlerSource(identity));
  fs.writeFileSync(
    path.join(directory, `${identity.targetName}-Info.plist`),
    extensionInfoPlist(),
  );
  fs.writeFileSync(
    path.join(directory, `${identity.targetName}.entitlements`),
    extensionEntitlements(identity),
  );
}

function ensureExtensionTarget(project, identity) {
  const objects = project.hash.project.objects;
  objects.PBXTargetDependency = objects.PBXTargetDependency || {};
  objects.PBXContainerItemProxy = objects.PBXContainerItemProxy || {};
  ensureProjectSections(project);
  let targetUuid = extensionTargetUuid(project, identity.targetName);
  if (!targetUuid) {
    const created = project.addTarget(
      identity.targetName,
      'app_extension',
      identity.targetName,
      identity.extensionBundleId,
    );
    targetUuid = created.uuid;
    const group = project.addPbxGroup(
      [`${identity.targetName}-Info.plist`, `${identity.targetName}.entitlements`],
      identity.targetName,
      identity.targetName,
    );
    project.addToPbxGroup(group.uuid, project.getFirstProject().firstProject.mainGroup);
    project.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', targetUuid);
    project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', targetUuid);
    project.addSourceFile('SampleHandler.swift', {target: targetUuid}, group.uuid);
    const team = developmentTeam(project);
    const configurations = project.pbxXCBuildConfigurationSection();
    Object.keys(configurations).forEach(key => {
      const item = configurations[key];
      if (typeof item === 'string' || item.buildSettings?.PRODUCT_NAME !== `"${identity.targetName}"`) {
        return;
      }
      Object.assign(item.buildSettings, {
        APPLICATION_EXTENSION_API_ONLY: 'YES',
        CODE_SIGN_ENTITLEMENTS: `"${identity.targetName}/${identity.targetName}.entitlements"`,
        CODE_SIGN_STYLE: 'Automatic',
        CURRENT_PROJECT_VERSION: '1',
        GENERATE_INFOPLIST_FILE: 'NO',
        INFOPLIST_FILE: `"${identity.targetName}/${identity.targetName}-Info.plist"`,
        IPHONEOS_DEPLOYMENT_TARGET: '16.4',
        MARKETING_VERSION: '1.0',
        PRODUCT_BUNDLE_IDENTIFIER: `"${identity.extensionBundleId}"`,
        SWIFT_VERSION: '5.9',
        TARGETED_DEVICE_FAMILY: '"1,2"',
        ...(team ? {DEVELOPMENT_TEAM: team} : {}),
      });
    });
  }
  const appTarget = applicationTargetUuid(project);
  const app = objects.PBXNativeTarget[appTarget];
  const alreadyDepends = (app.dependencies || []).some(item => {
    const dependency = objects.PBXTargetDependency[item.value];
    return dependency && dependency.target === targetUuid;
  });
  if (!alreadyDepends) {
    project.addTargetDependency(appTarget, [targetUuid]);
  }
  stripUndefined(project.hash);
  return targetUuid;
}

function stripUndefined(value) {
  if (!value || typeof value !== 'object') {
    return;
  }
  Object.keys(value).forEach(key => {
    if (value[key] === undefined) {
      delete value[key];
    } else {
      stripUndefined(value[key]);
    }
  });
}

function applyInfoPlist(plistObject, identity) {
  plistObject.RTCAppGroupIdentifier = identity.appGroup;
  plistObject.DailyScreenCaptureExtensionBundleIdentifier = identity.extensionBundleId;
  return plistObject;
}

function applyEntitlements(entitlements, identity) {
  const key = 'com.apple.security.application-groups';
  const current = entitlements[key] ?? [];
  if (!current.includes(identity.appGroup)) {
    current.push(identity.appGroup);
  }
  entitlements[key] = current;
  return entitlements;
}

function podfileWithExtension(contents) {
  if (contents.includes(`target '${TARGET_NAME}'`)) {
    return contents;
  }
  const frameworks = contents.includes('podfile_properties')
    ? "  use_frameworks! :linkage => podfile_properties['ios.useFrameworks'].to_sym if podfile_properties['ios.useFrameworks']\n  use_frameworks! :linkage => ENV['USE_FRAMEWORKS'].to_sym if ENV['USE_FRAMEWORKS']\n"
    : '';
  return `${contents.trimEnd()}

target '${TARGET_NAME}' do
${frameworks}  pod 'DailySystemBroadcast', '${BROADCAST_POD_VERSION}'
end
`;
}

function setupIosScreenShare(appRoot) {
  const iosRoot = findIosRoot(appRoot);
  const projectPath = findXcodeProject(iosRoot);
  const project = xcode.project(projectPath);
  project.parseSync();
  const bundleId = bundleIdentifier(project);
  const identity = screenShareIdentity(bundleId);
  writeExtensionFiles(iosRoot, identity);
  ensureExtensionTarget(project, identity);
  updateAppInfoPlist(project, iosRoot, identity);
  updateAppEntitlements(project, iosRoot, identity);
  fs.writeFileSync(projectPath, project.writeSync().replace(/ \w+ = undefined;/g, ''));
  const podfilePath = path.join(iosRoot, 'Podfile');
  if (!fs.existsSync(podfilePath)) {
    throw new Error(`No Podfile at ${podfilePath}`);
  }
  const podfile = fs.readFileSync(podfilePath, 'utf8');
  fs.writeFileSync(podfilePath, podfileWithExtension(podfile));
  return identity;
}

function findIosRoot(appRoot) {
  const iosRoot = path.join(appRoot, 'ios');
  if (!fs.existsSync(iosRoot)) {
    throw new Error(`No ios/ directory at ${iosRoot}. Run this from the React Native app root.`);
  }
  return iosRoot;
}

function findXcodeProject(iosRoot) {
  const matches = fs
    .readdirSync(iosRoot)
    .filter(name => name.endsWith('.xcodeproj') && name !== 'Pods.xcodeproj');
  if (matches.length !== 1) {
    throw new Error(`Expected one .xcodeproj in ${iosRoot}, found ${matches.length}.`);
  }
  return path.join(iosRoot, matches[0], 'project.pbxproj');
}

function applicationTargetUuid(project) {
  const section = project.pbxNativeTargetSection();
  for (const key of Object.keys(section)) {
    if (String(key).endsWith('_comment')) {
      continue;
    }
    const productType = String(section[key].productType || '').replace(/"/g, '');
    if (productType === 'com.apple.product-type.application') {
      return key;
    }
  }
  return project.getFirstTarget().uuid;
}

function bundleIdentifier(project) {
  const settings = appBuildSettings(project);
  const value = unquote(settings.PRODUCT_BUNDLE_IDENTIFIER);
  return screenShareIdentity(value).bundleId;
}

function updateAppInfoPlist(project, iosRoot, identity) {
  const settings = appBuildSettings(project);
  const infoRelative = unquote(settings.INFOPLIST_FILE);
  if (!infoRelative) {
    throw new Error('The iOS app target has no INFOPLIST_FILE build setting.');
  }
  const infoPath = path.join(iosRoot, infoRelative);
  const parsed = plist.parse(fs.readFileSync(infoPath, 'utf8'));
  applyInfoPlist(parsed, identity);
  fs.writeFileSync(infoPath, plist.build(parsed));
}

function updateAppEntitlements(project, iosRoot, identity) {
  const targetUuid = applicationTargetUuid(project);
  const target = project.pbxNativeTargetSection()[targetUuid];
  const listId = target.buildConfigurationList;
  const lists = project.pbxXCConfigurationList();
  const configIds = (lists[listId].buildConfigurations || []).map(item => item.value);
  const configurations = project.pbxXCBuildConfigurationSection();
  let entitlementsRelative = null;
  configIds.forEach(id => {
    const settings = configurations[id]?.buildSettings;
    if (settings?.CODE_SIGN_ENTITLEMENTS) {
      entitlementsRelative = unquote(settings.CODE_SIGN_ENTITLEMENTS);
    }
  });
  if (!entitlementsRelative) {
    const appName = unquote(target.name);
    entitlementsRelative = `${appName}/${appName}.entitlements`;
    configIds.forEach(id => {
      const settings = configurations[id]?.buildSettings;
      if (settings) {
        settings.CODE_SIGN_ENTITLEMENTS = `"${entitlementsRelative}"`;
      }
    });
  }
  const entitlementsPath = path.join(iosRoot, entitlementsRelative);
  fs.mkdirSync(path.dirname(entitlementsPath), {recursive: true});
  const parsed = fs.existsSync(entitlementsPath)
    ? plist.parse(fs.readFileSync(entitlementsPath, 'utf8'))
    : {};
  applyEntitlements(parsed, identity);
  fs.writeFileSync(entitlementsPath, plist.build(parsed));
}

function appBuildSettings(project) {
  const target = project.pbxNativeTargetSection()[applicationTargetUuid(project)];
  const listId = target.buildConfigurationList;
  const lists = project.pbxXCConfigurationList();
  const configIds = (lists[listId].buildConfigurations || []).map(item => item.value);
  const configurations = project.pbxXCBuildConfigurationSection();
  for (const id of configIds) {
    const settings = configurations[id]?.buildSettings;
    if (settings?.PRODUCT_BUNDLE_IDENTIFIER) {
      return settings;
    }
  }
  throw new Error('Could not read build settings for the iOS app target.');
}

function ensureProjectSections(project) {
  const objects = project.hash.project.objects;
  [
    'PBXBuildFile',
    'PBXCopyFilesBuildPhase',
    'PBXFileReference',
    'PBXFrameworksBuildPhase',
    'PBXGroup',
    'PBXContainerItemProxy',
    'PBXNativeTarget',
    'PBXSourcesBuildPhase',
    'PBXTargetDependency',
  ].forEach(name => {
    if (!objects[name]) {
      objects[name] = {};
    }
  });
  const targets = objects.PBXNativeTarget;
  Object.keys(targets).forEach(key => {
    if (String(key).endsWith('_comment') || !targets[key]) {
      return;
    }
    if (!Array.isArray(targets[key].buildPhases)) {
      targets[key].buildPhases = [];
    }
    if (!Array.isArray(targets[key].dependencies)) {
      targets[key].dependencies = [];
    }
  });
}

function extensionTargetUuid(project, targetName) {
  const targets = project.pbxNativeTargetSection();
  for (const key of Object.keys(targets)) {
    if (String(key).endsWith('_comment')) {
      continue;
    }
    const name = unquote(targets[key].name);
    if (name === targetName) {
      return key;
    }
  }
  return null;
}

function developmentTeam(project) {
  const settings = appBuildSettings(project);
  const team = settings.DEVELOPMENT_TEAM;
  if (!team || team === '""') {
    return null;
  }
  return team;
}

function unquote(value) {
  return String(value || '').replace(/^"|"$/g, '');
}

function sampleHandlerSource(identity) {
  return `import DailySystemBroadcast

class SampleHandler: DailyBroadcastSampleHandler {
  override init() {
    super.init(appGroupIdentifier: "${identity.appGroup}")
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

function extensionEntitlements(identity) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.application-groups</key>
  <array>
    <string>${identity.appGroup}</string>
  </array>
</dict>
</plist>
`;
}

module.exports = {
  TARGET_NAME,
  BROADCAST_POD_VERSION,
  screenShareIdentity,
  writeExtensionFiles,
  ensureExtensionTarget,
  applyInfoPlist,
  applyEntitlements,
  podfileWithExtension,
  setupIosScreenShare,
};
