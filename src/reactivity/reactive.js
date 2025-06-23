import { iterateKeys, mapIterateKeys, track, trigger } from "./effect.js";
let reactiveMap = new Map();


export let shouldTrack = true;

export function reactive(obj) {
	return createReactive(obj, false, false);
}
export function shallowReactive(obj) {
	return createReactive(obj, true, false);
}
export function readonly(obj) {
	return createReactive(obj, false, true);
}
export function shallowReadonly(obj) {
	return createReactive(obj, true, true);
}

function createReactive(obj, isShallow, isReadonly) {
	const ITERATE_KEY = Symbol();

	iterateKeys.set(obj, ITERATE_KEY);

	const targetType = obj.toString();

	let Map_ITERATE_KEY;
	if (targetType === "[object Map]") {
		Map_ITERATE_KEY = Symbol();
		mapIterateKeys.set(obj, Map_ITERATE_KEY);
	}

	return new Proxy(obj, {
		get(target, key) {
			if (key === "raw") return target;

			// 访问数组的查找和修改方法
			if (Array.isArray(target) &&
				Object.prototype.hasOwnProperty.call(arrayInstrumentations, key)
			) {
				return arrayInstrumentations[key];
			}

			if (target instanceof Map || target instanceof Set) {
				if (key === "size") {
					return Reflect.get(target, key, target);
				}
				if (Object.prototype.hasOwnProperty.call(mutableInstrumentations, key)) {
					return mutableInstrumentations[key];
				}
			}
			//只读的对象，它的属性值不会发生改变，也就不需要进行收集了
			if (!isReadonly) track(target, key);

			const res = Reflect.get(target, key);

			// 若是浅响应的对象，直接返回原对象
			if (isShallow) return res;
			// 若不是浅响应，需要用reactive包裹
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
				console.warn(`属性${String(key)}是只读的`);
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
				console.warn(`属性${String(key)}是只读的`);
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
			const targetProto = prototype.raw;
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
			res = originMethod.apply(this.raw, args);
		}
		return res;
	};
});

["push", "shift", "pop", "unshift", "splice"].forEach((method) => {
	const orignalMethod = Array.prototype[method];
	arrayInstrumentations[method] = function (...args) {
		shouldTrack = false;
		const res = orignalMethod.apply(this, args);
		shouldTrack = true;
		return res;
	};
});

const wrap = (val) => (typeof val === "object" ? reactive(val) : val);

// 重写map和set的方法
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
	has(key, target) {
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
