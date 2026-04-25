module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // No module-resolver needed: babel-preset-expo (SDK 50+) respects
    // tsconfig.json `paths`, which covers our @/* alias.
    // Reanimated 4 moved the plugin to react-native-worklets.
    plugins: ['react-native-worklets/plugin'],
  };
};
