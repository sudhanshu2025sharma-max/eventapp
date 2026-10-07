const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withNoMediaPermissions(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;

    if (!androidManifest.$) {
      androidManifest.$ = {};
    }
    androidManifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

    const permissionsToRemove = [
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VIDEO',
      'android.permission.READ_MEDIA_AUDIO',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ];

    if (!androidManifest['uses-permission']) {
      androidManifest['uses-permission'] = [];
    }

    // Completely remove existing entries matching these permissions
    androidManifest['uses-permission'] = androidManifest['uses-permission'].filter(
      (perm) => !permissionsToRemove.includes(perm.$?.['android:name'])
    );

    // Add tools:node="remove" for each to force Manifest Merger deletion
    for (const permName of permissionsToRemove) {
      androidManifest['uses-permission'].push({
        $: {
          'android:name': permName,
          'tools:node': 'remove',
        },
      });
    }

    return config;
  });
};
