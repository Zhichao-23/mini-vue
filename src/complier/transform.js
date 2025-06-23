export const transform = (ast) => {
  const context = {
    replaceNode(node) {
      context.parent.children[context.childIdx] = node;
      context.currentNode = node;
    },
    removeNode() {
      context.parent.splice(context.childIdx, 1);
      context.currentNode = null;
    },
    nodeTransforms: [
      _transformText,
      _transformElement,
      _transformRoot
    ]
  };
  _traverseNode(ast, context);


function _traverseNode(ast, context) {
  context.currentNode = ast;
  const exitFns = [];
  const transforms = context.nodeTransforms;
  if (!Array.isArray(transforms)) return;
  transforms.forEach(transform => {
    const onExit = transform(context.currentNode);
    // 所以孩子遍历完后执行的函数
    if (onExit) exitFns.push(onExit);
    // transform可能会删除节点
    if (!context.currentNode) return;
  });

  if (!context.currentNode.children) return;
  for (let i = 0; i < ast.children.length; i++) {
    context.childIdx = i;
    _traverseNode(ast, context);
  }

  let i = exitFns.length;
  while (i--) {
    exitFns[i]();
  }
}

function _transformText(node) {
  if (node.type !== 'Text') return;
  node.jsNode = _createStringLiteral(node.content);
}

function _transformElement(node) {
  return () => {
    if (node.type !== 'Element') return;

    const callExp = _createCallExpression('h', [
      _createStringLiteral(node.tag)
    ]);

    node.children.length == 1 
      ? callExp.arguments.push(node.children[0].jsNode) 
      : callExp.arguments.push(_createArrayExpression(node.children.map(c => c.jsNode)));

    node.jsNode = callExp;
  }
}

function _transformRoot(node) {
  return () => {
    if (node.type !== 'Root') return;
    const vnodeJSAST = node.children[0].jsNode;
    node.jsNode = {
      type: 'FunctionDecl',
      id: { type: 'Identifier', name: 'redner' },
      params: [],
      body: [
        {
          type: 'ReturnStatement',
          return: vnodeJSAST
        }
      ]
    }; 
  }
}

function _createStringLiteral(value) {
  return {
    type: 'StringLitetal',
    value
  };
}

function _ceateIdentifier(name) {
  return {
    type: 'Identifier',
    name
  };
}

function _createArrayExpression(elements) {
  return {
    type: 'ArrayExpression',
    elements
  };
}


function _createCallExpression(callee, args) {
  return {
    type: 'CallExpression',
    callee: _ceateIdentifier(callee),
    arguments: args
  };
}

function _dump(node, indent = 0) {
  const type = node.type;
  const desc = type == 'Root' ? ':' : (type == 'Element' ? node.tag : node.content);
  console.log(`${'-'.repeat(indent)}${type}: ${desc}`);
  if (Array.isArray(node.children)) {
    node.children.forEach(childNode => {
      _dump(childNode, indent + 2);
    });
  }
}
