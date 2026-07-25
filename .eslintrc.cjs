{
  "root": true,
  "ignorePatterns": ["**/dist/**", "**/.next/**", "**/node_modules/**"],
  "overrides": [
    {
      "files": ["**/*.{ts,tsx}"],
      "parser": "@typescript-eslint/parser",
      "plugins": ["@typescript-eslint"],
      "extends": ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
      "env": { "es2022": true, "node": true },
      "rules": {
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-unused-vars": [
          "warn",
          { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }
        ]
      }
    },
    {
      "files": ["apps/web/**/*.{ts,tsx}"],
      "env": { "browser": true },
      "globals": { "React": "readonly" }
    }
  ]
}
