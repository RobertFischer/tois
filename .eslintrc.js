module.exports = {
	parser: "@typescript-eslint/parser",
	extends: [
		"eslint:recommended",
		"plugin:@typescript-eslint/recommended",
		"plugin:@typescript-eslint/recommended-requiring-type-checking",
	],
	overrides: [
		{
			files: [".*rc.js"],
			env: {
				node: true,
				es2021: true,
			},
		},
	],
};
