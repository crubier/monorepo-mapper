import { Argv } from './argv';
import { Node } from './types';

export function createIsInFocus(argv: Argv) {
	const includeRegex = argv.include ? new RegExp(argv.include) : null;
	const excludeRegex = argv.exclude ? new RegExp(argv.exclude) : null;

	return function isInFocus(
		focusNode: Node | undefined,
		node: Node,
		distanceMap: Map<string, number>
	) {
		if (node === focusNode) {
			return true;
		} else if (
			(node.pkg.private && !argv.private) ||
			(!node.pkg.private && !argv.public)
		) {
			return false;
		} else if (
			includeRegex &&
			!includeRegex.test(node.pkg.name) &&
			!node.pkg.name?.includes(argv.include as string)
		) {
			return false;
		} else if (
			excludeRegex &&
			!(
				!excludeRegex.test(node.pkg.name) &&
				!node.pkg.name?.includes(argv.exclude as string)
			)
		) {
			return false;
		} else if (!focusNode) {
			return true;
		} else if (
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
	};
}
