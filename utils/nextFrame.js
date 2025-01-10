const nextFrame = (cb) => {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      cb();
    });
  })
};

export default nextFrame;