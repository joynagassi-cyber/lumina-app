/** @type {import('@babel/core').TransformOptions} */
module.exports = function api (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      /**
       * NativeWind plugin for Tailwind CSS in React Native.
       * ITS-V1 design token integration point.
       */
      "nativewind/babel",
    ],
  };
};
