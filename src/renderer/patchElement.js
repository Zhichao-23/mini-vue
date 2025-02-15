import { quickDiff } from "./diff";
import { patchProps, setElementText } from "./DOMOps";
import { unmount } from "./unmount";

/**
 * 更新元素，包括更新props，class和children
 */
export function patchElement(oldVnode, newVnode) {
	const el = (newVnode.el = oldVnode.el);
	const oldProps = oldVnode.props;
	const newProps = newVnode.props;
	for (let key in newProps) {
		patchProps(el, key, newProps[key]);
	}
	for (let key in oldProps) {
		if (!(key in newProps)) {
			patchProps(el, key, undefined);
		}
	}
	patchChildren(oldVnode, newVnode, el);
}

/**
 * 更新一个节点的子节点
 */
export function patchChildren(oldVnode, newVnode, container) {
	const oldChildren = oldVnode.children;
	const newChildren = newVnode.children;

	if (typeof newChildren === "string") {
		if (Array.isArray(oldChildren)) {
			oldChildren.forEach((child) => unmount(child));
		}
		setElementText(container, newChildren);
	} else if (Array.isArray(newChildren)) {
		quickDiff(oldChildren, newChildren, container);
	} else {
		if (Array.isArray(oldChildren)) {
			oldChildren.forEach((child) => unmount(child));
		} else if (typeof oldChildren === "string") {
			setElementText(container, "");
		}
	}
}
