let activeEffect;
let effectStack = [];
let bucket = new WeakMap();

function effect(fn, options = {}) {
	const effectFn = () => {
		cleanup(effectFn);
		// 栈后入先出，我们让栈顶始终是将要被添加的依赖。只要我们让activeEffect始终是栈顶的元素，问题就ko了。
		effectStack.push(effectFn);
		activeEffect = effectStack[effectStack.length - 1];
		// 执行完fn后会收集这个函数
		const res = fn();
		// 执行完源副作用函数后就将其移除栈
		effectStack.pop();
		activeEffect = effectStack[effectStack.length - 1];

		return res;
	};
	effectFn.options = options;
	effectFn.deps = [];
	if (!options.lazy) effectFn();

	return effectFn;

	function cleanup(effectFn) {
		effectFn.deps.forEach((dep) => {
			dep.delete(effectFn);
		});
		effectFn.deps.length = 0;
	}
}

function track(target, key) {
	if (!activeEffect || !shouldTrack) return;

	let depsMap = bucket.get(target);
	if (!depsMap) bucket.set(target, (depsMap = new Map()));

	let deps = depsMap.get(key);
	if (!deps) depsMap.set(key, (deps = new Set()));

	deps.add(activeEffect);
	// 为函数收集依赖集合
	activeEffect.deps.push(deps);
}

function trigger(target, key, type, newVal) {
	const depsMap = bucket.get(target);
	if (!depsMap) return;
	const effects = depsMap.get(key);
	const iterateEffects = depsMap.get(iterateKeys.get(target));
	const mapIterateEffects = depsMap.get(mapIterateKeys.get(target));

	// effectFn中进行了依赖清除，同时又重新收集了依赖。但是forEach仍然在继续，会产生无效循环。
	// effects && effects.forEach(effectFn => effectFn())
	// 我们创建一个副本，执行副本集合中副作用函数，函数修改的是原set的大小。
	const effectsToRun = new Set();

	// 如果代理是数组，对于length删除元素，那么索引大于等于length的要触发响应。
	if (Array.isArray(target)) {
		depsMap.forEach((key, effects) => {
			if (key >= newVal) {
				effects.forEach((effectFn) => {
					if (effectFn !== activeEffect) {
						effectsToRun.add(effectFn);
					}
				});
			}
		});
	}

	effects &&
		effects.forEach((effectFn) => {
			if (effectFn !== activeEffect) effectsToRun.add(effectFn);
		});
	if (type === "ADD" || type === "DELLTE") {
		iterateEffects &&
			iterateEffects.forEach((iterateEffect) => {
				if (iterateEffect !== activeEffect) effectsToRun.add(iterateEffect);
			});
	}
	if (Object.prototype.toString.call(target) === "[object Map]") {
		mapIterateEffects &&
			mapIterateEffects.forEach((iterateEffect) => {
				if (iterateEffect !== activeEffect) effectsToRun.add(iterateEffect);
			});
	}

	effectsToRun.forEach((effectFn) => {
		if (effectFn.options.scheduler) {
			effectFn.options.scheduler(effectFn);
		} else {
			effectFn();
		}
	});
}

function computed(getter) {
	let value,
		dirty = true;

	const effectFn = effect(getter, {
		lazy: true,
		scheduler() {
			if (!dirty) {
				dirty = true;
				trigger(obj, "value");
			}
		},
	});

	return {
		get value() {
			if (!dirty) return value;
			value = effectFn();
		},
	};
}

function wacth(source, cb, options = {}) {
	let getter = null;
	let oldVal, newVal;
	// 在下一次执行回调时调用
	let cleanup = null;

	function onInvalidate(fn) {
		cleanup = fn;
	}

	// 执行回调并处理新旧值问题
	const job = () => {
		if (cleanup) cleanup();
		newVal = effectFn();
		cb(newVal, oldVal, onInvalidate);
		oldVal = newVal;
	};

	if (typeof source === "function") getter = source;
	else getter = () => traverse(source);

	const effectFn = effect(() => getter(), {
		lazy: true,
		scheduler() {
			if (options.flush === "post") {
				let task = new Promise.resolve();
				task.then(() => {
					job();
				});
			} else {
				job();
			}
		},
	});
	// 解决watch创建侦听同时是否触发一个回调
	if (options.immediate) job();
	else oldVal = effectFn();

	function traverse(val, seen = new Set()) {
		if (typeof val !== "object" || val === null || seen.has(val)) return;
		seen.add(val);
		for (let k in val) {
			traverse(val[k], seen);
		}
		return val;
	}
}

