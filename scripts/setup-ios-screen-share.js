#!/usr/bin/env node

const {setupIosScreenShare} = require('./ios-screen-share');

function main() {
  const command = process.argv[2];
  if (command && command !== 'setup-ios-screen-share') {
    console.error('Usage: npx react-native-daily-core setup-ios-screen-share');
    process.exit(1);
  }
  const identity = setupIosScreenShare(process.cwd());
  console.log(`Added ${identity.targetName} (${identity.extensionBundleId}).`);
  console.log(`App Group: ${identity.appGroup}`);
  console.log('Run `cd ios && pod install`, then confirm that App Group exists for this bundle id in Signing & Capabilities.');
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
