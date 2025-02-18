import { effect, trigger, track } from "./effect.js";
export function computed(getter) {
  let value,
    dirty = true;
  const effectFn = effect(getter, {
    lazy: true,
    scheduler() {
      dirty = true;
      // 手动触发trigger
      trigger(obj, "value");
    },
  });

  const obj = {
    get value() {
      // 不脏就不会触发依赖
      if (dirty) {
        value = effectFn();
        dirty = false;
      }
      track(obj, "value");
      return value;
    },
  };

  return obj;
}