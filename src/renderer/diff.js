import { insert } from "./DOMOps.js";
import { patch } from "./patch.js";
import { unmount } from "./unmount.js";

const simpleDiff = (oldChilren, newChildren, container) => {
	let lastIndex = 0;
	for (let i = 0; i < newChildren.length; i++) {
		const newChild = newChildren[i];
		let find = false;
		for (let j = 0; j < oldChilren.length; j++) {
			const oldChild = oldChilren[j];
			if (newChild.key === oldChild.key) {
				find = true;
				if (j < lastIndex) {
					const preChild = newChildren[i - 1];
					if (preChild) {
						const anchor = preChild.el.nextSibling;
						insert(newChild.el, container, anchor);
					} else {
						const anchor = container.firstChild;
						insert(newChild.el, container, anchor);
					}
				} else {
					patch(oldChild, newChild, container);
					lastIndex = j;
				}
				break;
			}
		}
		// 处理新增节点
		if (!find) {
			let anchor = null;
			const preChild = newChildren[i - 1] || null;
			if (preChild) {
				anchor = preChild.el.nextSibling;
			}
			patch(null, newChild, container, anchor);
		}
	}

	// 删除不存在的节点
	for (let i = 0; i < oldChilren.length; i++) {
		const oldChild = oldChilren[i];
		let find = false;
		for (let j = 0; j < newChildren.length; j++) {
			const newChild = newChildren[j];
			if (oldChild.key === newChild.key) {
				find = true;
			}
		}
		if (!find) {
			unmount(oldChild);
		}
	}
};
const doubleEndDiff = (oldChilren, newChildren, container) => {
	let newStartIdx = 0,
		newEndIdx = newChildren.length - 1;
	let oldStartIdx = 0,
		oldEndIdx = oldChilren.length - 1;
	let newStartNode = newChildren[newStartIdx];
	let newEndNode = newChildren[newEndIdx];
	let oldStartNode = oldChilren[oldStartIdx];
	let oldEndNode = oldChilren[oldEndIdx];

	while (newStartIdx <= newEndIdx && oldStartIdx <= oldEndIdx) {
		if (!oldStartNode) {
			oldStartNode = newChildren[++oldStartIdx];
		} else if (!oldEndNode) {
			oldEndNode = newChildren[--oldEndIdx];
		} else if (newStartNode.key === oldStartNode.key) {
			patch(oldStartNode, newStartNode, container);
			newStartNode = newChildren[++newStartIdx];
			oldStartNode = oldChilren[++oldStartIdx];
		} else if (newEndNode.key === oldEndNode.key) {
			patch(oldEndNode, newEndNode, container);
			newEndNode = newChildren[--newEndNode];
			oldEndNode = oldChilren[--oldEndIdx];
		} else if (newStartNode.key === oldEndNode.key) {
			patch(oldEndNode, newStartNode, container);
			insert(oldEndNode.el, container, newStartNode.el);
			newStartNode = newChildren[++newStartIdx];
			oldEndNode = oldChilren[--oldEndIdx];
		} else if (newEndNode.key === oldStartNode.key) {
			patch(oldStartNode, newEndNode, container);
			insert(oldEndNode.el, container, oldEndNode.el.nextSibling);
			newEndNode = newChildren[--newEndIdx];
			oldStartNode = oldChilren[++oldStartIdx];
		} else {
			const idxInOld = oldChilren.findIndex((vnode) => {
				vnode.key === newStartNode.key;
			});
			if (idxInOld > 0) {
				let vnodeToMove = oldChilren[idxInOld];
				patch(vnodeToMove, newStartNode, container);
				insert(vnodeToMove.el, container, oldStartNode.el);
				vnodeToMove = null;
			} else {
				patch(null, newStartNode, container, oldStartNode.el);
			}
			newStartNode = newChildren[++newStartIdx];
		}
	}
	// 有时当新节点位于队头或者队尾时，循环处理不到
	if (oldEndIdx < oldStartIdx && newStartIdx <= newEndIdx) {
		for (let i = newStartIdx; i <= newEndIdx; i++) {
			const anchor = newChildren[newEndIdx + 1]
				? newChildren[newEndIdx + 1].el
				: null;
			patch(null, newChildren[newStartIdx], container, anchor);
		}
	} else if (oldStartIdx <= oldEndIdx && newEndIdx < newStartIdx) {
		// 卸载旧节点
		for (let i = oldStartIdx; i <= oldEndIdx; i++) {
			unmount(oldChilren[i]);
		}
	}
};

