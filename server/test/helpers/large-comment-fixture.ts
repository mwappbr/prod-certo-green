import { normalizeHnItem, type NormalizedHnItem } from '../../src/domain/normalize-item.js';

export type TraversableNode = { id: number; children: TraversableNode[] | null };

export function walkBreadth(nodes: TraversableNode[]): number[] {
  const queue = [...nodes];
  const ids: number[] = [];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const node = queue[cursor];
    if (!node) continue;
    ids.push(node.id);
    if (node.children) queue.push(...node.children);
  }
  return ids;
}

export function createLargeCommentFixture(): {
  rootId: number;
  items: Map<number, NormalizedHnItem>;
  expectedBreadthOrder: number[];
  firstRootChild: number;
  secondRootChild: number;
} {
  const rootId = 1;
  let nextId = 1_000;
  const levels = [8, 40, 80, 96].map((width) =>
    Array.from({ length: width }, () => nextId++),
  );
  const items = new Map<number, NormalizedHnItem>();
  const rootChildren = [...(levels[0] ?? [])];
  const firstRootChild = rootChildren[0] ?? rootId;
  const secondRootChild = rootChildren[1] ?? rootId;
  rootChildren.push(firstRootChild);
  items.set(rootId, normalizeHnItem({ id: rootId, kind: 'story', title: 'Large root', childIds: rootChildren }));

  for (let levelIndex = 0; levelIndex < levels.length; levelIndex += 1) {
    const level = levels[levelIndex] ?? [];
    const nextLevel = levels[levelIndex + 1] ?? [];
    let offset = 0;
    for (let parentIndex = 0; parentIndex < level.length; parentIndex += 1) {
      const parentsLeft = level.length - parentIndex;
      const childrenLeft = nextLevel.length - offset;
      const count = parentsLeft > 0 ? Math.ceil(childrenLeft / parentsLeft) : 0;
      const childIds = nextLevel.slice(offset, offset + count);
      offset += count;
      if (parentIndex === 0 && levelIndex === 0) {
        childIds.push(level[0] ?? rootId, rootId);
      }
      const id = level[parentIndex] ?? rootId;
      items.set(id, normalizeHnItem({
        id,
        kind: 'comment',
        bodyHtml: '<p>fixture comment</p>',
        childIds,
      }));
    }
  }

  return {
    rootId,
    items,
    expectedBreadthOrder: levels.flat(),
    firstRootChild,
    secondRootChild,
  };
}

export function within<T>(promise: Promise<T>, message: string, timeoutMs = 2_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

export async function drainedWithin<T>(promise: Promise<T>, message: string): Promise<T> {
  try {
    return await within(promise, message);
  } finally {
    await within(Promise.allSettled([promise]), `${message} In-flight work did not drain.`);
  }
}
