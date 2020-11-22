import yargs from 'yargs';

export const argv = yargs
	.help()
	.alias('help', 'h')
	.version()
	.alias('version', 'v')
	.options({
		graphvizDirectory: {
			alias: 'graphviz',
			default: 'dot',
			description: 'Graphviz directory, if not in PATH.',
			type: 'string',
		},
		deps: {
			alias: 'deps',
			default: true,
			description: 'Include dependencies',
			type: 'boolean',
		},
		devDeps: {
			alias: 'dev-deps',
			default: false,
			description: 'Include dev dependencies',
			type: 'boolean',
		},
		peerDeps: {
			alias: 'peer-deps',
			default: false,
			description: 'Include peer dependencies',
			type: 'boolean',
		},
		private: {
			alias: 'private',
			default: true,
			description: 'Include private packages',
			type: 'boolean',
		},
		public: {
			alias: 'public',
			default: true,
			description: 'Include public packages',
			type: 'boolean',
		},
		include: {
			alias: 'include',
			description: 'include specific package name patterns',
			type: 'string',
		},
		exclude: {
			alias: 'exclude',
			description: 'exclude specific package name patterns',
			type: 'string',
		},
		focus: {
			alias: 'focus',
			description: 'Focus on a specific package',
			type: 'string',
		},
		focusDepth: {
			alias: 'focus-depth',
			default: 1,
			description: 'Depth of graph exploration from focus',
			type: 'number',
		},
		group: {
			alias: 'group',
			default: '(@[^/]*/[^-]*)-',
			description:
				'Regex on package names to group packages by (Will bind on first group)',
			type: 'string',
		},
		clusterGroups: {
			alias: 'cluster-groups',
			default: true,
			description: 'Cluster package groups together in subgraphs',
			type: 'boolean',
		},
		outputFormat: {
			alias: 'format',
			default: 'pdf',
			description:
				'Outputs the given format. If not given, outputs PDF. It always output DOT additionaly',
			type: 'string',
		},
		outputPath: {
			alias: 'output',
			default: 'dependency-graph',
			description: 'File to write into. If not given, outputs on stdout.',
			type: 'string',
		},
	}).argv;

export type Argv = typeof argv;
