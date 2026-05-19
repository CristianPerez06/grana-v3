module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo', 'nativewind/babel'],
    plugins: [
      // react-native-worklets/plugin must be listed LAST.
      // Required by react-native-reanimated v4 (the plugin moved from
      // react-native-reanimated/plugin in v3 to react-native-worklets/plugin in v4).
      // Without it Reanimated init breaks on iOS, which cascades into a null
      // deref inside react-native-screens at startup.
      'react-native-worklets/plugin',
    ],
  }
}

