import { effect } from "../reactivity";
import { proxyRefs } from "../reactivity";
import {
	reactive,
	shallowReactive,
	shallowReadonly,
} from "../reactivity";
import { createElement, insert } from "./DOMOps.js";
import { patch } from "./patch.js";
import { resolveProps } from "./resolveProps.js";

/**
 * 挂载组件
 */
export function mountComponent(vnode, container, anchor) {
	let componentOptions = null;
	if (_isFunctionnal(vnode)) {
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
		_setCurrentInstance(instance);
		const setupResult = setup(shallowReadonly(instance.props), setupContext);
		_setCurrentInstance(null);
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
			get(target, key) {
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
			scheduler: _flushTaskQueue,
		}
	);
}

function _isFunctionnal(vnode) {
	return typeof vnode.type === "function";
}

const _taskQueue = new Set();
let _isFlushing = false;
const _p = Promise.resolve();
// 当有新任务需要执行时，往任务队列里添加。
function _flushTaskQueue(task) {
	_taskQueue.add(task);
	if (!_isFlushing) {
		_isFlushing = true;
		_p.then(() => {
			try {
				_taskQueue.forEach((task) => {
					task();
				});
			} finally {
				_isFlushing = false;
				_taskQueue.clear();
			}
		});
	}
}

export let currentInstance = null;
function _setCurrentInstance(instance) {
	currentInstance = instance;
}

