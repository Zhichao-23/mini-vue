import { currentInstance } from "./mountComponent.js";

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
