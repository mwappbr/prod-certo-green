import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  isCommentCollapsed,
  toggleCommentCollapsed,
  type CommentTreeState,
} from './comment-tree-state';

type CommentTreeContextValue = {
  collapsed: CommentTreeState;
  toggle: (rootId: number, commentId: number) => void;
};

const CommentTreeContext = createContext<CommentTreeContextValue | null>(null);

export function CommentTreeProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState<CommentTreeState>(() => new Map());
  const toggle = useCallback((rootId: number, commentId: number) => {
    setCollapsed((current) => toggleCommentCollapsed(current, rootId, commentId));
  }, []);
  const value = useMemo(() => ({ collapsed, toggle }), [collapsed, toggle]);

  return <CommentTreeContext.Provider value={value}>{children}</CommentTreeContext.Provider>;
}

export function useCommentTreeState(rootId: number, commentId: number) {
  const context = useContext(CommentTreeContext);
  if (!context) throw new Error('CommentTreeProvider não está montado.');

  return {
    collapsed: isCommentCollapsed(context.collapsed, rootId, commentId),
    toggle: () => context.toggle(rootId, commentId),
  };
}
