import type { SafeHtml as SafeHtmlValue } from '@hn/shared/contract/stories';

type SafeHtmlProps = {
  html: SafeHtmlValue | null;
  className?: string;
};

export function SafeHtml({ html, className }: SafeHtmlProps) {
  if (html === null) return null;
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
