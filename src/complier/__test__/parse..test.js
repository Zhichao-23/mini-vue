import { describe, it, expect } from 'vitest';
import { _tokenize, parse } from '../parse'; // 替换为你的模块路径

// 测试 tokenize 函数
describe('tokenize', () => {
  it('should tokenize a simple div with text', () => {
    const input = '<div>Hello</div>';
    const expected = [
      { type: 'tag', name: 'div' },
      { type: 'text', content: 'Hello' },
      { type: 'tagEnd', name: 'div' },
    ];
    expect(_tokenize(input)).toEqual(expected);
  });

  it('should tokenize nested tags', () => {
    const input = '<p><span>World</span></p>';
    const expected = [
      { type: 'tag', name: 'p' },
      { type: 'tag', name: 'span' },
      { type: 'text', content: 'World' },
      { type: 'tagEnd', name: 'span' },
      { type: 'tagEnd', name: 'p' },
    ];
    expect(_tokenize(input)).toEqual(expected);
  });

  it('should tokenize multiple sibling tags', () => {
    const input = '<h1>Title</h1><p>Content</p>';
    const expected = [
      { type: 'tag', name: 'h1' },
      { type: 'text', content: 'Title' },
      { type: 'tagEnd', name: 'h1' },
      { type: 'tag', name: 'p' },
      { type: 'text', content: 'Content' },
      { type: 'tagEnd', name: 'p' },
    ];
    expect(tokenize(input)).toEqual(expected);
  });

  it('should tokenize an empty div', () => {
    const input = '<div></div>';
    const expected = [
      { type: 'tag', name: 'div' },
      { type: 'tagEnd', name: 'div' },
    ];
    expect(_tokenize(input)).toEqual(expected);
  });
});

// 测试 parse 函数
describe('parse', () => {
  it('should parse a simple div with text', () => {
    const input = '<div>Hello</div>';
    const expected = {
      type: 'Root',
      children: [
        {
          type: 'Element',
          tag: 'div',
          children: [
            { type: 'text', content: 'Hello' },
          ],
        },
      ],
    };
    expect(parse(input)).toEqual(expected);
  });

  it('should parse nested tags', () => {
    const input = '<p><span>World</span></p>';
    const expected = {
      type: 'Root',
      children: [
        {
          type: 'Element',
          tag: 'p',
          children: [
            {
              type: 'Element',
              tag: 'span',
              children: [
                { type: 'text', content: 'World' },
              ],
            },
          ],
        },
      ],
    };
    expect(parse(input)).toEqual(expected);
  });

  it('should parse multiple sibling tags', () => {
    const input = '<h1>Title</h1><p>Content</p>';
    const expected = {
      type: 'Root',
      children: [
        {
          type: 'Element',
          tag: 'h1',
          children: [
            { type: 'text', content: 'Title' },
          ],
        },
        {
          type: 'Element',
          tag: 'p',
          children: [
            { type: 'text', content: 'Content' },
          ],
        },
      ],
    };
    expect(parse(input)).toEqual(expected);
  });

  it('should parse an empty div', () => {
    const input = '<div></div>';
    const expected = {
      type: 'Root',
      children: [
        {
          type: 'Element',
          tag: 'div',
          children: [],
        },
      ],
    };
    expect(parse(input)).toEqual(expected);
  });
});