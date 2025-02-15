export const Transition = {
	name: "transition",
	propsOptions: {
		name: String,
	},
	setup(props, { slots }) {
		const prefix = props.name || "";
		return () => {
			const inner = slots.default();

			inner.shouldTransition = true;

			inner.transition = {
				beforeEnter: (el) => {
					el.classList.add(`${prefix}-enter-from`);
					el.classList.add(`${prefix}-enter-active`);
				},
				enter: (el) => {
					el.classList.remove(`${prefix}-enter-from`);
					el.classList.add(`${prefix}-enter-to`);
					el.addEventListener("transitionend", () => {
						el.classList.remove(`${prefix}-enter-to`);
						el.classList.remove(`${prefix}-enter-active`);
					});
				},
				beforeLeave: (el) => {
					el.classList.add(`${prefix}-leave-from`);
					el.classList.add(`${prefix}-leave-active`);
					document.body.offsetHeight;
				},
				leave: (el, performRemove) => {
					el.classList.remove(`${prefix}-leave-from`);
					el.classList.add(`${prefix}-leave-to`);
					el.addEventListener("transitionend", () => {
						performRemove(el.parentNode, el);
						el.classList.remove(`${prefix}-leave-to`);
						el.classList.remove(`${prefix}-leave-active`);
					});
				}
			};
			return inner;
		};
	}
};

