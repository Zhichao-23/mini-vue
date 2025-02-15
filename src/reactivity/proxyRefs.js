
export function proxyRefs(target) {
	return new Proxy(target, {
		get(target, key, receiver) {
			const value = Reflect.get(target, key, receiver);
			return value.__v_isRef ? value.value : value;
		},
		set(target, key, newVal, receiver) {
			const value = target[key];
			if (value.__v_isRef) {
				return Reflect.set(value, "value", newVal, receiver);
			} else {
				return Reflect.set(target, value, newVal, receiver);
			}
		},
	});
}
