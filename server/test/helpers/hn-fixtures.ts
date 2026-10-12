import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { StoryCategory } from '@hn/shared/contract/stories';

export type HnFixtures = {
  categories: Record<StoryCategory, number[]>;
  items: Record<string, unknown>;
};

const fixturePath = fileURLToPath(new URL('../../../e2e/fixtures/hn-stories.json', import.meta.url));
export const hnFixtures = JSON.parse(readFileSync(fixturePath, 'utf8')) as HnFixtures;