const jobQueue = new Set();
const p = Promise.resolve();
let isFlushing = false;
function flushJob() {
	if (isFlushing) return;
	isFlushing = true;
	// 异步执行副作用函数，在执行之前对于属性同步的修改都已经执行完成。同时我们又使用了set去除了重复的副作用函数，
	// 使得最后只执行了一次不同的副作用函数。
	p.then(() => {
		jobQueue.forEach((job) => job());
	}).finally(() => {
		isFlushing = false;
	});
}

function reactive(obj) {
	return createReactive(obj, false, false);
}
function shallowReactive(obj) {
	return createReactive(obj, true, false);
}
function readonly(obj) {
	return createReactive(obj, false, true);
}
function shallowReactive(obj) {
	return createReactive(obj, true, true);
}

let reactiveMap = new Map();
let iterateKeys = new WeakMap();
let mapIterateKeys = new WeakMap();
function createReactive(obj, isShallow, isReadonly) {
	const ITERATE_KEY = Symbol();

	iterateKeys.set(obj, ITERATE_KEY);

	const targetType = Object.prototype.toString(obj);

	let Map_ITERATE_KEY;
	if (targetType === "[object Map]") {
		Map_ITERATE_KEY = Symbol();
		mapIterateKeys.set(obj, Map_ITERATE_KEY);
	}

	return new Proxy(obj, {
		get(target, key) {
			if (key === "raw") return target;

			if (
				Array.isArray(target) &&
				Object.prototype.hasOwnProperty.call(arrayInstrumentations, key)
			) {
				return arrayInstrumentations[key];
			}

			if (target instanceof Map || target instanceof Set) {
				if (key === "size") {
					return Reflect.get(target, key, target);
				}

				if (
					Object.prototype.hasOwnProperty.call(mutableInstrumentations, key)
				) {
					return mutableInstrumentations[key];
				}
			}
			//只读的对象，它的属性值不会发生改变，也就不需要进行收集了
			if (!isReadonly) track(target, key);

			const res = Reflect.get(target, key);
			if (isShallow) return res;
			if (typeof res === "object" && res !== null) {
				let reactiveObj = null;
				if (reactiveMap.has(res)) reactiveObj = reactiveMap.get(res);
				else {
					reactiveObj = reactive(res);
					reactiveMap.set(res, reactiveObj);
				}
				return isReadonly ? readonly(res) : reactiveObj;
			}
			return res;
		},
		set(target, key, newVal, receiver) {
			if (isReadonly) {
				console.warn(`属性${key}是只读的`);
				return true;
			}

			const type = Array.isArray(target)
				? Number(key) > target.length
					? "ADD"
					: "SET"
				: Object.prototype.hasOwnProperty.call(target, key)
				? "SET"
				: "ADD";

			const oldVal = target[key];
			if (newVal !== oldVal) {
				const res = Reflect.set(target, key, newVal, receiver);
				trigger(target, key, type);
				return res;
			}
			return true;
		},
		ownKeys(target) {
			track(target, ITERATE_KEY);
			return Reflect.ownKeys(target);
		},
		has(target, key) {
			track(target, key);
			return Reflect.has(target, key);
		},
		deleteProperty(target, key) {
			if (isReadonly) {
				console.warn(`属性${key}是只读的`);
				return true;
			}
			const hasKey = Object.prototype.hasOwnProperty.call(target, key);
			const res = Reflect.deleteProperty(target, key);
			if (res && hasKey) {
				trigger(target, key, "DELLETE");
			}
			return res;
		},
		setPrototypeOf(target, prototype) {
			targetProto = prototype.raw;
			return Reflect.setPrototypeOf(target, targetProto);
		},
	});
}
// 处理数组
const arrayInstrumentations = {};
["indexOf", "lastIndexOf", "includes"].forEach((method) => {
	arrayInstrumentations[method] = function (...args) {
		const originMethod = Array.prototype[method];
		let res = originMethod.apply(this, args);
		if (res === false || res === -1) {
			res = originMethod.apply(this.raw);
		}
		return res;
	};
});
let shouldTrack = true;
["push", "shift", "pop", "unshift", "splice"].forEach((method) => {
	const orignalMethod = tagrget[method];
	arrayInstrumentations[key] = function (...args) {
		shouldTrack = false;
		const res = orignalMethod.apply(this, args);
		shouldTrack = true;
		return res;
	};
});

