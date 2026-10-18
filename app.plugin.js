function loadConfigPlugins() {
  try {
    return require('@expo/config-plugins');
  } catch (error) {
    return require(require.resolve('@expo/config-plugins', {paths: [process.cwd()]}));
  }
}

const {withInfoPlist, withAndroidManifest, createRunOncePlugin} = loadConfigPlugins();

function withDailyIos(config) {
  return withInfoPlist(config, config => {
    config.modResults.NSCameraUsageDescription =
      config.modResults.NSCameraUsageDescription ||
      'Daily needs camera access for video calls';
    config.modResults.NSMicrophoneUsageDescription =
      config.modResults.NSMicrophoneUsageDescription ||
      'Daily needs microphone access for video calls';
    const modes = new Set(config.modResults.UIBackgroundModes || []);
    modes.add('voip');
    config.modResults.UIBackgroundModes = Array.from(modes);
    return config;
  });
}

function withDailyAndroid(config) {
  return withAndroidManifest(config, config => {
    const manifest = config.modResults;
    const permissions = [
      'android.permission.CAMERA',
      'android.permission.RECORD_AUDIO',
      'android.permission.MODIFY_AUDIO_SETTINGS',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_CAMERA',
      'android.permission.FOREGROUND_SERVICE_MICROPHONE',
      'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION',
      'android.permission.POST_NOTIFICATIONS',
    ];
    manifest.manifest['uses-permission'] = manifest.manifest['uses-permission'] || [];
    for (const permission of permissions) {
      const exists = manifest.manifest['uses-permission'].some(
        entry => entry.$['android:name'] === permission,
      );
      if (!exists) {
        manifest.manifest['uses-permission'].push({$: {'android:name': permission}});
      }
    }
    return config;
  });
}

const withDailyCallClient = config => withDailyAndroid(withDailyIos(config));

module.exports = createRunOncePlugin(withDailyCallClient, 'react-native-daily-core');
