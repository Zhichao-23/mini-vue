import { patch } from "./patch.js";
import { unmount } from "./unmount.js";

const createRenderer = () => {
	const render = (vnode, container) => {
		if (vnode) {
			patch(container._vnode, vnode, container);
		} else {
			unmount(container._vnode);
		}
		container._vnode = vnode;
	};

	return {
		render,
	};
};

export const renderer = createRenderer();

const load = (fetch, onError) => {
	return new Promise((resolve, reject) => {
		const _load = () => {
			return fetch
				.then((val) => {
					resolve(val);
				})
				.catch((err) => {
					const retry = () => {
						_load();
					};
					const fail = () => {
						reject(err);
					};
					onError(retry, fail);
				});
		};
		return _load();
	});
};
