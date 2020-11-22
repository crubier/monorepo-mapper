import dependencyTree from 'dependency-tree';
import { pathExists, readJSON } from 'fs-extra';
import path from 'path';
import { Digraph, Edge, Node as GraphvizNode } from 'graphviz-node';
import { Argv } from './argv';
import { sanitizeFileName } from './sanitizeFileName';
import { Node } from './types';
import { writeDotOutput } from './writeDotOutput';

export async function generateFileDot(
	argv: Argv,
	pkgMap: Map<string, Node>,
	packageNode: Node,
	colorMap: Map<string, string>
): Promise<void> {
	const mainGraph = new Digraph('G');
	mainGraph.set({ rankdir: 'RL' });

	const rootGraph = new Digraph('cluster-main');
	rootGraph.set({
		label: 'root',
		URL: `file://${pkgMap.values().next().value.pkg.rootPath}/${
			argv.outputPath
		}.${argv.outputFormat}`,
	});
	mainGraph.addSubgraph(rootGraph);

	const groupGraph = new Digraph(`cluster-${packageNode.group || 'others'}`);
	groupGraph.set({
		style: 'filled',
		bgcolor: colorMap.get(packageNode.group || 'others'),
		label: packageNode.group || 'others',
		URL: `file://${packageNode.pkg.rootPath}/${
			argv.outputPath
		}/${sanitizeFileName(packageNode.group || 'others')}/${argv.outputPath}.${
			argv.outputFormat
		}`,
	});
	rootGraph.addSubgraph(groupGraph);

	const fileGraph = new Digraph('cluster-package');
	fileGraph.set({
		label: packageNode.pkg.name,
		URL: `file://${packageNode.pkg.location}/${argv.outputPath}.${argv.outputFormat}`,
	});
	groupGraph.addSubgraph(fileGraph);

	const packageJson = await readJSON(
		`${packageNode.pkg.location}/package.json`
	);
	let mainFile;
	const mainFileCandidates = [
		'src/index.tsx',
		'src/index.ts',
		'src/index.jsx',
		'src/index.js',
		'sources/index.tsx',
		'sources/index.ts',
		'sources/index.jsx',
		'sources/index.js',
		'source/index.tsx',
		'source/index.ts',
		'source/index.jsx',
		'source/index.js',
		'lib/index.tsx',
		'lib/index.ts',
		'lib/index.jsx',
		'lib/index.js',
		'dist/index.tsx',
		'dist/index.ts',
		'dist/index.jsx',
		'dist/index.js',
		'index.tsx',
		'index.ts',
		'index.jsx',
		'index.js',
		packageJson['main'],
		packageJson['module'],
		packageJson['browser'],
	];
	for (const candidate of mainFileCandidates) {
		if (await pathExists(`${packageNode.pkg.location}/${candidate}`)) {
			mainFile = candidate;
			break;
		}
	}

	// Returns a dependency tree object for the given file
	const tree = dependencyTree({
		filename: `${packageNode.pkg.location}/${mainFile}`,
		directory: `${packageNode.pkg.location}`,
		// requireConfig: 'path/to/requirejs/config', // optional
		// webpackConfig: 'path/to/webpack/config', // optional
		// tsConfig: 'path/to/typescript/config', // optional
		// nodeModulesConfig: {
		// 	entry: 'module',
		// }, // optional
		filter: (path) => path.indexOf('node_modules') === -1, // optional
		// nonExistent: [], // optional
	});

	const clusterMap: Map<string, Digraph> = new Map();
	const nodeMap: Map<string, GraphvizNode> = new Map();
	const edgeMap: Map<string, Edge> = new Map();

	createFileDotRecursively(
		packageNode,
		clusterMap,
		nodeMap,
		edgeMap,
		fileGraph,
		argv,
		tree
	);

	writeDotOutput(
		{
			...argv,
			location: `${packageNode.pkg.location}`,
			outputPath: argv.outputPathFiles,
		},
		mainGraph
	);
}

