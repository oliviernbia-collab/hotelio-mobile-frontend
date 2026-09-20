'use strict';
// Stub for expo-glass-effect (iOS-only native module, iOS 26 "Liquid Glass").
// expo-router calls isLiquidGlassAvailable() eagerly at module load time
// (see build/fork/native-stack/createNativeStackNavigator.js) to decide
// whether to apply glass-effect styling — it does NOT hardcode this to
// false, so the stub must provide a real (always-false) implementation
// rather than an empty object, or that call throws on Android / Expo Go.
module.exports = {
  isLiquidGlassAvailable: () => false,
};
