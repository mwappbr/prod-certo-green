import { expect, test } from 'vitest';
import type { CommentNode } from '@hn/shared/contract/stories';
import {
  commentCollapseCopy,
  isCommentCollapsed,
  loadedDescendantCount,
  toggleCommentCollapsed,
  type CommentTreeState,
} from './comment-tree-state';

function node(id: number, children: CommentNode[] | null): CommentNode {
  return {
    id,
    author: null,
    text: null,
    createdAt: null,
    status: 'ok',
    children,
  };
}

test('starts open and isolates collapse state by story root and comment id', () => {
  const initial: CommentTreeState = new Map();
  const oneCollapsed = toggleCommentCollapsed(initial, 900, 10);

  expect(isCommentCollapsed(initial, 900, 10)).toBe(false);
  expect(isCommentCollapsed(oneCollapsed, 900, 10)).toBe(true);
  expect(isCommentCollapsed(oneCollapsed, 901, 10)).toBe(false);
  expect(isCommentCollapsed(oneCollapsed, 900, 11)).toBe(false);

  const twoCollapsed = toggleCommentCollapsed(oneCollapsed, 900, 11);
  const firstExpanded = toggleCommentCollapsed(twoCollapsed, 900, 10);
  expect(isCommentCollapsed(firstExpanded, 900, 10)).toBe(false);
  expect(isCommentCollapsed(firstExpanded, 900, 11)).toBe(true);
});

test('preserves nested collapsed nodes when an ancestor is collapsed and reopened', () => {
  let state: CommentTreeState = new Map();
  state = toggleCommentCollapsed(state, 900, 12);
  state = toggleCommentCollapsed(state, 900, 10);
  expect(isCommentCollapsed(state, 900, 10)).toBe(true);
  expect(isCommentCollapsed(state, 900, 12)).toBe(true);

  state = toggleCommentCollapsed(state, 900, 10);
  expect(isCommentCollapsed(state, 900, 10)).toBe(false);
  expect(isCommentCollapsed(state, 900, 12)).toBe(true);
});

test('counts only loaded descendants and does not invent children past null', () => {
  const root = node(1, [
    node(2, []),
    node(3, [node(4, null)]),
    node(5, null),
  ]);

  expect(loadedDescendantCount(root)).toBe(4);
  expect(loadedDescendantCount(node(6, null))).toBe(0);
  expect(loadedDescendantCount(node(7, []))).toBe(0);
});

test('uses singular and plural loaded-reply copy', () => {
  expect(commentCollapseCopy(1)).toEqual({
    hidden: '1 resposta carregada oculta',
    expand: 'Expandir, 1 resposta carregada',
    collapse: 'Recolher, 1 resposta carregada',
  });
  expect(commentCollapseCopy(4)).toEqual({
    hidden: '4 respostas carregadas ocultas',
    expand: 'Expandir, 4 respostas carregadas',
    collapse: 'Recolher, 4 respostas carregadas',
  });
});
