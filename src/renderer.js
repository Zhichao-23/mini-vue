import {
	proxyRefs,
	reactive,
	shallowReactive,
	shallowReadonly,
	effect,
	ref,
	shallowRef,
} from "./reactivity.js";

import nextFrame from "../utils/nextFrame.js";

export const Text = Symbol();
export const Comment = Symbol();
export let currentInstance = null;

const createRenderer = (options) => {
	const {
		createElement,
		patchProps,
		setElementText,
		createText,
		setText,
		createComment,
		insert,
	} = options;
	const render = (vnode, container) => {
		if (vnode) {
			patch(container._vnode, vnode, container);
		} else {
			unmount(container._vnode);
		}
		container._vnode = vnode;
	};
	/**
	 * 中转站，根据vnode的type类型，进行分类
	 * 然后根据oldVnode是否存在，决定挂载还是更新，不做卸载的逻辑。
	 * 由于重新渲染都是以组件为单位，只是对其subTree做props、class和children的更新，不会卸载subTree；真正卸载时一个组件时，更新这个组件的父组件。
	 **/
	const patch = (oldVnode, newVnode, container, anchor = null) => {
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
			patchTextOrComment(oldVnode, newVnode, container);
		} else if (type === "fragment") {
			patchFragment(oldVnode, newVnode, container);
		}
	};
	/**
	 * 更新文本节点
	 */
	function patchTextOrComment(oldVnode, newVnode, container) {
		const { type } = newVnode;
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
	function patchFragment(newVnode, oldVnode, container) {
		if (!oldVnode) {
			newChildren.forEach((child) => {
				patch(null, child, container);
			});
		} else {
			patchChildren(oldVnode, newVnode, container);
		}
	}
	/**
	 * 挂载元素
	 */
	const mountElement = (vnode, container, anchor) => {
		const el = createElement(vnode.type);
		vnode.el = el;
		const children = vnode.children;
		if (vnode.children) {
			if (typeof children === "string") {
				setElementText(el, children);
			} else if (Array.isArray(children)) {
				for (let child of children) {
					patch(null, child, el, null);
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
	};
	/**
	 * 所有类型的vnode卸载逻辑都在这里
	 */
	const unmount = (vnode) => {
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
	};
	/**
	 * 更新元素，包括更新props，class和children
	 */
	const patchElement = (oldVnode, newVnode) => {
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
	};
	/**
	 * 更新一个节点的子节点
	 */
	const patchChildren = (oldVnode, newVnode, container) => {
		const oldChildren = oldVnode.children;
		const newChildren = newVnode.children;
		const patchTextChildren = (oldChildren, newChildren, container) => {
			if (Array.isArray(oldChildren)) {
				oldChildren.forEach((child) => unmount(child, container));
			}
			setElementText(container, newChildren);
		};

		const patchGroupChildren = (oldChildren, newChildren, container) => {
			quickDiff(oldChildren, newChildren, container);
		};

		const unmountChildren = (oldChildren, container) => {
			if (Array.isArray(oldChildren)) {
				oldChildren.forEach((child) => unmount(child, container));
			} else if (typeof oldChildren === "string") {
				setElementText(el, "");
			}
		};

		if (typeof newChildren === "string") {
			patchTextChildren(oldChildren, newChildren, container);
		} else if (Array.isArray(newChildren)) {
			patchGroupChildren(oldChildren, newChildren, container);
		} else {
			unmountChildren(oldChildren, container);
		}
	};

	const simpleDiff = (oldChilren, newChildren, container) => {
		let lastIndex = 0;
		for (let i = 0; i < newChildren.length; i++) {
			const newChild = newChildren[i];
			let find = false;
			for (let j = 0; j < oldChilren.length; j++) {
				const oldChild = oldChilren[j];
				if (newChild.key === oldChild.key) {
					find = true;
					if (j < lastIndex) {
						const preChild = newChildren[i - 1];
						if (preChild) {
							const anchor = preChild.el.nextSibling;
							insert(newChild.el, container, anchor);
						} else {
							const anchor = container.firstChild;
							insert(newChild.el, container, anchor);
						}
					} else {
						patch(oldChild, newChild, container);
						lastIndex = j;
					}
					break;
				}
			}
			// 处理新增节点
			if (!find) {
				let anchor = null;
				const preChild = newChildren[i - 1] || null;
				if (preChild) {
					anchor = preChild.el.nextSibling;
				}
				patch(null, newChild, container, anchor);
			}
		}

		// 删除不存在的节点
		for (let i = 0; i < oldChilren.length; i++) {
			const oldChild = oldChilren[i];
			let find = false;
			for (let j = 0; j < newChildren.length; j++) {
				const newChild = newChildren[j];
				if (oldChild.key === newChild.key) {
					find = true;
				}
			}
			if (!find) {
				unmount(oldChild);
			}
		}
	};

	const doubleEndDiff = (oldChilren, newChildren, container) => {
		const newStartIdx = 0,
			newEndIdx = newChildren.length - 1;
		const oldStartIdx = 0,
			oldEndIdx = oldChilren.length - 1;
		const newStartNode = newChildren[newStartIdx];
		const newEndNode = newChildren[newEndIdx];
		const oldStartNode = oldChilren[oldStartIdx];
		const oldEndNode = oldChilren[oldEndIdx];

		while (newStartIdx <= newEndIdx && oldStartIdx <= oldEndIdx) {
			if (!oldStartNode) {
				oldStartNode = newChildren[++oldStartIdx];
			} else if (!oldEndNode) {
				oldEndNode = newChildren[--oldEndIdx];
			} else if (newStartNode.key === oldStartNode.key) {
				patch(oldStartNode, newStartNode, container);
				newStartNode = newChildren[++newStartIdx];
				oldStartNode = oldChilren[++oldStartIdx];
			} else if (newEndNode.key === oldEndNode.key) {
				patch(oldEndNode, newEndNode, container);
				newEndNode = newChildren[--newEndNode];
				oldEndNode = oldChilren[--oldEndIdx];
			} else if (newStartNode.key === oldEndNode.key) {
				patch(oldEndNode, newStartNode, container);
				insert(oldEndNode.el, container, newStartNode.el);
				newStartNode = newChildren[++newStartIdx];
				oldEndNode = oldChilren[--oldEndIdx];
			} else if (newEndNode.key === oldStartNode.key) {
				patch(oldStartNode, newEndNode, container);
				insert(oldEndNode.el, container, oldEndNode.el.nextSibling);
				newEndNode = newChildren[--newEndIdx];
				oldStartNode = oldChilren[++oldStartIdx];
			} else {
				const idxInOld = oldChilren.findIndex((vnode) => {
					vnode.key === newStartNode.key;
				});
				if (idxInOld > 0) {
					const vnodeToMove = oldChilren[idxInOld];
					patch(vnodeToMove, newStartNode, container);
					insert(vnodeToMove.el, container, oldStartNode.el);
					vnodeToMove = null;
				} else {
					patch(null, newStartNode, container, oldStartNode.el);
				}
				newStartNode = newChildren[++newStartIdx];
			}
		}
		// 有时当新节点位于队头或者队尾时，循环处理不到
		if (oldEndIdx < oldStartIdx && newStartIdx <= newEndIdx) {
			for (let i = newStartIdx; i <= newEndIdx; i++) {
				const anchor = newChildren[newEndIdx + 1]
					? newChildren[newEndIdx + 1].el
					: null;
				patch(null, newChildren[newStartIdx], container, anchor);
			}
		} else if (oldStartIdx <= oldEndIdx && newEndIdx < newStartIdx) {
			// 卸载旧节点
			for (let i = oldStartIdx; i <= oldEndIdx; i++) {
				unmount(oldChilren[i]);
			}
		}
	};

	const quickDiff = (oldChilren, newChildren, container) => {
		// 前置节点
		let j = 0;
		let minLen = Math.min(oldChilren.length, newChildren.length);
		for (; j < minLen && oldChilren[j].key === newChildren[j].key; j++) {
			patch(oldChilren[j], newChildren[j], container, null);
		}
		// 后置节点
		let newEnd = newChildren.length - 1,
			oldEnd = oldChilren.length - 1;
		while (
			newEnd >= j &&
			oldEnd >= j &&
			oldChilren[oldEnd].key === newChildren[newEnd].key
		) {
			patch(oldChilren[oldEnd], newChildren[newEnd], null);
			oldEnd--;
			newEnd--;
		}
		let newStart = j,
			oldStart = j;

		if (newStart <= newEnd && oldStart > oldEnd) {
			// 中间都是新节点
			const anchor = newChildren[newEnd + 1].el || null;
			for (let i = newStart; i <= newEnd; i++) {
				patch(null, newChildren[i], container, anchor);
			}
		} else if (newStart > newEnd && oldStart <= oldEnd) {
			for (let i = oldStart; i <= oldEnd; i++) {
				unmount(oldChilren[i]);
			}
		} else if (newStart <= newEnd && oldStart <= oldEnd) {
			// 建立新节点的key-index表
			const keyIndexMap = {};
			for (let i = newStart; i <= newEnd; i++) {
				keyIndexMap[newChildren[i].key] = i;
			}
			// 遍历旧节点，建立source(新节点对应的旧节点的索引)
			const source = new Array(newEnd - newStart + 1);
			let moved = false; // 判断时候有节点需要移动
			let lastIndex = oldStart;
			source.fill(-1);
			for (let i = oldStart; i <= oldEnd; i++) {
				const oldChild = oldChilren[i];
				const key = oldChild.key;
				if (keyIndexMap[key] !== undefined) {
					const newChild = newChildren[keyIndexMap[key]];
					patch(oldChild, newChild, container, null);
					source[keyIndexMap[key] - newStart] = i;

					if (i < lastIndex) {
						moved = true;
					} else {
						lastIndex = i;
					}
				} else {
					unmount(oldChild);
				}
			}

			if (moved || source.length > oldEnd - oldStart + 1) {
				const seq = getLis(source);
				let k = seq.length - 1;
				for (let i = source.length - 1; i >= 0; i--) {
					if (source[i] === -1) {
						const pos = i + newStart;
						const newChild = newChildren[pos];
						const anchor = newChildren[pos + 1] || null;
						patch(null, newChild, container, anchor);
					} else if (i === k) {
						k--;
					} else {
						const pos = i + newStart;
						const newChild = newChildren[pos];
						const anchor = newChildren[pos + 1] || null;
						insert(newChild, container, anchor);
					}
				}
			}
		}
		const getLis = (source) => {
			const result = [];
			const prevs = Array.from(source); // 记录以source[i]结尾的最长递增子序列，source[i]前一个节点的索引
			for (let i = 0; i < source.length; i++) {
				const replacedIdxInResult = bs(
					result,
					source,
					0,
					result.length - 1,
					source[i]
				);
				if (replacedIdxInResult !== -1) {
					prevs[i] = result[replacedIdxInResult - 1] || -1;

					result[replacedIdxInResult] = i;
				} else {
					prevs[i] = result.length === 0 ? -1 : result[result.length - 1];
					result.push(i);
				}
			}

			const finalRes = [];
			const endIdxInSource = result[result.length - 1];
			finalRes.push(endIdxInSource);

			let prevIdxInSource = prevs[endIdxInSource];
			while (prevIdxInSource >= 0) {
				finalRes.push(prevIdxInSource);
				prevIdxInSource = prevs[prevIdxInSource];
			}
			return finalRes.reverse();
		};

		const bs = (result, source, l, r, num) => {
			while (l < r) {
				let mid = Math.floor((l + r) >> 1);
				if (source[result[mid]] > num) {
					r = mid;
				} else {
					l = mid + 1;
				}
			}
			if (source[result[l]] > num) return l;
			else return -1;
		};
	};

	const taskQueue = new Set();
	let isFlushing = false;
	const p = Promise.resolve();
	// 当有新任务需要执行时，往任务队列里添加。
	const flushTaskQueue = (task) => {
		taskQueue.add(task);
		if (!isFlushing) {
			isFlushing = true;
			p.then(() => {
				try {
					taskQueue.forEach((task) => {
						task();
					});
				} finally {
					isFlushing = false;
					taskQueue.clear();
				}
			});
		}
	};

	const setCurrentInstance = (instance) => {
		currentInstance = instance;
	};
	/**
	 * 挂载组件
	 */
	const mountComponent = (vnode, container, anchor) => {
		const isFunctionnal = typeof vnode.type === "function";
		let componentOptions = null;
		if (isFunctionnal) {
			componentOptions = {
				render: vnode.type,
				props: vnode.props,
			};
		} else {
			componentOptions = vnode.type;
		}
		const {
			data,
			propsOptions,
			setup,
			components,
			beforeCreate,
			created,
			beforeMount,
			mounted,
			unmounted,
			beforeUpdate,
			updated,
		} = componentOptions;
		let { render } = componentOptions;

		const state = data ? reactive(data()) : null;
		const [props, attrs] = resolveProps(propsOptions, vnode.props);
		const slots = vnode.children || {};

		beforeCreate && beforeCreate.call(state);

		const emits = (event, ...payload) => {
			const eventName = "on" + event[0].toUppercase() + event.slice(1);
			if (eventName in instance.props) {
				const handler = instance.props[eventName];
				if (handler) {
					handler(...payload);
				} else {
					console.warn("The event do not exits!");
				}
			}
		};

		const instance = {
			state,
			props: shallowReactive(props),
			components,
			slots,
			keepAliveContext: null,
			subTree: null,
			isMounted: false,
			created: created ? [created] : [],
			beforeMount: beforeMount ? [beforeMount] : [],
			mounted: mounted ? [mounted] : [],
			unmounted: unmounted ? [unmounted] : [],
			beforeUpdate: beforeUpdate ? [beforeUpdate] : [],
			updated: updated ? [updated] : [],
		};

		if (vnode.type._isKeepAlive) {
			instance.keepAliveContext = {
				move(vnode, container, anchor) {
					insert(vnode.component.subTree.el, container, anchor);
				},
				createElement,
			};
		}

		vnode.component = instance;

		let setupState = null;
		if (setup) {
			const setupContext = {
				attrs,
				emits,
				slots,
			};
			// 注册声明周期钩子会使用到currentInstance
			setCurrentInstance(instance);
			const setupResult = setup(shallowReadonly(instance.props), setupContext);
			setCurrentInstance(null);
			if (typeof setupResult === "function") {
				if (render) console.error(`render option will be ignored!`);
				render = setupResult;
			} else {
				setupState = setupResult;
			}
		}
		// 可自动脱ref
		const renderContext = proxyRefs(
			new Proxy(instance, {
				get(target, key, receiver) {
					const { state, props, slots, components } = target;
					if (props && key in props) {
						return props[key];
					} else if (state && key in state) {
						return state[key];
					} else if (setupState && key in setupState) {
						return setupState[key];
					} else if (slots && key in slots) {
						return slots[key];
					} else if (components && key in components) {
						return components[key];
					} else {
						console.warn("key not exits!");
					}
				},
				set(target, key, value, receiver) {
					const { state, props } = target;
					if (props && key in props) {
						console.warn(`Attemping to mutate props!`);
					} else if (state && key in state) {
						state[key] = value;
					} else if (setupState && key in setupState) {
						setupState[key] = value;
					} else {
						console.warn("key not exits!");
					}
					return true;
				},
			})
		);

		instance.created &&
			instance.created.forEach((hook) => {
				hook.call(renderContext);
			});
		effect(
			() => {
				// 指向renderContext
				const subTree = render.call(renderContext);
				if (!instance.isMounted) {
					instance.beforeMount &&
						instance.beforeMount.forEach((hook) => {
							hook.call(renderContext);
						});
					patch(null, subTree, container, anchor);
					instance.mounted &&
						instance.mounted.forEach((hook) => {
							hook.call(renderContext);
						});
					instance.isMounted = true;
				} else {
					instance.beforeUpdate &&
						instance.beforeUpdate.forEach((hook) => {
							hook.call(renderContext);
						});
					patch(instance.subTree, subTree, container, anchor);
					instance.updated &&
						instance.updated.forEach((hook) => {
							hook.call(renderContext);
						});
				}
				instance.subTree = subTree;
			},
			{
				scheduler: flushTaskQueue,
			}
		);
	};
	/**
	 * 更新组件
	 */
	const patchComponent = (oldVnode, newVnode) => {
		const propsHasChanged = (oldProps, newProps) => {
			const newPropsKeys = Object.keys(newProps);
			if (newPropsKeys.length !== Object.keys(oldProps).length) return true;

			for (let i = 0; i < newPropsKeys.length; i++) {
				if (newProps[newPropsKeys[i]] !== oldProps[newPropsKeys[i]])
					return true;
			}
			return false;
		};
		// instance的props
		const instance = (newVnode.component = oldVnode.component);
		const newProps = resolveProps(newVnode.type.propsOptions, newVnode.props);

		if (propsHasChanged(oldVnode.component.props, newProps)) {
			for (let key in newProps) {
				instance.props[key] = newProps[key];
			}

			for (let key in instance.props) {
				if (!(key in newProps)) {
					delete instance.props[key];
				}
			}
		}
	};

	const resolveProps = (propsOptions, propsData) => {
		const props = {};
		const attrs = {};
		for (let key in propsData) {
			// 事件处理函数也被添加到props中
			if (key in propsOptions || key.startsWith("on")) {
				props[key] = propsData[key];
			} else {
				attrs[key] = propsData[key];
			}
		}
		return [props, attrs];
	};

	return {
		render,
	};
};

export const renderer = createRenderer({
	createElement(type) {
		return document.createElement(type);
	},
	patchProps: patchProps,
	setElementText(el, children) {
		return (el.textContent = children);
	},
	createText(text) {
		const textNode = document.createTextNode(text);
		return textNode;
	},
	setText(el, newNodeValue) {
		el.nodeValue = newNodeValue;
	},
	createComment(comment) {
		const commentNode = document.createComment(comment);
		return commentNode;
	},
	insert(el, container, anchor = null) {
		container.insertBefore(el, anchor);
	},
});

function patchProps(el, key, nextValue) {
	const patchEvent = (el, key, nextValue) => {
		const eventName = key.slice(2).toLowerCase();
		const invokers = el._vei || (el._vei = {});

		let invoker = invokers[eventName];
		if (nextValue) {
			if (!invoker) {
				invoker = el._vei[eventName] = (e) => {
					if (e.timeStamp < el.attached) return;
					if (Array.isArray(invoker.value)) {
						invoker.value.forEach((fn) => fn(e));
					} else {
						invoker.value(e);
					}
				};
				invoker.value = nextValue;
				invoker.attached = performance.now();
				el.addEventListener(eventName, invoker);
			} else {
				invoker.value = nextValue;
			}
		} else {
			el.removeEventListener(eventName, invoker);
		}
	};

	const patchClass = (el, nextValue) => {
		let className = normalizeClass(nextValue);
		el.className = className;
		function normalizeClass(classObj) {
			if (typeof classObj === "string") {
				return classObj;
			} else if (typeof classObj === "object") {
				let className = "";
				if (Array.isArray(classObj)) {
					for (let name of classObj) {
						className += " " + normalizeClass(name);
					}
				} else {
					for (let name in classObj) {
						if (classObj[name]) {
							className += " " + name;
						}
					}
				}
				return className.trimStart();
			}
		}
	};

	const patchOtherProps = (el, key, nextValue) => {
		const type = typeof el[key];
		if (shouldSetAsProperty(el, key, nextValue)) {
			if (type === "boolean" && nextValue === "") {
				el[key] = true;
			} else {
				el[key] = nextValue;
			}
		} else {
			el.setAttributes(el, key, nextValue);
		}
	};

	if (/^on/.test(key)) {
		patchEvent(el, key, nextValue);
	} else if (key === "class") {
		patchClass(el, nextValue);
	} else {
		patchOtherProps(el, key, nextValue);
	}
}

const formElements = ["input", "select"];
const shouldSetAsProperty = (el, key) => {
	if (key === "form" && formElements.includes(el.tagNmae.toLowerCase())) {
		return false;
	}
	return key in el;
};

export const onCreated = (fn) => {
	currentInstance.created.push(fn);
};
export const onBeforeMount = (fn) => {
	currentInstance.beforeMount.push(fn);
};
export const onMounted = (fn) => {
	currentInstance.mounted.push(fn);
};
export const onBeforeUpdate = (fn) => {
	currentInstance.beforeUpdate.push(fn);
};
export const onUpdated = (fn) => {
	currentInstance.updated.push(fn);
};
export const onUnmounted = (fn) => {
	currentInstance.unmounted.push(fn);
};

export const defineAysncComponent = ({
	loader,
	errorComponent = null,
	delay = 0,
	timeout = 3000,
	reloadTimes = Infinity,
	loadingComponent = null,
	placeholder = "Loading...",
} = {}) => {
	/**
	 * 整个过程：
	 * 完成（包括了成功和失败）PK loading		==>		成功 PK 失败（延迟造成失败 | 加载失败）
	 */
	if (!loader) return null;
	let InnerComp = null;
	return {
		name: "AsyncComponentWrapper",
		setup() {
			const isLoading = ref(false);
			let loadingTimer = setTimeout(() => {
				isLoading.value = true;
				clearTimeout(loadingTimer);
			}, delay);

			let hasReloadedTimes = 0;
			let err = ref(false);
			const load = () => {
				loader()
					.then((val) => {
						InnerComp = val;
					})
					.catch(() => {
						if (hasReloadedTimes >= reloadTimes) {
							isLoading.value = false;
							err.value = true;
							return;
						}
						load();
						hasReloadedTimes++;
					});
			};
			let timeoutTimer = setTimeout(() => {
				isLoading.value = false;
				InnerComp = errorComponent;
				clearTimeout(timeoutTimer);
			}, timeout);
			load();

			return () => {
				if (isLoading.value) {
					return loadingComponent;
				}
				if (InnerComp) {
					return {
						tyep: InnerComp,
					};
				}
				if (err.value) {
					return errorComponent;
				}
				return { type: "span", children: placeholder };
			};
		},
	};
};

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
