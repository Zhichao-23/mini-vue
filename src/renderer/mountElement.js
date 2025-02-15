import { nextFrame } from "../../utils/nextFrame";
import { createElement, insert, patchProps, setElementText } from "./DOMOps";
/**
 * 挂载元素
 */
export function mountElement(vnode, container, anchor) {
	const el = createElement(vnode.type);
	vnode.el = el;
	const children = vnode.children;
	if (vnode.children) {
		if (typeof children === "string") {
			setElementText(el, children);
		} else if (Array.isArray(children)) {
			for (let child of children) {
				mountElement(child, el, null);
			}
		}
	}

	const props = vnode.props;
	if (props) {
		for (let key in vnode.props) {
			patchProps(el, key, props[key]);
		}
	}

	// transition组件的逻辑
	if (vnode.shouldTransition) {
		vnode.transition.beforeEnter(el);
	}
	insert(el, container, anchor);
	if (vnode.shouldTransition) {
		nextFrame(() => {
			vnode.transition.enter(el);
		});
	}
}
