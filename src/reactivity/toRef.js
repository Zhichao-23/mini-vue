export function toRef(reactiveObj, key) {
	const wrapper = {
		get value() {
			// 即使是原始数据类型也不会与原始的响应式对象断开联系
			return reactiveObj[key];
		},
		set value(newVal) {
			reactiveObj[key] = newVal;
		},
	};
	Object.defineProperty(reactiveObj, "__v_isRef", {
		value: true,
	});
	return wrapper;
}