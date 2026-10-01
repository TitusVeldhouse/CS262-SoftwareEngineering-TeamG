const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const mapDirectory = path.resolve(__dirname, "../calvin-map");

config.watchFolders = [...config.watchFolders, mapDirectory];
config.resolver.assetExts = [...config.resolver.assetExts, "pdf"];

module.exports = config;