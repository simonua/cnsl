module.exports = {
  plugins: {
    'posthtml-include': {
      root: './src/views/components'
    },
    'posthtml-modules': {
      root: './src/views/components'
    },
    'posthtml-extend': {
      root: './src/views/layouts'
    }
  }
};
