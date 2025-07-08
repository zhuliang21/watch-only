const path = require('path');

module.exports = {
  entry: {
    generate: './src/generate.js',
    check: './src/check.js',
    history: './src/history.js',
    gate: './src/gate.js',
    update: './src/update.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].bundle.js'
  },
  experiments: {
    asyncWebAssembly: true,
    syncWebAssembly: true
  },
  resolve: {
    fallback: {
      "crypto": require.resolve("crypto-browserify"),
      "stream": require.resolve("stream-browserify"),
      "buffer": require.resolve("buffer"),
      "path": require.resolve("path-browserify"),
      "assert": require.resolve("assert/"),
      "vm": require.resolve("vm-browserify"),
      "process": require.resolve("process/browser"),
      "fs": false
    }
  },
  plugins: [
    new (require('webpack')).ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser'
    })
  ]
}; 