export function quickDiff(oldChilren, newChildren, container) {
	// 前置节点
	let j = 0;
	let minLen = Math.min(oldChilren.length, newChildren.length);
	for (; j < minLen && oldChilren[j].key === newChildren[j].key; j++) {
		patch(oldChilren[j], newChildren[j], container, null);
	}
	// 后置节点
	let newEnd = newChildren.length - 1,
		oldEnd = oldChilren.length - 1;
	while (
		newEnd >= j &&
		oldEnd >= j &&
		oldChilren[oldEnd].key === newChildren[newEnd].key
	) {
		patch(oldChilren[oldEnd], newChildren[newEnd], null);
		oldEnd--;
		newEnd--;
	}

	let newStart = j,
		oldStart = j;
	if (newStart <= newEnd && oldStart > oldEnd) {
		// 中间都是新节点
		const anchor = newChildren[newEnd + 1].el || null;
		for (let i = newStart; i <= newEnd; i++) {
			patch(null, newChildren[i], container, anchor);
		}
	} else if (newStart > newEnd && oldStart <= oldEnd) {
		for (let i = oldStart; i <= oldEnd; i++) {
			unmount(oldChilren[i]);
		}
	} else if (newStart <= newEnd && oldStart <= oldEnd) {
		// 建立新节点的key-index表
		const keyIndexMap = {};
		for (let i = newStart; i <= newEnd; i++) {
			keyIndexMap[newChildren[i].key] = i;
		}
		// 遍历旧节点，建立source(新节点对应的旧节点的索引)
		const source = new Array(newEnd - newStart + 1);
		let moved = false; // 判断时候有节点需要移动
		let lastIndex = newStart;
		source.fill(-1);
		for (let i = oldStart; i <= oldEnd; i++) {
			const oldChild = oldChilren[i];
			const key = oldChild.key;
			if (keyIndexMap[key] !== undefined) {
				const newChild = newChildren[keyIndexMap[key]];
				patch(oldChild, newChild, container, null);
				source[keyIndexMap[key] - newStart] = i;

				const newChildIndex = keyIndexMap[key];
				if (newChildIndex < lastIndex) {
					moved = true;
				} else {
					lastIndex = newChildIndex;
				}
			} else {
				unmount(oldChild);
			}
		}

		if (moved || source.length > oldEnd - oldStart + 1) {
			const seq = _getLis(source);
			let k = seq.length - 1;
			for (let i = source.length - 1; i >= 0; i--) {
				const pos = i + newStart;
				const newChild = newChildren[pos];
				const anchor = newChildren[pos + 1] || null;
				if (source[i] === -1) {
					patch(null, newChild, container, anchor);
				} else if (i === seq[k]) {
					k--;
				} else {
					insert(newChild, container, anchor);
				}
			}
		}
	}
}

const _getLis = (source) => {
	const result = [];
	const prevs = Array.from(source); // 记录以source[i]结尾的最长递增子序列，source[i]前一个节点的索引
	for (let i = 0; i < source.length; i++) {
		const replacedIdxInResult = _bs(
			result,
			source,
			0,
			result.length - 1,
			source[i]
		);
		if (replacedIdxInResult !== -1) {
			prevs[i] = result[replacedIdxInResult - 1] || -1;

			result[replacedIdxInResult] = i;
		} else {
			prevs[i] = result.length === 0 ? -1 : result[result.length - 1];
			result.push(i);
		}
	}

	const finalRes = [];
	const endIdxInSource = result[result.length - 1];
	finalRes.push(endIdxInSource);

	let prevIdxInSource = prevs[endIdxInSource];
	while (prevIdxInSource >= 0) {
		finalRes.push(prevIdxInSource);
		prevIdxInSource = prevs[prevIdxInSource];
	}
	return finalRes.reverse();
};

const _bs = (result, source, l, r, num) => {
	while (l < r) {
		let mid = Math.floor((l + r) >> 1);
		if (source[result[mid]] > num) {
			r = mid;
		} else {
			l = mid + 1;
		}
	}
	if (source[result[l]] > num) return l;
	else return -1;
};
