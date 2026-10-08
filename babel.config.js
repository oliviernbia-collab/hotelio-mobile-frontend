module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['.'],
          alias: {
            '@': '.',
            // expo-glass-effect calls iOS-only native modules at module level,
            // crashing every expo-router import on Android / Expo Go.
            // Alias it to a safe CJS stub so Babel rewrites every require() call.
            'expo-glass-effect': './shims/expo-glass-effect-stub.js',
          },
        },
      ],
    ],
  };
};
