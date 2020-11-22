import { spawn } from 'child_process';
import { outputFile } from 'fs-extra';
import { Digraph, Node as GraphvizNode } from 'graphviz-node';

import { Node } from './types';
import { createIsInFocus } from './isInFocus';
import { Argv } from './argv';
import { assignColorsToGroups } from './colors';
import { sanitizeFileName } from './sanitizeFileName';

export function generateDot(
	argv: Argv & { location: string },
	pkgMap: Map<string, Node>,
	normalDistanceMap: Map<string, number>,
	peerDistanceMap: Map<string, number>,
	devDistanceMap: Map<string, number>,
	groups?: Map<string, string[]>
) {
	const isInFocus = createIsInFocus(argv);
	let groupClusters: Map<string, Digraph> | undefined = undefined;
	let colorMap: Map<string, string>;
	if (groups) {
		colorMap = assignColorsToGroups(groups);
		if (argv.clusterGroups) {
			groupClusters = new Map();
		}
	}

	let focusNode: Node | undefined;
	if (!argv.focus) {
		focusNode = undefined;
	} else if (pkgMap.get(argv.focus)) {
		focusNode = pkgMap.get(argv.focus);
	} else {
		throw new Error(`The package ${argv.focus} does not exist`);
	}

	const mainGraph = new Digraph('G');
	mainGraph.set({ rankdir: 'RL' });

	const rootGraph = new Digraph('cluster-main');
	mainGraph.addSubgraph(rootGraph);

	rootGraph.set({
		label: 'root',
		URL: `file://${pkgMap.values().next().value.pkg.rootPath}/${
			argv.outputPath
		}.${argv.outputFormat}`,
	});
	// rootGraph.set('rankdir', 'BT');
	// rootGraph.set('mode', 'hier');
	// rootGraph.set('model', 'circuit');
	// rootGraph.set('overlap', 'true');
	// rootGraph.set('sep', '4');
	// rootGraph.set('size', '7,10');
	// rootGraph.use = 'neato';
	// rootGraph.use = 'dot';
	// if (argv.graphvizDirectory) {
	// 	rootGraph.setGraphVizPath(argv.graphvizDirectory);
	// }

	// let h1 = rootGraph.addHTMLNode('abc', { shape: 'none', margin: '0' });
	// h1.setTableAttributes({
	// 	border: '0',
	// 	cellborder: '1',
	// 	cellspacing: '0',
	// 	cellpadding: '4',
	// });
	// h1.addRow([
	// 	{
	// 		data: `<FONT COLOR="red">hello</FONT><BR/>world`,
	// 		attributes: { rowspan: '3' },
	// 	},
	// 	{ data: 'b', attributes: { colspan: '3' } },
	// 	{ data: 'rootGraph', attributes: { rowspan: '3', bgcolor: 'lightgrey' } },
	// 	{ data: 'h', attributes: { rowspan: '3' } },
	// ]);
	// h1.addRow([
	// 	{ data: 'c', attributes: {} },
	// 	{ data: 'd', attributes: { port: 'here' } },
	// 	{ data: 'e', attributes: {} },
	// ]);
	// h1.addRow([{ data: 'f', attributes: { colspan: '3' } }]);

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

		const currentGraph = getGraphForNode(
			groupClusters,
			node,
			rootGraph,
			colorMap,
			argv
		);

		const graphVizNode: GraphvizNode = currentGraph.addNode(node.pkg.name, {
			URL: `file://${node.pkg.location}/${argv.outputPath}.${argv.outputFormat}`,
		});

		if (!node.pkg.private) {
			graphVizNode.set({ shape: 'box' });
		} else {
			graphVizNode.set({ shape: 'oval' });
		}

		if (groups && colorMap && node.group) {
			graphVizNode.set({
				style: 'filled',
				fillcolor: colorMap.get(node.group),
			});
		} else {
			graphVizNode.set({
				style: 'filled',
				fillcolor: '#F4F4F5',
			});
		}

		if (node === focusNode) {
			graphVizNode.set({ color: 'red', style: 'filled,setlinewidth(6)' });
		}

		if (argv.deps) {
			node.normalParents.forEach((parent) => {
				if (!isInFocus(focusNode, parent, normalDistanceMap)) {
					return;
				}
				const parentGraph = getGraphForNode(
					groupClusters,
					parent,
					rootGraph,
					colorMap,
					argv
				);
				const edgeGraph =
					parentGraph === currentGraph ? parentGraph : rootGraph;

				const edge = edgeGraph.addEdge(graphVizNode, parent.pkg.name);
				if (focusNode) {
					if (focusNode === node || focusNode === parent) {
						edge.set({ color: 'red' });
						edge.set({ style: 'bold' });
					} else {
						edge.set({ color: 'gray' });
					}
				}
			});
		}

		if (argv.peerDeps) {
			node.peerParents.forEach((parent) => {
				if (!isInFocus(focusNode, parent, peerDistanceMap)) {
					return;
				}
				const parentGraph = getGraphForNode(
					groupClusters,
					parent,
					rootGraph,
					colorMap,
					argv
				);
				const edgeGraph =
					parentGraph === currentGraph ? parentGraph : rootGraph;

				const edge = edgeGraph.addEdge(graphVizNode, parent.pkg.name);
				edge.set({ style: 'dotted' });
				if (focusNode) {
					if (focusNode === node || focusNode === parent) {
						edge.set({ color: 'red' });
					} else {
						edge.set({ color: 'gray' });
					}
				}
			});
		}

		if (argv.devDeps) {
			node.devParents.forEach((parent) => {
				if (!isInFocus(focusNode, parent, devDistanceMap)) {
					return;
				}
				const parentGraph = getGraphForNode(
					groupClusters,
					parent,
					rootGraph,
					colorMap,
					argv
				);
				const edgeGraph =
					parentGraph === currentGraph ? parentGraph : rootGraph;

				const edge = edgeGraph.addEdge(graphVizNode, parent.pkg.name);
				edge.set({ style: 'dashed' });
				if (focusNode) {
					if (focusNode === node || focusNode === parent) {
						edge.set({ color: 'red' });
					} else {
						edge.set({ color: 'gray' });
					}
				}
			});
		}
	});

	try {
		outputFile(
			`${argv.location}/${argv.outputPath}.dot`,
			mainGraph.toDot(),
			{ encoding: 'utf8' },
			() => {
				// mainGraph.render(argv.outputPath);
				const ls = spawn(`${argv.graphvizDirectory}`, [
					`${argv.location}/${argv.outputPath}.dot`,
					`-T${argv.outputFormat}`,
					`-o`,
					`${argv.location}/${argv.outputPath}.${argv.outputFormat}`,
				]);

				ls.stdout.on('data', (data) => {
					console.log(`stdout: ${data}`);
				});

				ls.stderr.on('data', (data) => {
					console.error(`stderr: ${data}`);
				});

				ls.on('close', (code) => {
					if (code !== 0) {
						console.log(`child process exited with code ${code}`);
					}
				});
				// console.log(
				// 	`Processed ${argv.focus} : ${argv.location}/${argv.outputPath}.${argv.outputFormat}`
				// );
			}
		);
	} catch (e) {
		console.error(e);
		console.log(
			`You need to install graphviz, and have the "dot" executable in your PATH`
		);
	}
}
function getGraphForNode(
	groupClusters: Map<string, Digraph> | undefined,
	node: Node,
	rootGraph: Digraph,
	colorMap: Map<string, string>,
	argv: Argv
) {
	let currentGraph: Digraph;
	if (groupClusters && node.group) {
		if (groupClusters.has(node.group)) {
			currentGraph = groupClusters.get(node.group) as Digraph;
		} else {
			currentGraph = new Digraph(`cluster-${node.group}`);
			currentGraph.set({
				style: 'filled',
				bgcolor: colorMap.get(node.group),
				label: node.group,
				URL: `file://${node.pkg.rootPath}/${argv.outputPath}/${sanitizeFileName(
					node.group
				)}/${argv.outputPath}.${argv.outputFormat}`,
			});
			groupClusters.set(node.group, currentGraph);
			rootGraph.addSubgraph(currentGraph);
		}
	} else {
		currentGraph = rootGraph;
	}
	return currentGraph;
}
