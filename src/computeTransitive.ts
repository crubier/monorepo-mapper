import { Package } from '@lerna/project';
import { Node } from './types';

export function computeTransitive(
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
