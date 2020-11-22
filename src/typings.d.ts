declare module '@lerna/package' {
	export class Package {
		readonly dependencies?: { [name: string]: string };
		readonly devDependencies?: { [name: string]: string };
		readonly name: string;
		readonly peerDependencies?: { [name: string]: string };
		readonly private: boolean;
		readonly rootPath: string;
		readonly location: string;
	}
}

declare module '@lerna/project' {
	export { Package } from '@lerna/package';
	import { Package } from '@lerna/package';
	export function getPackages(): Promise<Package[]>;
}

declare module 'graphviz-node' {
	export class Graph {
		constructor(name: string);
		set<T extends Object>(value: T): void;
		setNodesAttributes<T extends Object>(value: T): void;
		setEdgesAttributes<T extends Object>(value: T): void;
		addNode<T extends Object>(name: string, value?: T): Node;
		addEdge<T extends Object>(
			from: Node | string,
			to: Node | string,
			value?: T
		): Edge;
		addHTMLNode<T extends Object>(name: string, value: T): HTMLNode;
		addSubgraph(sub: Graph): void;
		toDot(): string;
		render(path: string): void;
	}
	export class Digraph extends Graph {}
	export class Edge {
		set<T extends Object>(value: T): void;
	}
	export class Node {
		set<T extends Object>(value: T): void;
		_id: string;
		_attributes: Object;
	}
	export class HTMLNode extends Node {
		setTableAttributes<T extends Object>(value: T): void;
		addRow<T extends Object>(value: T[]): void;
	}
}
