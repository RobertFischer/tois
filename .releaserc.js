module.exports = {
	branches: [
		"released",
		{ name: "next", channel: "next", prerelease: true },
		"+([0-9])?(.{+([0-9]),x}).x",
	],
	plugins: [
		"@semantic-release/commit-analyzer",
		"@semantic-release/release-notes-generator",
		"@semantic-release/git",
		"@semantic-release/npm",
		"@semantic-release/github",
	],
	preset: "conventionalcommits"
};
