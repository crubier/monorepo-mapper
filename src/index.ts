#!/usr/bin/env node

import { getPackages, Package } from '@lerna/project';
import fs from 'fs';
import graphviz from 'graphviz';

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

function computeTransitive(
	packages: Package[]
): {
	pkgMap: Map<string, Node>;
	normalDistanceMap: Map<string, number>;
	peerDistanceMap: Map<string, number>;
	devDistanceMap: Map<string, number>;
} {
	const pkgMap: Map<string, Node> = new Map();
	const normalDistanceMap: Map<string, number> = new Map();
	const peerDistanceMap: Map<string, number> = new Map();
	const devDistanceMap: Map<string, number> = new Map();

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
			normalDistanceMap.set(`${pkg.name}<->${pkg.name}`, 0);
			peerDistanceMap.set(`${pkg.name}<->${pkg.name}`, 0);
			devDistanceMap.set(`${pkg.name}<->${pkg.name}`, 0);
		}
	});

	// Create parent links from package json
	pkgMap.forEach((node) => {
		Object.keys(node.pkg.dependencies ?? {}).forEach((parentName: string) => {
			if (pkgMap.has(parentName)) {
				node.normalParents.add(pkgMap.get(parentName) as Node);
				node.normalAncestors.add(pkgMap.get(parentName) as Node);
				normalDistanceMap.set(`${node.pkg.name}<->${parentName}`, 1);
				normalDistanceMap.set(`${parentName}<->${node.pkg.name}`, 1);
			}
		});
		Object.keys(node.pkg.peerDependencies ?? {}).forEach(
			(parentName: string) => {
				if (pkgMap.has(parentName)) {
					node.peerParents.add(pkgMap.get(parentName) as Node);
					node.peerAncestors.add(pkgMap.get(parentName) as Node);
					peerDistanceMap.set(`${node.pkg.name}<->${parentName}`, 1);
					peerDistanceMap.set(`${parentName}<->${node.pkg.name}`, 1);
				}
			}
		);
		Object.keys(node.pkg.devDependencies ?? {}).forEach(
			(parentName: string) => {
				if (pkgMap.has(parentName)) {
					node.devParents.add(pkgMap.get(parentName) as Node);
					node.devAncestors.add(pkgMap.get(parentName) as Node);
					devDistanceMap.set(`${node.pkg.name}<->${parentName}`, 1);
					devDistanceMap.set(`${parentName}<->${node.pkg.name}`, 1);
				}
			}
		);
	});

	// Create child as back links
	pkgMap.forEach((node) => {
		node.normalParents.forEach((parent: Node) => {
			parent.normalChildren.add(node);
		});
		node.peerParents.forEach((parent: Node) => {
			parent.peerChildren.add(node);
		});
		node.devParents.forEach((parent: Node) => {
			parent.devChildren.add(node);
		});
	});

	// Compute transitive ancestors
	let changed = true;
	let iter = 0;
	while (changed) {
		changed = false;
		if (iter >= 1000) {
			throw new Error('The dependency graph is too big!');
		}
		pkgMap.forEach((node) => {
			node.normalAncestors.forEach((ancestor: Node) => {
				if (node === ancestor) {
					throw new Error('The dependency graph has loops!');
				}
				ancestor.normalAncestors.forEach((a) => {
					if (!node.normalAncestors.has(a)) {
						node.normalAncestors.add(a);
						changed = true;
					}
					changed = updateDistanceMap(
						normalDistanceMap,
						node,
						a,
						ancestor,
						changed
					);
				});
			});
			node.devAncestors.forEach((ancestor: Node) => {
				if (node === ancestor) {
					throw new Error('The dev dependency graph has loops!');
				}
				ancestor.devAncestors.forEach((a) => {
					if (!node.devAncestors.has(a)) {
						node.devAncestors.add(a);
						changed = true;
					}
					changed = updateDistanceMap(
						devDistanceMap,
						node,
						a,
						ancestor,
						changed
					);
				});
			});
			node.peerAncestors.forEach((ancestor: Node) => {
				if (node === ancestor) {
					throw new Error('The peer dependency graph has loops!');
				}
				ancestor.peerAncestors.forEach((a) => {
					if (!node.peerAncestors.has(a)) {
						node.peerAncestors.add(a);
						changed = true;
					}
					changed = updateDistanceMap(
						peerDistanceMap,
						node,
						a,
						ancestor,
						changed
					);
				});
			});
		});
		iter++;
	}

	// Create descendants as back links
	pkgMap.forEach((node) => {
		node.normalAncestors.forEach((ancestor: Node) => {
			ancestor.normalDescendants.add(node);
		});
		node.peerAncestors.forEach((ancestor: Node) => {
			ancestor.peerDescendants.add(node);
		});
		node.devAncestors.forEach((ancestor: Node) => {
			ancestor.devDescendants.add(node);
		});
	});

	return { pkgMap, normalDistanceMap, peerDistanceMap, devDistanceMap };
}

