import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { markdownPlugins, defaultOptions } from '../ofm';
import { VFile } from 'vfile';

describe('markdownPlugins', () => {
  const testMarkdownPlugins = (input: string) => {
    const processor = unified()
      .use(remarkParse)
      .use(markdownPlugins(defaultOptions))
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeStringify, { allowDangerousHtml: true });
    const vfile = new VFile(input);
    const result = processor.processSync(vfile);
    return result.toString();
  };

  test('should process callouts', () => {
    const input = '> [!note] This is a callout';
    const output = testMarkdownPlugins(input);
    expect(output).toContain('<blockquote class="callout note"');
    expect(output).toContain('<div class="callout-title">');
    expect(output).not.toContain('<div class="callout-content">');
  });

  test('should process callouts with custom type', () => {
    const input = '> [!custom] This is a custom callout';
    const output = testMarkdownPlugins(input);
    expect(output).toContain('<blockquote class="callout custom"');
  });

  test('should process callouts with multiple paragraphs', () => {
    const input = '> [!info] Callout title\n>\n> This is the second paragraph.';
    const output = testMarkdownPlugins(input);
    expect(output).toContain('<blockquote class="callout info"');
    expect(output).toContain('<div class="callout-content">');
    expect(output).toContain('Callout title');
    expect(output).toContain('This is the second paragraph.');
  });
});