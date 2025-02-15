import { resolveProps } from "./resolveProps";

/**
 * 更新组件
 */
export function patchComponent(oldVnode, newVnode) {
	// instance的props
	const instance = (newVnode.component = oldVnode.component);
	const newProps = resolveProps(newVnode.type.propsOptions, newVnode.props);

	if (_propsHasChanged(oldVnode.component.props, newProps)) {
		for (let key in newProps) {
			instance.props[key] = newProps[key];
		}

		for (let key in instance.props) {
			if (!(key in newProps)) {
				delete instance.props[key];
			}
		}
	}
}
function _propsHasChanged(oldProps, newProps) {
	const newPropsKeys = Object.keys(newProps);
	if (newPropsKeys.length !== Object.keys(oldProps).length) return true;

	for (let i = 0; i < newPropsKeys.length; i++) {
		if (newProps[newPropsKeys[i]] !== oldProps[newPropsKeys[i]]) return true;
	}
	return false;
}
