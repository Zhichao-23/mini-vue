import { reactive } from "./reactive.js";
/**
 * 非原始值的响应式
 */
export function ref(rawVal) {
	const wrapper = {
		get value() {
			return rawVal;
		},
		set value(newVal) {
			rawVal = newVal;
		},
	};
	Object.defineProperty(wrapper, "__v_isRef", {
		value: true,
	});
	// 包裹一下可以实现深层代理
	return reactive(wrapper);
}






