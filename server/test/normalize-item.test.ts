import { describe, expect, it } from 'vitest';
import { normalizeHnItem } from '../src/domain/normalize-item.js';

describe('HN domain normalization', () => {
  it('decodes title entities and extracts a safe HTTP domain', () => {
    const item = normalizeHnItem({
      id: 1,
      kind: 'story',
      title: 'A &amp; B &#x27;C&#x27;',
      href: 'https://www.example.com/story?q=1',
      author: 'ana',
      score: 12,
      commentCount: 5,
      createdAtSeconds: 1_700_000_000,
    });

    expect(item).toMatchObject({
      id: 1,
      type: 'story',
      title: "A & B 'C'",
      url: 'https://www.example.com/story?q=1',
      domain: 'example.com',
      author: 'ana',
      score: 12,
      commentCount: 5,
      createdAt: '2023-11-14T22:13:20.000Z',
    });
    expect(item).not.toHaveProperty('by');
    expect(item).not.toHaveProperty('descendants');
  });

  it('normalizes absent optional fields and accepts only HTTP(S) URLs', () => {
    const absent = normalizeHnItem({ id: 2, kind: 'story', title: 'Sem URL' });
    expect(absent).toMatchObject({ url: null, domain: null, score: null, commentCount: 0, createdAt: null });

    const http = normalizeHnItem({ id: 7, kind: 'story', title: 'HTTP', href: 'http://example.net/a' });
    const https = normalizeHnItem({ id: 8, kind: 'story', title: 'HTTPS', href: 'https://example.net/b' });
    expect(http).toMatchObject({ url: 'http://example.net/a', domain: 'example.net' });
    expect(https).toMatchObject({ url: 'https://example.net/b', domain: 'example.net' });

    for (const href of [
      'javascript:alert(1)',
      'ftp://example.net/file',
      'mailto:reader@example.net',
      'data:text/html,unsafe',
      '/relative/path',
      '//example.net/protocol-relative',
      'https://',
      'http://%zz',
    ]) {
      const unsafe = normalizeHnItem({ id: 9, kind: 'story', title: 'Link inválido', href });
      expect(unsafe).toMatchObject({ url: null, domain: null });
    }
  });

  it('normalizes comments to sanitized HTML and derives status', () => {
    const comment = normalizeHnItem({
      id: 3,
      kind: 'comment',
      author: 'lee',
      bodyHtml: '<p>Texto <b>seguro</b></p><script>alert(1)</script><a href="javascript:alert(1)">link</a>',
      childIds: [4],
      parentId: 1,
    });

    expect(comment).toMatchObject({ id: 3, type: 'comment', parent: 1, kids: [4], status: 'ok' });
    if (comment.type !== 'comment') throw new Error('Expected normalized comment.');
    expect(comment.text).toContain('<b>seguro</b>');
    expect(comment.text).not.toContain('<script');
    expect(comment.text).not.toContain('javascript:');

    const deleted = normalizeHnItem({ id: 5, kind: 'comment', deleted: true, bodyHtml: '<p>raw</p>', childIds: [6] });
    const dead = normalizeHnItem({ id: 7, kind: 'comment', dead: true, bodyHtml: '<p>raw</p>', childIds: [8] });
    expect(deleted).toMatchObject({ type: 'comment', status: 'deleted', text: null, kids: [6] });
    expect(dead).toMatchObject({ type: 'comment', status: 'dead', text: null, kids: [8] });
  });

  it('strips active and malformed comment markup while retaining configured safe formatting', () => {
    const bodyHtml = [
      '<p>Safe <b>bold</b> <strong>strong</strong> <a href="https://safe.example/path" title="safe">link</a></p>',
      '<script>alert(1)</script>',
      '<img src="x" onerror="alert(2)">',
      '<a href="javascript:alert(3)" onclick="alert(4)">active link</a>',
      '<a href="data:text/html,unsafe">data link</a>',
      '<a href="ftp://unsafe.example/file">ftp link</a>',
      '<iframe src="https://unsafe.example">frame content</iframe>',
      '<svg onload="alert(5)"><a xlink:href="javascript:alert(6)">svg content</a></svg>',
      '<math><mi onclick="alert(7)">math content</mi></math>',
      '<p style="background:url(javascript:alert(8))">styled content',
      '<b>malformed closing markup</p><img src=x onerror=alert(9)>',
    ].join('');
    const item = normalizeHnItem({ id: 40, kind: 'comment', bodyHtml });

    expect(item.type).toBe('comment');
    if (item.type !== 'comment') throw new Error('Expected normalized comment.');
    expect(item.text).toContain('<p>Safe <b>bold</b> <strong>strong</strong>');
    expect(item.text).toContain('<a href="https://safe.example/path" title="safe">link</a>');
    expect(item.text).not.toMatch(/<(script|img|iframe|svg|math)\b/i);
    expect(item.text).not.toMatch(/\bon[a-z]+\s*=|\bstyle\s*=|xlink:href|javascript:|data:text\/html|ftp:\/\//i);
    expect(item.text).toContain('malformed closing markup');
  });

  it('retains relative and protocol-relative comment hrefs according to the configured sanitizer policy', () => {
    const item = normalizeHnItem({
      id: 41,
      kind: 'comment',
      bodyHtml: '<a href="/relative/path">relative</a><a href="//comments.example/path">protocol-relative</a><a href="mailto:reader@example.net">mail</a>',
    });

    expect(item.type).toBe('comment');
    if (item.type !== 'comment') throw new Error('Expected normalized comment.');
    expect(item.text).toBe(
      '<a href="/relative/path">relative</a><a href="//comments.example/path">protocol-relative</a><a href="mailto:reader@example.net">mail</a>',
    );
  });

  it('retains root child IDs internally for stories and jobs while comments keep public kids', () => {
    const story = normalizeHnItem({ id: 10, kind: 'story', title: 'Story', childIds: [11, 12] });
    const job = normalizeHnItem({ id: 20, kind: 'job', title: 'Job', childIds: [21] });
    const comment = normalizeHnItem({ id: 30, kind: 'comment', childIds: [31] });

    expect(story).toMatchObject({ type: 'story', childIds: [11, 12] });
    expect(job).toMatchObject({ type: 'job', childIds: [21] });
    expect(comment).toMatchObject({ type: 'comment', kids: [31] });
    expect(comment).not.toHaveProperty('childIds');
  });

  it('uses a normalized job variant for the future item endpoint', () => {
    expect(normalizeHnItem({ id: 6, kind: 'job', title: 'Engineer', href: 'https://jobs.example.org' }))
      .toMatchObject({ id: 6, type: 'job', title: 'Engineer', domain: 'jobs.example.org', childIds: [] });
  });
});