// 重写map和set的方法
const wrap = (val) => (typeof val === "object" ? reactive(val) : val);
const mutableInstrumentations = {
	set(key, val) {
		const target = this.raw;
		const hadKey = target.has(key);
		// 旧值
		const oldVal = target.get(key);
		// 新增
		const rawVal = val.raw || val;
		target.set(key, rawVal);
		if (!hadKey) {
			trigger(target, key, "ADD");
		} else if ((oldVal !== val && oldVal === oldVal) || val === val) {
			trigger(target, key, "SET");
		}
	},
	get(key) {
		const target = this.raw;
		const res = target.get(key);
		track(target, key);
		return typeof res === "object" ? reactive(res) : res;
	},
	add(key) {
		const target = this.raw;
		const hasKey = target.has(key);
		const res = target.add(key);
		// 如果原来没有这个属性，才触发响应
		if (!hasKey) {
			trigger(target, key, "ADD");
		}
		return res;
	},
	delete(key) {
		const target = this.raw;
		const hasKey = target.has(key);
		const res = target.delete(key);
		if (hasKey) {
			trigger(target, key, "DELLETE");
		}
		return res;
	},
	has(key) {
		return target.has(key);
	},
	// map的forEach方法既访问键，又访问值
	forEach(cb, thisArg) {
		const target = this.raw;
		const Map_ITERATE_KEY = mapIterateKeys.get(this.raw);
		track(target, Map_ITERATE_KEY);

		target.forEach((val, key) => {
			cb.call(thisArg, wrap(val), wrap(key), this);
		});
	},
	[Symbol.iterator]() {
		const target = this.raw;
		const ITERATE_KEY = iterateKeys.get(this.raw);
		track(target, ITERATE_KEY);

		const itr = target[Symbol.iterator]();
		return {
			next() {
				const { value, done } = itr.next();
				return {
					value: value ? [wrap(value[0]), wrap(value[1])] : value,
					done: done,
				};
			},
			[Symbol.iterator]() {
				return this;
			},
		};
	},
	entries: [Symbol.iterator],
	values() {
		const target = this.raw;
		const Map_ITERATE_KEY = mapIterateKeys.get(this.raw);
		track(target, Map_ITERATE_KEY);
		const itr = target.values();
		return {
			next() {
				const { value, done } = itr.next();
				return {
					value: wrap(value),
					done: done,
				};
			},
			[Symbol.iterator]() {
				return this;
			},
		};
	},
	keys() {
		const target = this.raw;
		const ITERATE_KEY = iterateKeys.get(this.raw);
		track(target, ITERATE_KEY);
		const itr = target.values();
		return {
			next() {
				const { value, done } = itr.next();
				return {
					value: wrap(value),
					done: done,
				};
			},
			[Symbol.iterator]() {
				return this;
			},
		};
	},
};

/**
 * 非原始值的响应式
 */
function ref(rawVal) {
	const wrapper = {
		get value() {
			return rawVal;
		},
	};
	Object.defineProperty(wrapper, "__v_isRef", {
		value: true,
	});
	return reactive(wrapper);
}

function toRef(obj, key) {
	const wrapper = {
		get value() {
			// 即使是原始数据类型也不会与原始的响应式对象断开联系
			return obj[key];
		},
	};
	return wrapper;
}

function toRefs(obj) {
	const wrapper = {};
	for (let key in obj) {
		wrapper[key] = toRef(obj, key);
	}
	return wrapper;
}

function proxyRefs() {
	return new Proxy(target, {
		get(target, key) {
			const value = Reflect.get(target, key, receiver);
			return value.__v_isRef ? value.value : value;
		},
		set(target, key, newVal, receiver) {
			const value = target[key];
			if (value__v_isRef) {
				return Reflect.set(value, "value", newVal, receiver);
			} else {
				return Reflect.set(target, value, newVal, receiver);
			}
		},
	});
}
