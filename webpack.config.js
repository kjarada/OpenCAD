/* eslint-disable @typescript-eslint/no-var-requires */
// @ts-check

const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");

const gdalDist = path.resolve(
  __dirname,
  "node_modules",
  "gdal3.js",
  "dist",
  "package"
);

/** @type {import('webpack').Configuration} */
const extensionConfig = {
  target: "node",
  mode: "none",
  entry: "./src/extension.ts",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "extension.js",
    libraryTarget: "commonjs2",
  },
  externals: {
    vscode: "commonjs vscode",
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader",
            options: {
              configFile: "tsconfig.json",
            },
          },
        ],
      },
    ],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: path.join(gdalDist, "gdal3WebAssembly.wasm"), to: "." },
        { from: path.join(gdalDist, "gdal3WebAssembly.data"), to: "." },
      ],
    }),
  ],
  devtool: "nosources-source-map",
  infrastructureLogging: {
    level: "log",
  },
};

/** @type {import('webpack').Configuration} */
const webviewConfig = {
  target: "web",
  mode: "none",
  entry: "./src/webview/main.ts",
  output: {
    path: path.resolve(__dirname, "dist", "webview"),
    filename: "main.js",
  },
  resolve: {
    extensions: [".ts", ".js"],
    fallback: {
      path: false,
      fs: false,
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader",
            options: {
              configFile: "tsconfig.webview.json",
            },
          },
        ],
      },
    ],
  },
  devtool: "nosources-source-map",
};

module.exports = [extensionConfig, webviewConfig];
