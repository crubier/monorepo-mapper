import { Package } from '@lerna/project';

export type Node = {
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
