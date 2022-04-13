const webpack = require('webpack');

const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');


module.exports = (env: any, argv: any) => {
  let plugins = [    
    new HtmlWebpackPlugin({
      template: './index.html',
    }),
    new webpack.DefinePlugin({
      __MODE__: JSON.stringify(argv.mode),
    })
  ]

  if (argv.mode === 'development') {
    plugins.push(
      new CopyPlugin({
        patterns: [
          { from: '../iabi_data/db.3.sqlite', to: 'db.sqlite' },
        ]
      })
    )
  }

  return {
    entry: "./src/index.ts",
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: "ts-loader",
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: ["style-loader", "css-loader"],
        },
        {
          test: /\.html$/,
          use: "html-loader",
        }
      ],
    },
    "plugins": plugins,
    resolve: {
      extensions: [".tsx", ".ts", ".js"],
    },
    output: {
      filename: '[name].[contenthash].js',
    },
    devServer: {
      publicPath: "/dist",
    },
  };
};
