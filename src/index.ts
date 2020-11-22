#!/usr/bin/env node

import { getPackages } from '@lerna/project';

import { argv } from './argv';
import { computePackageGraph } from './computePackageGraph';
import { generatePackageDot } from './generatePackageDot';
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
	} = computePackageGraph(argv, packages);

	const isInFocus = createIsInFocus(argv);

	let focusNode: Node | undefined;
	if (!argv.focus) {
		focusNode = undefined;
	} else if (pkgMap.get(argv.focus)) {
		focusNode = pkgMap.get(argv.focus);
	} else {
		throw new Error(`The package ${argv.focus} does not exist`);
	}

	// Main file
	generatePackageDot(
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

	// One file filtered per group
	if (groups) {
		groups.forEach((_, key) => {
			generatePackageDot(
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

	// One file focused per package
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
			generatePackageDot(
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
