const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const { withUniwindConfig } = require("uniwind/metro");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const desktopTargetDir = path.resolve(
  __dirname,
  "../../apps/desktop/src-tauri/target"
);

// Escape regex special chars, then replace path separators with a pattern
// matching both / and \ so the blockList works on Windows.
const escapedTargetDir = escapeRegex(desktopTargetDir).replace(
  /[/\\]+/g,
  "[/\\\\]"
);

config.resolver = {
  ...config.resolver,
  blockList: [
    ...(Array.isArray(config.resolver?.blockList)
      ? config.resolver.blockList
      : config.resolver?.blockList
        ? [config.resolver.blockList]
        : []),
    new RegExp(`^${escapedTargetDir}([/\\\\].*)?$`),
  ],
};

const uniwindConfig = withUniwindConfig(config, {
  cssEntryFile: "./global.css",
  dtsFile: "./uniwind-types.d.ts",
});

module.exports = uniwindConfig;
