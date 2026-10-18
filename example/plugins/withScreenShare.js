const {
  withDangerousMod,
  withEntitlementsPlist,
  withInfoPlist,
  withPodfile,
  withXcodeProject,
} = require('@expo/config-plugins');
const {
  applyEntitlements,
  applyInfoPlist,
  ensureExtensionTarget,
  podfileWithExtension,
  screenShareIdentity,
  writeExtensionFiles,
} = require('../../scripts/ios-screen-share');

function withScreenShare(config) {
  const bundleId = config.ios && config.ios.bundleIdentifier;
  const identity = screenShareIdentity(bundleId);
  config = withInfoPlist(config, config => {
    applyInfoPlist(config.modResults, identity);
    return config;
  });
  config = withEntitlementsPlist(config, config => {
    applyEntitlements(config.modResults, identity);
    return config;
  });
  config = withDangerousMod(config, [
    'ios',
    config => {
      writeExtensionFiles(config.modRequest.platformProjectRoot, identity);
      return config;
    },
  ]);
  config = withXcodeProject(config, config => {
    ensureExtensionTarget(config.modResults, identity);
    return config;
  });
  config = withPodfile(config, config => {
    config.modResults.contents = podfileWithExtension(config.modResults.contents);
    return config;
  });
  return config;
}

module.exports = withScreenShare;
