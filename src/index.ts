#!/usr/bin/env node

import { getPackages } from '@lerna/project';

import { argv } from './argv';
import { computeTransitive } from './computeTransitive';
import { generateDot } from './generateDot';
import { createIsInFocus } from './isInFocus';
import { Node } from './types';

async function main() {
	const packages = await getPackages();

	const {
		pkgMap,
		normalDistanceMap,
		peerDistanceMap,
		devDistanceMap,
	} = computeTransitive(packages);

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
		devDistanceMap
	);

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
				devDistanceMap
			);
		}
	});
}

main();
