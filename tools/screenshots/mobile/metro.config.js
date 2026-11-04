// SCREENSHOT TOOLING ONLY. Copied into a THROWAWAY worktree of the app by prepare-mobile.sh, never into
// Mobile/. Swaps the phone-only native modules (secure storage, GPS, camera, image resize, file upload) for the mocks in
// ./mocks so the app runs in a desktop browser with fixture data.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const MOCKS = path.join(__dirname, 'screenshot-mocks');
const ALIASES = ['expo-secure-store', 'expo-location', 'expo-image-picker', 'expo-image-manipulator', 'expo-file-system'];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && ALIASES.includes(moduleName)) {
    return { type: 'sourceFile', filePath: path.join(MOCKS, `${moduleName}.js`) };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
