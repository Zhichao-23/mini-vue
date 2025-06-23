const state = {
  initial: 1,
  tagOpen: 2,
  tagName: 3,
  text: 4,
  tagEnd: 5,
  tagEndName: 6,
};

const isAlpha = (char) => {
  return (char >= "a" && char <= "z") || (char >= "A" && char <= "Z" || char >= '0' && char <= '9');
};

export const _tokenize = (str) => {
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
        break;
      }

      case state.tagOpen: {
        if (isAlpha(char)) {
          currentState = state.tagName;
          chars.push(char);
        } else if (char === "/") {
          currentState = state.tagEnd;
        }
        break;
      }

      case state.tagName: {
        if (isAlpha(char)) {
          chars.push(char);
        } else if (char === ">") {
          currentState = state.initial;
          tokens.push({
            type: "tag",
            name: chars.join(""),
          });
          chars.length = 0;
        }
        break;
      }

      case state.text: {
        if (isAlpha(char)) {
          chars.push(char);
        } else if (char === "<") {
          currentState = state.tagOpen;
          tokens.push({
            type: "text",
            content: chars.join(""),
          });
          chars.length = 0;
        }
        break;
      }

      case state.tagEnd: {
        if (isAlpha(char)) {
          currentState = state.tagEndName;
          chars.push(char);
        }
        break;
      }

      case state.tagEndName: {
        if (isAlpha(char)) {
          chars.push(char);
        } else if (char === ">") {
          currentState = state.initial;
          tokens.push({
            type: "tagEnd",
            name: chars.join(""),
          });
          chars.length = 0;
        }
        break;
      }
    }
  }

  return tokens;
};

export const parse = (str) => {
  const tokens = _tokenize(str);
  const root = {
    type: 'Root',
    children: []
  };
  const stack = [root];
  for (let i = 0 ; i < tokens.length; i++) {
    const token = tokens[i];
    const parent = stack[stack.length - 1];
    switch (token.type) {
      case 'tag': 
        const elementNode = {
          type: 'Element',
          tag: token.name,
          children: []
        };
        parent.children.push(elementNode);
        stack.push(elementNode);
        break;
      case 'tagEnd': 
        stack.pop();
        break;
      case 'text': 
        const textNode = {
          type: 'text',
          content: token.content
        };
        parent.children.push(textNode);
        break;
    }
  }
  return root;
}