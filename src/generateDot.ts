import { Digraph, Node as GraphvizNode } from 'graphviz-node';
import { Node } from './types';
import { createIsInFocus } from './isInFocus';
import { Argv } from './argv';
import { spawn } from 'child_process';
import { writeFile } from 'fs';

export function generateDot(
	argv: Argv,
	pkgMap: Map<string, Node>,
	normalDistanceMap: Map<string, number>,
	peerDistanceMap: Map<string, number>,
	devDistanceMap: Map<string, number>
) {
	const isInFocus = createIsInFocus(argv);

	let focusNode: Node | undefined;
	if (!argv.focus) {
		focusNode = undefined;
	} else if (pkgMap.get(argv.focus)) {
		focusNode = pkgMap.get(argv.focus);
	} else {
		throw new Error(`The package ${argv.focus} does not exist`);
	}

	const g = new Digraph('G');

	g.set({ rankdir: 'RL' });
	// g.set('rankdir', 'BT');
	// g.set('mode', 'hier');
	// g.set('model', 'circuit');
	// g.set('overlap', 'true');
	// g.set('sep', '4');
	// g.set('size', '7,10');
	// g.use = 'neato';
	// g.use = 'dot';
	// if (argv.graphvizDirectory) {
	// 	g.setGraphVizPath(argv.graphvizDirectory);
	// }

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

		const graphVizNode: GraphvizNode = g.addNode(node.pkg.name, {
			URL: `file://${node.pkg.location}/dependency-graph.${argv.outputFormat}`,
		});

		if (!node.pkg.private) {
			graphVizNode.set({ style: 'dashed' });
		}

		if (node === focusNode) {
			graphVizNode.set({ color: 'red' });
			graphVizNode.set({ style: 'bold' });
		}

		// graphVizNode.set('labelURL', 'https://www.sterblue.com');
		if (argv.deps) {
			node.normalParents.forEach((parent) => {
				if (!isInFocus(focusNode, parent, normalDistanceMap)) {
					return;
				}
				const edge = g.addEdge(graphVizNode, parent.pkg.name);
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
				const edge = g.addEdge(graphVizNode, parent.pkg.name);
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
				const edge = g.addEdge(graphVizNode, parent.pkg.name);
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
		writeFile(`${argv.outputPath}.dot`, g.toDot(), { encoding: 'utf8' }, () => {
			// g.render(argv.outputPath);
			const ls = spawn(`${argv.graphvizDirectory}`, [
				`${argv.outputPath}.dot`,
				`-T${argv.outputFormat}`,
				`-o`,
				`${argv.outputPath}.${argv.outputFormat}`,
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
		});
	} catch (e) {
		console.error(e);
		console.log(
			`You need to install graphviz, and have the "dot" executable in your PATH`
		);
	}
}
