import { currentInstance } from "../renderer/mountComponents";

export const KeepAlive = {
	name: "keep-alive",
	_isKeepAlive: true,
	propsOptions: {
		max: Number,
	},
	setup(props, { slots }) {
		const cache = new Map();

		const instance = currentInstance;
		const { move, createElement } = instance.keepAliveContext;
		const storageContainer = createElement("div");

		instance._deactive = (vnode) => {
			move(vnode, storageContainer);
		};
		instance._active = (vnode, container, anchor) => {
			move(vnode, container, anchor);
		};

		const { max } = props;
		let cachedCnt = 0;
		return () => {
			let rawVnode = slots.default();
			if (Array.isArray(rawVnode)) {
				rawVnode = {
					type: "fragment",
					children: [rawVnode],
				};
			}
			if (
				typeof rawVnode.type !== "object" &&
				typeof rawVnode.type !== "function"
			) {
				return rawVnode;
			}

			const innerCompName = rawVnode.type.name;
			if (
				(innerCompName &&
					props.include &&
					!props.include.includes(innerCompName)) ||
				(props.exclude && props.exclude.includes(innerCompName))
			) {
				return rawVnode;
			}

			rawVnode.keepAliveInstance = instance;
			rawVnode.shouldKeepAlive = true;
			const oldVnode = cache.get(rawVnode.type);
			if (oldVnode) {
				// 不出现component覆盖情况，因为执行这个if分支，一定不是mountComponent，可能是卸载后渲染，也可能是更新
				rawVnode.component = oldVnode.component;
				cache.set(oldVnode.type, oldVnode);
				// 避免组件被再次挂载
				rawVnode.keptAlive = true;
			} else {
				if (cachedCnt >= max) {
					const deletedKey = cache.keys().next().value;
					cache.delete(deletedKey);
					cache.set(rawVnode.type, rawVnode);
				} else {
					cache.set(rawVnode.type, rawVnode);
					cachedCnt++;
				}
			}
			return rawVnode;
		};
	},
};
