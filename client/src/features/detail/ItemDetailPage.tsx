import type { Comment, HnItem, Job, Story } from '@hn/shared/contract/stories';
import { formatRelativeTime } from '@hn/shared/format/relative-time';
import { SafeHtml } from '../../components/SafeHtml';
import { CommentTree } from './CommentTree';
import { useListing } from '../listing/ListingProvider';
import { combineItemFreshness, formatClock } from './item-detail-state';
import { useItemDetail } from './use-item-detail';
import { ThemeToggle } from '../theme/ThemeToggle';
import './detail.css';

type ItemDetailPageProps = { id: number };

type StoryOrJob = Story | Job;

function isStoryOrJob(item: HnItem): item is StoryOrJob {
  return item.type === 'story' || item.type === 'job';
}

function scoreLabel(score: number | null): string {
  if (score === null) return 'Pontuação indisponível';
  return `${score} ${score === 1 ? 'ponto' : 'pontos'}`;
}

function commentCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'comentário' : 'comentários'}`;
}

function StoryOrJobContent({ item }: { item: StoryOrJob }) {
  return (
    <section className="detail__item" aria-label={item.type === 'job' ? 'Detalhe da vaga' : 'Detalhe da história'}>
      <p className="detail__eyebrow">{item.type === 'job' ? 'Vaga' : 'História'}</p>
      <h1 id="detail-title" className="detail__title">{item.title}</h1>
      {item.domain && item.url && (
        <a
          className="detail__source"
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Abrir ${item.domain} em nova aba`}
        >
          {item.domain}
        </a>
      )}
      <p className="detail__meta">
        <span>{scoreLabel(item.score)}</span>
        <span aria-hidden="true">·</span>
        <span>{item.author ?? 'Autor desconhecido'}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={item.createdAt ?? undefined}>{formatRelativeTime(item.createdAt)}</time>
        <span aria-hidden="true">·</span>
        <span>{commentCountLabel(item.commentCount)}</span>
      </p>
    </section>
  );
}

function CommentItemContent({ item }: { item: Comment }) {
  const marker = item.status === 'deleted' ? '[removido]' : item.status === 'dead' ? '[morto]' : null;
  return (
    <section className="detail__item" aria-label="Detalhe do comentário">
      <p className="detail__eyebrow">HN Moderno</p>
      <h1 id="detail-title" className="detail__title">Comentário</h1>
      <p className="detail__meta">
        <span>{item.author ?? 'Autor desconhecido'}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={item.createdAt ?? undefined}>{formatRelativeTime(item.createdAt)}</time>
      </p>
      {marker ? <p className="detail-comment__marker">{marker}</p> : <SafeHtml html={item.text} className="detail-comment__body" />}
      <p className="detail__neutral">Este item é um comentário. A navegação própria de comentários não está disponível nesta etapa.</p>
    </section>
  );
}

function CommentsSection({
  rootId,
  rootType,
  loading,
  data,
  error,
  onRetry,
}: {
  rootId: number;
  rootType: HnItem['type'] | null;
  loading: boolean;
  data: ReturnType<typeof useItemDetail>['state']['comments']['data'];
  error: Error | null;
  onRetry: () => void;
}) {
  const title = rootType === 'comment' ? 'Respostas iniciais' : 'Comentários iniciais';
  return (
    <section className="detail__comments" aria-labelledby="detail-comments-title" aria-busy={loading}>
      <h2 id="detail-comments-title">{title}</h2>
      {loading && <p className="detail__loading" role="status">Carregando comentários…</p>}
      {error && (
        <div className="detail__notice" role="alert">
          <p>{error.message || 'Não foi possível carregar os comentários. Tente novamente.'}</p>
          <button className="listing__button" type="button" onClick={onRetry}>Tentar de novo</button>
        </div>
      )}
      {data && data.nodes.length === 0 && !data.truncated && !loading && !error && (
        <p className="detail__empty" role="status">Sem comentários ainda.</p>
      )}
      {data && data.truncated && (
        <p className="detail__neutral" role="status">Parte da árvore de respostas pode não estar carregada.</p>
      )}
      {data && data.nodes.length > 0 && <CommentTree rootId={rootId} nodes={data.nodes} />}
    </section>
  );
}

export function ItemDetailPage({ id }: ItemDetailPageProps) {
  const { backToListing } = useListing();
  const { state, retryItem, retryComments } = useItemDetail(id);
  const itemResponse = state.id === id ? state.item.data : null;
  const commentsResponse = state.id === id ? state.comments.data : null;
  const itemError = state.id === id ? state.item.error : null;
  const commentsError = state.id === id ? state.comments.error : null;
  const itemLoading = state.id !== id || state.item.loading;
  const commentsLoading = state.id !== id || state.comments.loading;
  const isLoading = itemLoading || commentsLoading;
  const item = itemResponse?.item ?? null;
  const freshness = combineItemFreshness(itemResponse, commentsResponse);
  const updatedAt = formatClock(freshness.cachedAt);
  const staleAt = formatClock(freshness.staleAt);

  return (
    <main className="detail" aria-labelledby="detail-title" aria-busy={isLoading}>
      <button className="detail__back listing__button" type="button" onClick={backToListing}>Voltar</button>
      <header className="detail__header">
        <div className="theme-screen-header">
          <p className="detail__brand">HN Moderno</p>
          <ThemeToggle />
        </div>
        {!item && itemLoading && <h1 id="detail-title" className="detail__title">Carregando detalhe</h1>}
        {!item && !itemLoading && itemError && <h1 id="detail-title" className="detail__title">Detalhe indisponível</h1>}
        {itemResponse && item && isStoryOrJob(item) && <StoryOrJobContent item={item} />}
        {itemResponse && item?.type === 'comment' && <CommentItemContent item={item} />}
        {updatedAt && <p className="detail__freshness">Atualizado em {updatedAt}</p>}
        {freshness.stale && (
          <p className="detail__stale" role="status">
            {staleAt
              ? `Não foi possível atualizar. Exibindo dados de ${staleAt}.`
              : 'Não foi possível atualizar. Exibindo dados armazenados.'}
          </p>
        )}
      </header>

      {!item && itemLoading && (
        <div className="detail__skeleton" role="status" aria-label="Carregando item">
          <span />
          <span />
        </div>
      )}
      {!item && !itemLoading && itemError && (
        <div className="detail__notice" role="alert">
          <p>{itemError.message || 'Não foi possível carregar o item. Tente novamente.'}</p>
          <button className="listing__button" type="button" onClick={retryItem}>Tentar de novo</button>
        </div>
      )}
      <CommentsSection
        rootId={id}
        rootType={item?.type ?? null}
        loading={commentsLoading}
        data={commentsResponse}
        error={commentsError}
        onRetry={retryComments}
      />
    </main>
  );
}
