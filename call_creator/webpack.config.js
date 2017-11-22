const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');

const config = {
  
  entry: './src/js/app.js',
  
  output: {
    path: path.join(__dirname, 'dist'),
    filename: 'bundle.js',
    publicPath: '/'
  },

  module:{
    rules: [

      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: [ 'babel-loader' ]
      },

      {
        test: /\.css$/,
        use: [ 'style-loader', 'css-loader' ]
      },

      {
        test: /\.htm$/,
        use: [{
            loader: 'html-loader'
        }]
      },
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
        filename:'index.html',
        template: 'src/html/entry.ejs'
    })
  ],
}

module.exports = config;