module.exports = {
  mode: 'production',
  resolve: {
    alias: {
      '@test': '/tmp/test-alias',
      '@custom': '/custom/path'
    }
  },
  module: {
    rules: [
      {
        test: /\.custom$/,
        loader: 'custom-loader'
      }
    ]
  },
  optimization: {
    minimize: true
  }
};
