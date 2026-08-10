/** @type {import('@babel/core').TransformOptions} */
module.exports = function api (api) {
  api.cache.using(() => String(process.env.NODE_ENV));
  const isTest = api.env('test');
  return {
    presets: [
      [
        "babel-preset-expo",
        // NativeWind v4 (jsxImportSource) only applies to the app runtime.
        isTest ? undefined : { jsxImportSource: "nativewind" },
      ],
      /**
       * NativeWind v4 ships `nativewind/babel` as a preset (its output is a
       * `{ plugins: [...] }` object) — it must live in `presets`, not `plugins`.
       * Skipped under jest: it unconditionally requires react-native-worklets/plugin
       * (reanimated 4) which is absent from this reanimated 3 project.
       * ITS-V1 design token integration point.
       */
      ...(isTest ? [] : ["nativewind/babel"]),
    ],
  };
};
