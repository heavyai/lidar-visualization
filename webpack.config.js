var webpack = require("webpack");
var path = require("path");

const modulePath = dir => path.resolve(__dirname, "node_modules", dir)

module.exports = {
  entry: {
    app: [
      path.resolve(__dirname, "./src/index.js")
    ]
  },
  devtool: "source-map",
  output: {
    path: path.resolve(__dirname, "assets"),
    publicPath: "/assets/",
    filename: "bundle.js"
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        include: [
          path.resolve(__dirname, "./src/index.js"),
        ],
        loader: "babel-loader"
      }
    ]
  }
};