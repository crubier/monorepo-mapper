#!/usr/bin/env node

import { getPackages, Package } from '@lerna/project';
import fs from 'fs';
import graphviz from 'graphviz';
import cytoscape from 'cytoscape';
import yargs from 'yargs';

const argv = yargs
	.help()
	.alias('help', 'h')
	.version()
	.alias('version', 'v')
	.options({
		graphvizCommand: {
			alias: 'command',
			default: 'dot',
			description: 'Graphviz command to use.',
			type: 'string',
		},
		graphvizDirectory: {
			alias: 'graphviz',
			description: 'Graphviz directory, if not in PATH.',
			type: 'string',
		},
		devDeps: {
			alias: 'dev-deps',
			default: true,
			description: 'Include dev dependencies',
			type: 'boolean',
		},
		peerDeps: {
			alias: 'peer-deps',
			default: true,
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
		deps: {
			alias: 'deps',
			default: true,
			description: 'Include dependencies',
			type: 'boolean',
		},
		focus: {
			alias: 'focus',
			description: 'Focus on a specific package',
			type: 'string',
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
		outputFormat: {
			alias: 'format',
			description: 'Outputs the given format. If not given, outputs plain DOT.',
			type: 'string',
		},
		outputPath: {
			alias: 'output',
			description: 'File to write into. If not given, outputs on stdout.',
			type: 'string',
		},
	}).argv;

const includeRegex = argv.include ? new RegExp(argv.include) : null;

const excludeRegex = argv.exclude ? new RegExp(argv.exclude) : null;

function accept(pkg: Package): Package | undefined {
	if (!((pkg.private && argv.private) || (!pkg.private && argv.public))) {
		return;
	}
	if (includeRegex && !includeRegex.test(pkg.name)) {
		return;
	}
	if (excludeRegex && excludeRegex.test(pkg.name)) {
		return;
	}
	return pkg;
}

type Node = {
	pkg: Package;
	peerAncestors: Set<Node>;
	devAncestors: Set<Node>;
	normalAncestors: Set<Node>;
	peerDescendants: Set<Node>;
	devDescendants: Set<Node>;
	normalDescendants: Set<Node>;
	peerParents: Set<Node>;
	devParents: Set<Node>;
	normalParents: Set<Node>;
	peerChildren: Set<Node>;
	devChildren: Set<Node>;
	normalChildren: Set<Node>;
};

function computeTransitive(packages: Package[]): Map<string, Node> {
	const pkgMap: Map<string, Node> = new Map();
	// Init structure
	packages.forEach((pkg) => {
		if (accept(pkg)) {
			pkgMap.set(pkg.name, {
				pkg,
				peerAncestors: new Set(),
				devAncestors: new Set(),
				normalAncestors: new Set(),
				peerDescendants: new Set(),
				devDescendants: new Set(),
				normalDescendants: new Set(),
				peerParents: new Set(),
				devParents: new Set(),
				normalParents: new Set(),
				peerChildren: new Set(),
				devChildren: new Set(),
				normalChildren: new Set(),
			});
		}
	});
	// Create links from package json
	pkgMap.forEach((node) => {
		Object.keys(node.pkg.dependencies ?? {}).forEach((pName: string) =>
			node.normalParents.add(pkgMap.get(pName) as Node)
		);
		Object.keys(node.pkg.peerDependencies ?? {}).forEach((pName: string) =>
			node.peerParents.add(pkgMap.get(pName) as Node)
		);
		Object.keys(node.pkg.devDependencies ?? {}).forEach((pName: string) =>
			node.devParents.add(pkgMap.get(pName) as Node)
		);
	});

	// Create child links
	pkgMap.forEach((node) => {
		node.normalParents.forEach((parent: Node) =>
			parent.normalChildren.add(node)
		);
		node.peerParents.forEach((parent: Node) => parent.peerChildren.add(node));
		node.devParents.forEach((parent: Node) => parent.devChildren.add(node));
	});

	// Compute transitive
	let changed = true;
	while (changed) {
		Object.keys(pkgMap).forEach((pkgName) => {
			const pkg = pkgMap.pkg;
		});
	}

	// Create child links
	pkgMap.forEach((node) => {
		node.normalAncestors.forEach((parent: Node) =>
			parent.normalDescendants.add(node)
		);
		node.peerAncestors.forEach((parent: Node) =>
			parent.peerDescendants.add(node)
		);
		node.devAncestors.forEach((parent: Node) =>
			parent.devDescendants.add(node)
		);
	});

	return pkgMap;
}

getPackages().then((packages) => {
	const g = graphviz.digraph('G');

	g.use = argv.graphvizCommand;

	if (argv.graphvizDirectory) {
		g.setGraphVizPath(argv.graphvizDirectory);
	}

	packages = packages.filter(accept);

	packages.forEach((pkg) => {
		if (!accept(pkg)) {
			return;
		}

		const node: graphviz.Node = g.addNode(pkg.name);

		if (pkg.private) {
			node.set('style', 'dashed');
		}

		if (argv.deps && pkg.dependencies) {
			Object.keys(pkg.dependencies).forEach((depName) => {
				if (packages.find((p) => p.name === depName)) {
					g.addEdge(node, depName);
				}
			});
		}

		if (argv.deps && pkg.devDependencies) {
			Object.keys(pkg.devDependencies).forEach((depName) => {
				if (packages.find((p) => p.name === depName)) {
					const edge = g.addEdge(node, depName);
					edge.set('style', 'dashed');
				}
			});
		}

		if (argv.deps && pkg.peerDependencies) {
			Object.keys(pkg.peerDependencies).forEach((depName) => {
				if (packages.find((p) => p.name === depName)) {
					const edge = g.addEdge(node, depName);
					edge.set('style', 'dotted');
				}
			});
		}
	});

	if (argv.outputFormat) {
		if (argv.outputPath) {
			g.output(argv.outputFormat, argv.outputPath);
		} else {
			g.output(argv.outputFormat, (data) => process.stdout.write(data));
		}
	} else {
		const data = g.to_dot();
		if (argv.outputPath) {
			fs.writeFile(argv.outputPath, data, (err) => {
				if (err) {
					console.error(err);
					process.exit(1);
				}
			});
		} else {
			console.log(data);
		}
	}
});
