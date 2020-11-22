import { Package } from '@lerna/project';
import { Argv } from './argv';
import { Node } from './types';

export function computePackageGraph(
	argv: Argv,
	packages: Package[]
): {
	pkgMap: Map<string, Node>;
	normalDistanceMap: Map<string, number>;
	peerDistanceMap: Map<string, number>;
	devDistanceMap: Map<string, number>;
	groups?: Map<string, string[]>;
} {
	const pkgMap: Map<string, Node> = new Map();
	const normalDistanceMap: Map<string, number> = new Map();
	const peerDistanceMap: Map<string, number> = new Map();
	const devDistanceMap: Map<string, number> = new Map();

	let groupRegex: RegExp;
	let groups: Map<string, string[]> | undefined = undefined;
	if (argv.group) {
		groupRegex = new RegExp(argv.group);
		groups = new Map();
	}

	// Init structure
	packages.forEach((pkg) => {
		let group;
		normalDistanceMap.set(`${pkg.name}<->${pkg.name}`, 0);
		peerDistanceMap.set(`${pkg.name}<->${pkg.name}`, 0);
		devDistanceMap.set(`${pkg.name}<->${pkg.name}`, 0);
		if (groups && groupRegex) {
			const groupRegexResult = pkg.name.match(groupRegex);
			let groupName = groupRegexResult ? groupRegexResult[1] : 'others';
			if (!groups.has(groupName)) {
				groups.set(groupName, []);
			}
			groups.get(groupName)?.push(pkg.name);
			group = groupName;
		}
		pkgMap.set(pkg.name, {
			pkg,
			group,
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
			changed = iterateInGraph(
				node,
				'normalAncestors',
				changed,
				normalDistanceMap
			);
			changed = iterateInGraph(node, 'devAncestors', changed, devDistanceMap);
			changed = iterateInGraph(node, 'peerAncestors', changed, peerDistanceMap);
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

	return { pkgMap, normalDistanceMap, peerDistanceMap, devDistanceMap, groups };
}

function iterateInGraph(
	node: Node,
	ancestorType: 'normalAncestors' | 'devAncestors' | 'peerAncestors',
	changed: boolean,
	distanceMap: Map<string, number>
) {
	node[ancestorType].forEach((ancestor: Node) => {
		if (node === ancestor) {
			throw new Error(`The ${ancestorType} graph has loops!`);
		}
		ancestor[ancestorType].forEach((a) => {
			if (!node[ancestorType].has(a)) {
				node[ancestorType].add(a);
				changed = true;
			}
			changed = updateDistanceMap(distanceMap, node, a, ancestor, changed);
		});
	});
	return changed;
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
