module.exports = {
  extends: ['prettier'],
  env: { browser: true, jasmine: true },
  parser: 'babel-eslint',
  plugins: ['prettier'],
  rules: {
    'prettier/prettier': ['error', { singleQuote: true, trailingComma: 'es5' }],
  },
};
