/**
* @jest-environment jsdom
*/
import { jest } from "@jest/globals"

import { Parent, Text } from 'hast'
import { describe, it, expect } from '@jest/globals';
import { TocEntry } from '../../plugins/transformers/toc';
import { processHtmlAst, processSmallCaps, addListItem, buildNestedList, processTocEntry, processKatex } from "../TableOfContents";

// Mock the createLogger function
jest.mock('../../plugins/transformers/logger_utils', () => ({
  createLogger: () => ({
    info: jest.fn(),
    debug: jest.fn(),
  }),
}));

let parent: Parent
beforeEach(() => {
    parent = { type: 'element', tagName: 'div', children: [] } as Parent
})

describe('processKatex', () => {
  it('should output katex node', () => {
    const latex = 'E = mc^2'
    processKatex(latex, parent)

    expect(parent.children).toHaveLength(1)
    expect(parent.children[0]).toHaveProperty('tagName', 'span')
    expect(parent.children[0]).toHaveProperty('properties.className', ['katex-toc'])
    // The value itself is HTML so it's clunky to test
  })
})

describe('processSmallCaps', () => {
  beforeEach(() => {
    parent = { type: 'element', tagName: 'div', children: [] } as Parent;
  });

  it('processes small caps correctly', () => {
    processSmallCaps('Test SMALLCAPS', parent);
    expect(parent.children).toMatchObject([
      { type: 'text', value: 'Test ' },
      {
        type: 'element',
        tagName: 'abbr',
        properties: { className: ['small-caps'] },
        children: [{ type: 'text', value: 'SMALLCAPS' }]
      }
    ]);
  });

  it('handles text without small caps', () => {
    processSmallCaps('No small caps here', parent);
    expect(parent.children).toMatchObject([
      { type: 'text', value: 'No small caps here' }
    ]);
  });

  it('handles multiple small caps', () => {
    processSmallCaps('^SMALLCAPS-A normal SMALLCAPS-B', parent);
    expect(parent.children).toMatchObject([
      { type: 'text', value: '^' },
      {
        type: 'element',
        tagName: 'abbr',
        properties: { className: ['small-caps'] },
        children: [{ type: 'text', value: 'SMALLCAPS-A' }]
      },
      { type: 'text', value: ' normal ' },
      {
        type: 'element',
        tagName: 'abbr',
        properties: { className: ['small-caps'] },
        children: [{ type: 'text', value: 'SMALLCAPS-B' }]
      }
    ]);
  });

  it('handles parent with existing children', () => {
    parent.children = [
      {
        type: 'element',
        tagName: 'span',
        properties: { className: ['number-prefix'] },
        children: [{ type: 'text', value: '8: ' }]
      },
    ];

    processSmallCaps('Estimating the CDF and Statistical Functionals', parent);

    expect(parent.children).toMatchObject([
      {
        type: 'element',
        tagName: 'span',
        properties: { className: ['number-prefix'] },
        children: [{ type: 'text', value: '8: ' }]
      },
      { type: 'text', value: 'Estimating the ' },
      {
        type: 'element',
        tagName: 'abbr',
        properties: { className: ['small-caps'] },
        children: [{ type: 'text', value: 'CDF' }]
      },
      { type: 'text', value: ' and Statistical Functionals' },
    ]);
  });
})

describe('processTocEntry', () => {
  it('should process a TOC entry correctly into a hast node', () => {
      const entry: TocEntry = { depth: 1, text: 'Test Heading', slug: 'test-heading' };

      const result = processTocEntry(entry) 

      expect(result.type).toBe('element');
      expect(result.children[0] as Parent).toHaveProperty('value', 'Test Heading');
    });
})