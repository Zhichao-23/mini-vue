const state = {
	initial: 1,
	tagOpen: 2,
	tagName: 3,
	text: 4,
	tagEnd: 5,
	tagEndName: 6,
};

const isAlpha = (char) => {
	return (char >= "a" && char <= "z") || (char >= "A" && char <= "Z");
};

const tokenize = (str) => {
	let currentState = state.initial;
	const chars = [];
	const tokens = [];
	for (let i = 0; i < str.length; i++) {
		const char = str[i];
		switch (currentState) {
			case state.initial: {
				if (isAlpha(char)) {
					currentState = state.text;
					chars.push(char);
				} else if (char === "<") {
					currentState = state.tagOpen;
				}
			}
      case state.tagOpen: {
        if (isAlpha(char)) {
          currentState = state.tagName;
          chars.push(char);
        } else if (char === '/') {
          currentState = state.tagEnd;
        }
      }
			case state.tagName: {
				if (isAlpha(char)) {
					chars.push(char);
				} else if (char === ">") {
					currentState = state.initial;
					tokens.push(chars.join(""));
					chars.length = 0;
				}
			}
			case state.text: {
				if (isAlpha(char)) {
					chars.push(char);
				} else if (char === "<") {
					currentState = state.tagOpen;
          tokens.push({
            type: "text",
            content: chars.join("")
          });
				}
			}
			case state.tagEnd: {
				if (isAlpha(char)) {
          currentState = state.tagEndName;
          chars.push(char);
        }
			}
      case state.tagEndName: {
        if (isAlpha(char)) {
          chars.push(char);
        } else if (char === '>') {
          currentState = state.initial;
          tokens.push({
            type: "tagEnd",
            name: chars.join("")
          });
        }
      }

		}
	}
  return tokens;
};
