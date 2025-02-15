export const Teleport = {
	name: "teleport",
	_isTeleport: true,
	process(oldVnode, newVnode, options) {
		const {
			patch,
			patchChildren,
			move
		} = options;

		const to = 
			typeof newVnode.props.to === "string" 
			? document.querySelector(newVnode.props.to)
			: newVnode.props.to;
		const children = newVnode.children;
		if (!oldVnode) {
			children.forEach(child => {
				patch(null, child, to, null);
			});
		} else {
			patchChildren(oldVnode.children, newVnode.children);
			if (to !== oldVnode.props.to) {
				children.forEach(child => {
					move(child, to);
				}); 
			}
		}
	}
};