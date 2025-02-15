export function nextFrame(cb) {
	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			cb();
		});
	});
}
