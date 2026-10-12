import type { CommentNode } from '@hn/shared/contract/stories';

export type CommentTreeState = ReadonlyMap<number, ReadonlySet<number>>;

export function isCommentCollapsed(state: CommentTreeState, rootId: number, commentId: number): boolean {
  return state.get(rootId)?.has(commentId) ?? false;
}

export function toggleCommentCollapsed(
  state: CommentTreeState,
  rootId: number,
  commentId: number,
): CommentTreeState {
  const next = new Map(state);
  const collapsedForRoot = new Set(next.get(rootId) ?? []);

  if (collapsedForRoot.has(commentId)) collapsedForRoot.delete(commentId);
  else collapsedForRoot.add(commentId);

  if (collapsedForRoot.size === 0) next.delete(rootId);
  else next.set(rootId, collapsedForRoot);

  return next;
}

export function loadedDescendantCount(node: CommentNode): number {
  if (!Array.isArray(node.children)) return 0;
  return node.children.reduce((total, child) => total + 1 + loadedDescendantCount(child), 0);
}

export type CommentCollapseCopy = {
  hidden: string;
  expand: string;
  collapse: string;
};

export function commentCollapseCopy(count: number): CommentCollapseCopy {
  const quantity = Math.max(0, Math.floor(count));
  const noun = quantity === 1 ? 'resposta carregada' : 'respostas carregadas';
  const hidden = quantity === 1 ? '1 resposta carregada oculta' : `${quantity} respostas carregadas ocultas`;

  return {
    hidden,
    expand: `Expandir, ${quantity} ${noun}`,
    collapse: `Recolher, ${quantity} ${noun}`,
  };
}
