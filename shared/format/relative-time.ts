const relativeTime = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

export function formatRelativeTime(isoDate: string | null, now = Date.now()): string {
  if (!isoDate) return 'data desconhecida';
  const timestamp = Date.parse(isoDate);
  if (!Number.isFinite(timestamp)) return 'data desconhecida';

  const elapsedSeconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (elapsedSeconds < 60) return 'agora';
  if (elapsedSeconds < 3_600) return relativeTime.format(-Math.floor(elapsedSeconds / 60), 'minute');
  if (elapsedSeconds < 86_400) return relativeTime.format(-Math.floor(elapsedSeconds / 3_600), 'hour');
  if (elapsedSeconds < 604_800) return relativeTime.format(-Math.floor(elapsedSeconds / 86_400), 'day');
  if (elapsedSeconds < 2_629_746) return relativeTime.format(-Math.floor(elapsedSeconds / 604_800), 'week');
  if (elapsedSeconds < 31_556_952) return relativeTime.format(-Math.floor(elapsedSeconds / 2_629_746), 'month');
  return relativeTime.format(-Math.floor(elapsedSeconds / 31_556_952), 'year');
}
