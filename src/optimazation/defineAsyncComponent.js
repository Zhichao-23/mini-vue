import { ref } from "../reactivity/ref";

export function defineAysncComponent({
	loader = null,
	errorComponent = null,
	delay = 0,
	timeout = 3000,
	reloadTimes = Infinity,
	loadingComponent = null,
	placeholder = "Loading...",
} = {}) {
	/**
	 * 整个过程：
	 * 完成（包括了成功和失败）PK loading		==>		成功 PK 失败（延迟造成失败 | 加载失败）
	 */
	if (!loader) return null;
	let InnerComp = null;
	return {
		name: "AsyncComponentWrapper",
		setup() {
			const isLoading = ref(false);
			let loadingTimer = setTimeout(() => {
				isLoading.value = true;
				clearTimeout(loadingTimer);
			}, delay);

			let hasReloadedTimes = 0;
			let err = ref(false);
			const load = () => {
				loader()
					.then((val) => {
						InnerComp = val;
					})
					.catch(() => {
						if (hasReloadedTimes >= reloadTimes) {
							isLoading.value = false;
							err.value = true;
							return;
						}
						load();
						hasReloadedTimes++;
					});
			};
			let timeoutTimer = setTimeout(() => {
				isLoading.value = false;
				InnerComp = errorComponent;
				clearTimeout(timeoutTimer);
			}, timeout);
			load();

			return () => {
				if (isLoading.value) {
					return loadingComponent;
				}
				if (InnerComp) {
					return {
						tyep: InnerComp,
					};
				}
				if (err.value) {
					return errorComponent;
				}
				return { type: "span", children: placeholder };
			};
		},
	};
}
