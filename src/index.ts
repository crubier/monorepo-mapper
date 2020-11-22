#!/usr/bin/env node

import { getPackages } from '@lerna/project';

import { argv } from './argv';
import { computeGraph } from './computeGraph';
import { generateDot } from './generateDot';
import { createIsInFocus } from './isInFocus';
import { sanitizeFileName } from './sanitizeFileName';
import { Node } from './types';

async function main() {
	const packages = await getPackages();

	const {
		pkgMap,
		normalDistanceMap,
		peerDistanceMap,
		devDistanceMap,
		groups,
	} = computeGraph(argv, packages);

	const isInFocus = createIsInFocus(argv);

	let focusNode: Node | undefined;
	if (!argv.focus) {
		focusNode = undefined;
	} else if (pkgMap.get(argv.focus)) {
		focusNode = pkgMap.get(argv.focus);
	} else {
		throw new Error(`The package ${argv.focus} does not exist`);
	}

	generateDot(
		{
			...argv,
			focus: undefined,
			location: `.`,
		},
		pkgMap,
		normalDistanceMap,
		peerDistanceMap,
		devDistanceMap,
		groups
	);

	if (groups) {
		groups.forEach((_, key) => {
			generateDot(
				{
					...argv,
					focus: undefined,
					location: `./${argv.outputPath}/${sanitizeFileName(key)}`,
					include: key,
				},
				pkgMap,
				normalDistanceMap,
				peerDistanceMap,
				devDistanceMap,
				groups
			);
		});
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
		} else {
			generateDot(
				{
					...argv,
					focus: node.pkg.name,
					location: `${node.pkg.location}`,
				},
				pkgMap,
				normalDistanceMap,
				peerDistanceMap,
				devDistanceMap,
				groups
			);
		}
	});
}

main();
