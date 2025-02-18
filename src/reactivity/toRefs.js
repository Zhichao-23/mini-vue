import { toRef } from "./toRef.js";

export function toRefs(reactiveObj) {
	const wrapper = {};
	for (let key in reactiveObj) {
		wrapper[key] = toRef(reactiveObj, key);
	}
	return wrapper;
}