import type { MouseEvent } from 'react';
import type { ListingItem } from '@hn/shared/contract/stories';
import { formatRelativeTime } from '@hn/shared/format/relative-time';

type StoryRowProps = { item: ListingItem; onOpen: (id: number) => void };

export function StoryRow({ item, onOpen }: StoryRowProps) {
  const scoreLabel = item.score === null
    ? 'Pontuação indisponível'
    : `${item.score} ${item.score === 1 ? 'ponto' : 'pontos'}`;
  const commentCountLabel = `${item.commentCount} ${item.commentCount === 1 ? 'comentário' : 'comentários'}`;

  function openDetail(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) return;
    event.preventDefault();
    onOpen(item.id);
  }

  return (
    <article className="story-row" aria-label={item.title}>
      <a className="story-row__detail" href={`/item/${item.id}`} onClick={openDetail}>
        <h2 className="story-row__title">{item.title}</h2>
        <p className="story-row__meta">
          <span>{scoreLabel}</span>
          <span aria-hidden="true">·</span>
          <span>{item.author ?? 'Autor desconhecido'}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={item.createdAt ?? undefined}>{formatRelativeTime(item.createdAt)}</time>
          <span aria-hidden="true">·</span>
          <span>{commentCountLabel}</span>
        </p>
      </a>
      {item.domain && item.url && (
        <a
          className="story-row__source"
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Abrir ${item.domain} em nova aba`}
        >
          {item.domain}
        </a>
      )}
    </article>
  );
}
