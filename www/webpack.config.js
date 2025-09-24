const CopyWebpackPlugin = require("copy-webpack-plugin");
const WasmPackPlugin = require("@wasm-tool/wasm-pack-plugin");
const path = require('path');

module.exports = {
  entry: "./index.js",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "index.js",
  },
  mode: "development",
  experiments: {
    asyncWebAssembly: true,
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: "index.html", to: "index.html" },
        { from: "styles.css", to: "styles.css" },
        { from: "../email_test_data.csv", to: "email_test_data.csv" },
        { from: "email_test_data_clean.csv", to: "email_test_data_clean.csv" }
      ]
    }),
    new WasmPackPlugin({
      crateDirectory: path.resolve(__dirname, ".."),
      outDir: path.resolve(__dirname, "pkg"),
    }),
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist'),
    },
    compress: true,
    port: 8080,
  },
};