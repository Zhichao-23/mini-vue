export {
	createElement,
	setElementText,
	createText,
	setText,
	createComment,
	insert,
	patchProps,
};

function createElement(type) {
	return document.createElement(type);
}
function setElementText(el, children) {
	return (el.textContent = children);
}
function createText(text) {
	return document.createTextNode(text);
}
function setText(el, newNodeValue) {
	el.nodeValue = newNodeValue;
}
function createComment(comment) {
	return document.createComment(comment);
}
function insert(el, container, anchor = null) {
	container.insertBefore(el, anchor);
}

function patchProps(el, key, nextValue) {
	if (/^on/.test(key)) {
		_patchEvent(el, key, nextValue);
	} else if (key === "class") {
		_patchClass(el, nextValue);
	} else {
		_patchOtherProps(el, key, nextValue);
	}
}

const _patchEvent = (el, key, nextValue) => {
	const eventName = key.slice(2).toLowerCase();
	const invokers = el._vei || (el._vei = {});

	let invoker = invokers[eventName];
	if (nextValue) {
		if (!invoker) {
			invoker = el._vei[eventName] = (e) => {
				if (e.timeStamp < el.attached) return;
				if (Array.isArray(invoker.value)) {
					invoker.value.forEach((fn) => fn(e));
				} else {
					invoker.value(e);
				}
			};
			invoker.value = nextValue;
			invoker.attached = performance.now();
			el.addEventListener(eventName, invoker);
		} else {
			invoker.value = nextValue;
		}
	} else {
		el.removeEventListener(eventName, invoker);
	}
};

const _patchClass = (el, nextValue) => {
	el.className = _normalizeClass(nextValue);
};
const _normalizeClass = (classObj) => {
	if (typeof classObj === "string") {
		return classObj;
	} else if (typeof classObj === "object") {
		let className = "";
		if (Array.isArray(classObj)) {
			for (let name of classObj) {
				className += " " + normalizeClass(name);
			}
		} else {
			for (let name in classObj) {
				if (classObj[name]) {
					className += " " + name;
				}
			}
		}
		return className.trimStart();
	}
}
const _formElements = ["input", "select", "button"];
const _patchOtherProps = (el, key, nextValue) => {
	const type = typeof el[key];
	if (_shouldSetAsProperty(el, key)) {
		if (type === "boolean" && nextValue === "") {
			el[key] = true;
		} else {
			el[key] = nextValue;
		}
	} else {
		el.setAttributes(el, key, nextValue);
	}
};
const _shouldSetAsProperty = (el, key) => {
	if (key === "form" && _formElements.indexOf(el.tagNmae.toLowerCase()) != -1) {
		return false;
	}
	return key in el;
};
