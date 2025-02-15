export function resolveProps(propsOptions, propsData) {
	const props = {};
	const attrs = {};
	for (let key in propsData) {
		// 事件处理函数也被添加到props中
		if (key in propsOptions || key.startsWith("on")) {
			props[key] = propsData[key];
		} else {
			attrs[key] = propsData[key];
		}
	}
	return [props, attrs];
}
