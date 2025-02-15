import { shallowReactive } from "./reactive";

export function shallowRef(rawVal) {
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
	return shallowReactive(wrapper);
}