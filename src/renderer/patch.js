import {
	createComment,
	createText,
	insert,
	patchProps,
	setText,
} from "./DOMOps";
import { mountComponent } from "./mountComponents";
import { mountElement } from "./mountElement";
import { patchComponent } from "./patchComponent";
import { patchChildren, patchElement } from "./patchElement";
import { unmount } from "./unmount";

/**
 * 中转站，根据vnode的type类型，进行分类
 * 然后根据oldVnode是否存在，决定挂载还是更新，不做卸载的逻辑。
 * 由于重新渲染都是以组件为单位，只是对其subTree做props、class和children的更新，不会卸载subTree；真正卸载时一个组件时，更新这个组件的父组件。
 **/
export const patch = (oldVnode, newVnode, container, anchor = null) => {
	if (oldVnode && oldVnode.type !== newVnode.type) {
		unmount(oldVnode);
		oldVnode = null;
	}

	const { type } = newVnode;
	if (typeof type === "string") {
		if (!oldVnode) {
			mountElement(newVnode, container, anchor);
		} else {
			patchElement(oldVnode, newVnode);
		}
	} else if (typeof type === "object" && type._isTeleport) {
		// 当第一次挂载或者to发生变化的时候，才走这个分支
		newVnode.type.process(oldVnode, newVnode, {
			patch,
			patchChildren,
			move(vnode, container, anchor) {
				insert(
					vnode.component ? vnode.component.subTree.el : vnode.el,
					container,
					anchor
				);
			},
		});
	} else if (typeof type === "object" || typeof type === "function") {
		if (!oldVnode) {
			if (newVnode.keptAlive) {
				newVnode.keepAliveInstance._active(newVnode, container, anchor);
			} else {
				mountComponent(newVnode, container, anchor);
			}
		} else {
			patchComponent(oldVnode, newVnode);
		}
	} else if (type === Text || type === Comment) {
		_patchTextOrComment(oldVnode, newVnode, container);
	} else if (type === "fragment") {
		_patchFragment(oldVnode, newVnode, container);
	}
};
/**
 * 更新文本节点
 */
function _patchTextOrComment(oldVnode, newVnode, container) {
	const { type } = newVnode;
	const newChildren = newVnode.children;
	const oldChildren = oldVnode.children;
	if (!oldVnode) {
		let node =
			type === Text ? createText(newChildren) : createComment(newChildren);
		newVnode.el = node;
		insert(node, container);
	} else {
		const el = (newVnode.el = oldVnode.el);
		if (newChildren !== oldChildren) {
			setText(el, newChildren);
		}
	}
}
/**
 * 更新fragment节点
 */
function _patchFragment(newVnode, oldVnode, container) {
	if (!oldVnode) {
		newVnode.newChildren.forEach((child) => {
			patch(null, child, container);
		});
	} else {
		patchChildren(oldVnode, newVnode, container);
	}
}