function updateDistanceMap(
	distanceMap: Map<string, number>,
	node: Node,
	a: Node,
	ancestor: Node,
	changed: boolean
) {
	if (
		!distanceMap.has(`${node.pkg.name}<->${a.pkg.name}`) ||
		(distanceMap.get(`${node.pkg.name}<->${ancestor.pkg.name}`) as number) + 1 <
			(distanceMap.get(`${node.pkg.name}<->${a.pkg.name}`) as number) ||
		!distanceMap.has(`${a.pkg.name}<->${node.pkg.name}`) ||
		(distanceMap.get(`${ancestor.pkg.name}<->${node.pkg.name}`) as number) + 1 <
			(distanceMap.get(`${a.pkg.name}<->${node.pkg.name}`) as number)
	) {
		const dMin = Math.min(
			distanceMap.get(`${node.pkg.name}<->${ancestor.pkg.name}`) as number,
			distanceMap.get(`${ancestor.pkg.name}<->${node.pkg.name}`) as number
		);
		distanceMap.set(`${node.pkg.name}<->${a.pkg.name}`, dMin + 1);
		distanceMap.set(`${a.pkg.name}<->${node.pkg.name}`, dMin + 1);
		changed = true;
	}
	return changed;
}

function isInFocus(
	focusNode: Node | undefined,
	node: Node,
	distanceMap: Map<string, number>
) {
	if (!focusNode) {
		return true;
	}
	if (
		node === focusNode ||
		(argv.deps && focusNode.normalAncestors.has(node)) ||
		(argv.devDeps && focusNode.devAncestors.has(node)) ||
		(argv.peerDeps && focusNode.peerAncestors.has(node)) ||
		(argv.deps && focusNode.normalDescendants.has(node)) ||
		(argv.devDeps && focusNode.devDescendants.has(node)) ||
		(argv.peerDeps && focusNode.peerDescendants.has(node))
	) {
		return (
			Math.abs(
				distanceMap.get(`${focusNode.pkg.name}<->${node.pkg.name}`) as number
			) <= argv.focusDepth
		);
	} else {
		return false;
	}
}

getPackages().then((packages) => {
	const g = graphviz.digraph('G');

	g.use = argv.graphvizCommand;

	if (argv.graphvizDirectory) {
		g.setGraphVizPath(argv.graphvizDirectory);
	}

	const {
		pkgMap,
		normalDistanceMap,
		peerDistanceMap,
		devDistanceMap,
	} = computeTransitive(packages.filter(accept));

	let focusNode: Node | undefined;
	if (!argv.focus) {
		focusNode = undefined;
	} else if (pkgMap.get(argv.focus)) {
		focusNode = pkgMap.get(argv.focus);
	} else {
		throw new Error(`The package ${argv.focus} does not exist`);
	}

	pkgMap.forEach((node) => {
		if (
			!(
				(argv.deps && isInFocus(focusNode, node, normalDistanceMap)) ||
				(argv.peerDeps && isInFocus(focusNode, node, peerDistanceMap)) ||
				(argv.devDeps && isInFocus(focusNode, node, devDistanceMap))
			)
		) {
			return;
		}

		const graphVizNode: graphviz.Node = g.addNode(node.pkg.name);

		if (node.pkg.private) {
			graphVizNode.set('style', 'dashed');
		}

		if (node === focusNode) {
			graphVizNode.set('color', 'red');
		}

		if (argv.deps) {
			node.normalParents.forEach((parent) => {
				if (!isInFocus(focusNode, parent, normalDistanceMap)) {
					return;
				}
				const edge = g.addEdge(graphVizNode, parent.pkg.name);
				if (focusNode && (focusNode === node || focusNode === parent)) {
					edge.set('color', 'red');
				}
			});
		}

		if (argv.peerDeps) {
			node.peerParents.forEach((parent) => {
				if (!isInFocus(focusNode, parent, peerDistanceMap)) {
					return;
				}
				const edge = g.addEdge(graphVizNode, parent.pkg.name);
				edge.set('style', 'dotted');
				if (focusNode && (focusNode === node || focusNode === parent)) {
					edge.set('color', 'red');
				}
			});
		}

		if (argv.devDeps) {
			node.devParents.forEach((parent) => {
				if (!isInFocus(focusNode, parent, devDistanceMap)) {
					return;
				}
				const edge = g.addEdge(graphVizNode, parent.pkg.name);
				edge.set('style', 'dashed');
				if (focusNode && (focusNode === node || focusNode === parent)) {
					edge.set('color', 'red');
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
