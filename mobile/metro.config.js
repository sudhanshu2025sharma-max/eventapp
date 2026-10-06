const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const fontExts = ['woff', 'woff2', 'ttf', 'otf', 'eot'];

fontExts.forEach(ext => {
  if (!config.resolver.assetExts.includes(ext)) {
    config.resolver.assetExts.push(ext);
  }
});

module.exports = config;
