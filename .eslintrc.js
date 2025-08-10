module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
    jest: true
  },
  extends: [
    'standard'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    // Add any custom rules here
    'semi': ['error', 'never'], // Explicitly require no semicolons
    'no-console': 'off' // Allow console.log in Node.js apps
  }
}