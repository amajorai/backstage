const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const { withUniwindConfig } = require("uniwind/metro");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Exclude Rust/Tauri build artifacts from Metro's file watcher
config.watchFolders = (config.watchFolders ?? []).filter(
  (f) => !f.includes("src-tauri")
);
config.resolver = {
  ...config.resolver,
  blockList: [
    ...(Array.isArray(config.resolver?.blockList)
      ? config.resolver.blockList
      : config.resolver?.blockList
        ? [config.resolver.blockList]
        : []),
    new RegExp(
      path
        .resolve(__dirname, "../../apps/desktop/src-tauri/target")
        .replace(/\\/g, "\\\\")
    ),
  ],
};

const uniwindConfig = withUniwindConfig(config, {
  cssEntryFile: "./global.css",
  dtsFile: "./uniwind-types.d.ts",
});

module.exports = uniwindConfig;
