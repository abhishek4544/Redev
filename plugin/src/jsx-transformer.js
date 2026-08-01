import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import _generate from '@babel/generator';
import * as t from '@babel/types';

const traverse = _traverse.default || _traverse;
const generate = _generate.default || _generate;

const PARSER_OPTIONS = {
  sourceType: 'module',
  plugins: [
    'jsx',
    'typescript',
    'decorators-legacy',
    'classProperties',
    'objectRestSpread',
    'asyncGenerators',
    'topLevelAwait',
    'importMeta',
  ],
};

function isLowercaseElement(name) {
  if (name.type !== 'JSXIdentifier') return false;
  const first = name.name.charAt(0);
  return first === first.toLowerCase() && first !== first.toUpperCase();
}

function elementDisplayName(name) {
  if (name.type === 'JSXIdentifier') return name.name;
  if (name.type === 'JSXMemberExpression') {
    const parts = [];
    let current = name;
    while (current.type === 'JSXMemberExpression') {
      parts.unshift(current.property.name);
      current = current.object;
    }
    if (current.type === 'JSXIdentifier') parts.unshift(current.name);
    return parts.join('.');
  }
  return 'unknown';
}

function findEnclosingComponent(path) {
  let current = path.parentPath;
  while (current) {
    const node = current.node;
    if (t.isFunctionDeclaration(node) && node.id) return node.id.name;
    if (t.isClassDeclaration(node) && node.id) return node.id.name;
    if (t.isVariableDeclarator(node) && t.isIdentifier(node.id)) {
      const init = node.init;
      if (
        init &&
        (t.isArrowFunctionExpression(init) ||
          t.isFunctionExpression(init) ||
          t.isCallExpression(init))
      ) {
        return node.id.name;
      }
    }
    if (t.isFunctionExpression(node) && node.id) return node.id.name;
    if (t.isExportDefaultDeclaration(node)) {
      const decl = node.declaration;
      if (t.isIdentifier(decl)) return decl.name;
    }
    current = current.parentPath;
  }
  return null;
}

function hasRedevAttr(attributes, name) {
  return attributes.some(
    (attr) =>
      t.isJSXAttribute(attr) &&
      t.isJSXIdentifier(attr.name) &&
      attr.name.name === name,
  );
}

function makeStringAttr(name, value) {
  return t.jsxAttribute(t.jsxIdentifier(name), t.stringLiteral(String(value)));
}

export function transformJsx(code, relativePath) {
  let ast;
  try {
    ast = parse(code, PARSER_OPTIONS);
  } catch {
    return null;
  }

  let modified = false;

  traverse(ast, {
    JSXOpeningElement(path) {
      const node = path.node;
      const name = node.name;

      if (!isLowercaseElement(name)) return;
      if (hasRedevAttr(node.attributes, 'data-redev-file')) return;

      const line = node.loc && node.loc.start ? node.loc.start.line : 0;
      const column = node.loc && node.loc.start ? node.loc.start.column : 0;
      const componentName = findEnclosingComponent(path) || elementDisplayName(name);

      node.attributes.push(makeStringAttr('data-redev-file', relativePath));
      node.attributes.push(makeStringAttr('data-redev-line', line));
      node.attributes.push(makeStringAttr('data-redev-column', column));
      node.attributes.push(makeStringAttr('data-redev-component', componentName));

      modified = true;
    },
  });

  if (!modified) return null;

  const output = generate(ast, {
    retainLines: true,
    compact: false,
    sourceMaps: true,
    sourceFileName: relativePath,
  }, code);

  return { code: output.code, map: output.map };
}
