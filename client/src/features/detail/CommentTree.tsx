import type { CommentNode } from '@hn/shared/contract/stories';
import { formatRelativeTime } from '@hn/shared/format/relative-time';
import { SafeHtml } from '../../components/SafeHtml';
import { useCommentTreeState } from './CommentTreeProvider';
import { commentCollapseCopy, loadedDescendantCount } from './comment-tree-state';

type CommentTreeProps = {
  rootId: number;
  nodes: CommentNode[];
};

function commentOffset(level: number): number {
  return Math.min(Math.max(level - 1, 0), 3) * 16;
}

function CommentTreeNode({ rootId, node, level }: { rootId: number; node: CommentNode; level: number }) {
  const { collapsed: storedCollapsed, toggle } = useCommentTreeState(rootId, node.id);
  const loadedReplies = Array.isArray(node.children) ? node.children : null;
  const hasLoadedReplies = loadedReplies !== null && loadedReplies.length > 0;
  const collapsed = storedCollapsed && hasLoadedReplies;
  const descendantCount = loadedDescendantCount(node);
  const copy = commentCollapseCopy(descendantCount);
  const offset = commentOffset(level);
  const marker = node.status === 'deleted' ? '[removido]' : node.status === 'dead' ? '[morto]' : null;
  const author = node.author ?? 'Autor desconhecido';

  return (
    <li className="detail-comment-list__item" data-comment-level={level}>
      <article
        aria-label={`Comentário de ${author}`}
        className="detail-comment"
        data-comment-id={node.id}
        data-comment-offset={offset}
        style={{ marginInlineStart: `${offset}px` }}
      >
        <header className="detail-comment__header">
          <span>{author}</span>
          <span className="detail-comment__visually-hidden">nível {level}</span>
          <time dateTime={node.createdAt ?? undefined}>{formatRelativeTime(node.createdAt)}</time>
          {marker && <span className="detail-comment__marker">{marker}</span>}
          {hasLoadedReplies && (
            <button
              aria-expanded={!collapsed}
              aria-label={collapsed ? copy.expand : copy.collapse}
              className="listing__button detail-comment__toggle"
              onClick={toggle}
              type="button"
            >
              {collapsed ? 'Expandir' : 'Recolher'}
            </button>
          )}
        </header>
        {collapsed && hasLoadedReplies && (
          <p className="detail-comment__collapsed-count">{copy.hidden}</p>
        )}
        {!collapsed && !marker && <SafeHtml html={node.text} className="detail-comment__body" />}
        {!collapsed && node.children === null && (
          <p className="detail-comment__continuation" role="note">Continuação não carregada.</p>
        )}
      </article>
      {!collapsed && hasLoadedReplies && (
        <ol aria-label={`Respostas de ${author}`} className="detail-comment-tree">
          {loadedReplies.map((child) => (
            <CommentTreeNode key={child.id} rootId={rootId} node={child} level={level + 1} />
          ))}
        </ol>
      )}
    </li>
  );
}

export function CommentTree({ rootId, nodes }: CommentTreeProps) {
  return (
    <ol aria-label="Comentários carregados" className="detail-comment-list">
      {nodes.map((node) => <CommentTreeNode key={node.id} rootId={rootId} node={node} level={1} />)}
    </ol>
  );
}
