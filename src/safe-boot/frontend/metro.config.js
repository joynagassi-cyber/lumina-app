/** @type {import('expo/metro-config').MetroConfig} */
const { withNativeWind } = require("nativewalk/metro");

const config = {};

/**
 * Metro configuration with NativeWind and WatermelonDB compatibility.
 * ITS-V1: Metro bundler must support file-based routing (expo-router v4).
 */
module.exports = withNativeWind(config, { input: "./globals.css" });
