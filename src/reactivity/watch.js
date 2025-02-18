import { effect } from "./effect.js";

export function watch(source, cb, options = {}) {
  let getter = null;
  let oldVal, newVal;
  // 在下一次执行回调时调用
  let cleanup = null;

  function onInvalidate(fn) {
    cleanup = fn;
  }

  // 执行回调并处理新旧值问题
  const job = () => {
    if (cleanup) cleanup();
    newVal = effectFn();
    cb(newVal, oldVal, onInvalidate);
    oldVal = newVal;
  };

  if (typeof source === "function") getter = source;
  else getter = () => traverse(source);

  const effectFn = effect(() => getter(), {
    lazy: true,
    scheduler() {
      if (options.flush === "post") {
        let task = Promise.resolve();
        task.then(() => {
          job();
        });
      } else {
        job();
      }
    },
  });
  // 解决watch创建侦听同时是否触发一个回调
  if (options.immediate) job();
  // 因为视图上要展现响应式数据呀
  else oldVal = effectFn();

  function traverse(val, seen = new Set()) {
    if (typeof val !== "object" || val === null || seen.has(val)) return;
    seen.add(val);
    for (let k in val) {
      traverse(val[k], seen);
    }
    return val;
  }
}