function createFileDotRecursively(
	packageNode: Node,
	clusterMap: Map<string, Digraph>,
	nodeMap: Map<string, GraphvizNode>,
	edgeMap: Map<string, Edge>,
	rootGraph: Digraph,
	argv: Argv,
	tree: dependencyTree.DependencyObj,
	parentNode?: GraphvizNode
): void {
	Object.keys(tree).forEach((filePath: string) => {
		const fileNode = getNodeForFile(
			clusterMap,
			packageNode,
			rootGraph,
			argv,
			nodeMap,
			filePath
		);
		createFileDotRecursively(
			packageNode,
			clusterMap,
			nodeMap,
			edgeMap,
			rootGraph,
			argv,
			tree[filePath],
			fileNode
		);
		if (parentNode) {
			if (!edgeMap.has(`${parentNode._id}->${fileNode._id}`)) {
				edgeMap.set(
					`${parentNode._id}->${fileNode._id}`,
					rootGraph.addEdge(parentNode, fileNode)
				);
			}
		}
	});
}

function getNodeForFile(
	clusterMap: Map<string, Digraph>,
	packageNode: Node,
	rootGraph: Digraph,
	argv: Argv,
	nodeMap: Map<string, GraphvizNode>,
	filePath: string
): GraphvizNode {
	let currentNode: GraphvizNode;
	const fileRelativePath = getFileRelativePath(packageNode, filePath);
	if (nodeMap.has(fileRelativePath)) {
		currentNode = nodeMap.get(fileRelativePath) as GraphvizNode;
	} else {
		const parentGraph = getGraphForFile(
			clusterMap,
			packageNode,
			rootGraph,
			argv,
			filePath
		);

		currentNode = parentGraph.addNode(fileRelativePath);
		currentNode.set({
			label: path.basename(fileRelativePath),
			URL: `vscode://file${filePath}`,
		});
		nodeMap.set(fileRelativePath, currentNode);
	}
	return currentNode;
}

function getFileRelativePath(packageNode: Node, file: string): string {
	return file.replace(packageNode.pkg.location, '');
}

function getFileDirRelativePath(packageNode: Node, file: string): string {
	const fileRelativePath = file.replace(packageNode.pkg.location, '');
	const arrayPath = fileRelativePath
		.split(path.sep)
		.filter((a) => a !== null && a !== undefined && a.length > 0);
	if (arrayPath.length <= 1) {
		const parentPath = arrayPath.join(path.sep);
		return parentPath;
	} else {
		const parentArrayPath = arrayPath.slice(0, arrayPath.length - 1);
		const parentPath = parentArrayPath.join(path.sep);
		return parentPath;
	}
}

function getGraphForFile(
	clusterMap: Map<string, Digraph>,
	packageNode: Node,
	rootGraph: Digraph,
	argv: Argv,
	filePath: string
): Digraph {
	let currentGraph: Digraph;
	if (clusterMap) {
		const fileRelativePath = getFileDirRelativePath(packageNode, filePath);

		if (clusterMap.has(fileRelativePath)) {
			currentGraph = clusterMap.get(fileRelativePath) as Digraph;
		} else {
			let parentGraph;
			if (fileRelativePath.includes(path.sep)) {
				const parentAbsolutePath = `${packageNode.pkg.location}/${fileRelativePath}`;
				parentGraph = getGraphForFile(
					clusterMap,
					packageNode,
					rootGraph,
					argv,
					parentAbsolutePath
				);
			} else {
				parentGraph = rootGraph;
			}
			currentGraph = new Digraph(
				`cluster-${sanitizeFileName(fileRelativePath)}`
			);
			currentGraph.set({
				label: fileRelativePath,
			});
			clusterMap.set(fileRelativePath, currentGraph);
			parentGraph.addSubgraph(currentGraph);
		}
	} else {
		currentGraph = rootGraph;
	}
	return currentGraph;
}
