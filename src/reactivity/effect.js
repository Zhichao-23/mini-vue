import { shouldTrack } from "./reactive";

let activeEffect;
let effectStack = [];
let bucket = new WeakMap();

export let iterateKeys = new WeakMap();
export let mapIterateKeys = new WeakMap();

export function effect(fn, options = {}) {
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

export function track(target, key) {
	if (!activeEffect || !shouldTrack) return;

	let depsMap = bucket.get(target);
	if (!depsMap) bucket.set(target, (depsMap = new Map()));

	let deps = depsMap.get(key);
	if (!deps) depsMap.set(key, (deps = new Set()));

	deps.add(activeEffect);
	// 为函数收集依赖集合
	activeEffect.deps.push(deps);
}

export function trigger(target, key, type, newVal) {
	const depsMap = bucket.get(target);
	if (!depsMap) return;

	const effects = depsMap.get(key);
	const iterateEffects = depsMap.get(iterateKeys.get(target));
	const mapIterateEffects = depsMap.get(mapIterateKeys.get(target));
	// 若直接指向桶中依赖，会造成无限循环。
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
	if (type === "ADD" || type === "DELLETE") {
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
