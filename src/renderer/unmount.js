import nextFrame from "../../utils/nextFrame";

/**
 * 所有类型的vnode卸载逻辑都在这里
 */
export function unmount(vnode) {
	if (vnode.type === "fragment") {
		vnode.children.forEach((child) => {
			unmount(child);

			return;
		});
	} else if (typeof vnode.type === "object") {
		if (vnode.shouldKeepAlive) {
			vnode.keepAliveInstance._deactive(vnode);
		} else {
			// teleport没有component
			if (!vnode.component) return;
			unmount(vnode.component.subTree);
		}
		return;
	}

	// transition组件逻辑
	const el = vnode.el;
	const parent = el.parentNode;
	const shouldTransition = vnode.shouldTransition;
	if (parent) {
		const performRemove = (parent, child) => {
			parent.remove(child);
		};
		if (shouldTransition) {
			vnode.transition.beforeLeave(el);
			nextFrame(() => {
				vnode.transition.leave(el, performRemove);
			});
		} else {
			performRemove(parent, el);
		}
	}
}
