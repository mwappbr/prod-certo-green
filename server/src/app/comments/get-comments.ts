import type { CommentNode, CommentsResponse } from '@hn/shared/contract/stories';
import { AppError } from '../errors.js';
import { fetchItem, type FetchItemDependencies } from '../fetch-item.js';

export interface GetCommentsDependencies extends FetchItemDependencies {
  commentsDefaultDepth: number;
  commentsMaxDepth: number;
  commentsMaxNodes: number;
  hnConcurrency: number;
}

type CommentNodeList = CommentNode[];

type MutableCommentNode = CommentNode & { children: CommentNodeList | null };

type ParentChildren = {
  childIds: number[];
  children: CommentNodeList;
  parent?: MutableCommentNode;
};

type Candidate = {
  id: number;
  parent: CommentNodeList;
};

function* childCandidates(
  parents: ParentChildren[],
  visited: Set<number>,
): Generator<Candidate> {
  for (const parent of parents) {
    for (const id of parent.childIds) {
      if (!Number.isSafeInteger(id) || id < 0 || visited.has(id)) continue;
      visited.add(id);
      yield { id, parent: parent.children };
    }
  }
}

function hasUnvisitedChild(childIds: number[], visited: Set<number>): boolean {
  return childIds.some((id) => Number.isSafeInteger(id) && id >= 0 && !visited.has(id));
}

function markBudgetTruncation(parents: ParentChildren[], visited: Set<number>): boolean {
  let truncated = false;
  for (const parent of parents) {
    if (!hasUnvisitedChild(parent.childIds, visited)) continue;
    truncated = true;
    if (parent.parent && parent.children.length === 0) parent.parent.children = null;
  }
  return truncated;
}

async function mapOrdered<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;
  let failed = false;
  let firstError: unknown;
  const workerCount = Math.min(concurrency, values.length);
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (!failed && cursor < values.length) {
      const index = cursor;
      cursor += 1;
      try {
        results[index] = await mapper(values[index]!);
      } catch (error) {
        if (!failed) {
          failed = true;
          firstError = error;
        }
        return;
      }
    }
  }));
  if (failed) throw firstError;
  return results;
}

function earlierTimestamp(current: string, candidate: string): string {
  return Date.parse(candidate) < Date.parse(current) ? candidate : current;
}

export async function getComments(
  id: number,
  requestedDepth: number | undefined,
  dependencies: GetCommentsDependencies,
): Promise<CommentsResponse> {
  const depth = requestedDepth ?? dependencies.commentsDefaultDepth;
  if (!Number.isSafeInteger(depth) || depth < 1 || depth > dependencies.commentsMaxDepth) {
    throw new AppError(
      'BAD_REQUEST',
      `A profundidade deve estar entre 1 e ${dependencies.commentsMaxDepth}.`,
      400,
    );
  }

  const root = await fetchItem(id, dependencies);
  if (!root) {
    throw new AppError('NOT_FOUND', 'O item solicitado não foi encontrado.', 404);
  }

  const nodes: CommentNodeList = [];
  const visited = new Set<number>([id]);
  const rootChildIds = root.item.type === 'job' ? [] : root.childIds;
  let parents: ParentChildren[] = [{ childIds: rootChildIds, children: nodes }];
  let returnedNodes = 0;
  let attemptedIds = 0;
  let cachedAt = root.cachedAt;
  let stale = root.stale;
  let truncated = false;

  for (let level = 1; level <= depth && parents.length > 0; level += 1) {
    const candidates = childCandidates(parents, visited);
    const nextParents: ParentChildren[] = [];
    let budgetReached = false;

    while (true) {
      const nodeCapacity = dependencies.commentsMaxNodes - returnedNodes;
      const attemptCapacity = dependencies.commentsMaxNodes - attemptedIds;
      const capacity = Math.min(nodeCapacity, attemptCapacity);
      if (capacity <= 0) {
        truncated ||= markBudgetTruncation(parents, visited);
        budgetReached = true;
        break;
      }

      const batch: Candidate[] = [];
      while (batch.length < capacity) {
        const next = candidates.next();
        if (next.done) break;
        batch.push(next.value);
        attemptedIds += 1;
      }
      if (batch.length === 0) break;

      const results = await mapOrdered(batch, dependencies.hnConcurrency, (candidate) =>
        fetchItem(candidate.id, dependencies));

      for (let index = 0; index < results.length; index += 1) {
        const result = results[index];
        if (!result || result.item.type !== 'comment') continue;

        const comment = result.item;
        const children: CommentNodeList = [];
        const node: MutableCommentNode = {
          id: comment.id,
          author: comment.author,
          text: comment.text,
          createdAt: comment.createdAt,
          status: comment.status,
          children,
        };
        batch[index]!.parent.push(node);
        returnedNodes += 1;
        stale ||= result.stale;
        cachedAt = earlierTimestamp(cachedAt, result.cachedAt);

        if (level === depth) {
          if (hasUnvisitedChild(result.childIds, visited)) node.children = null;
        } else {
          nextParents.push({ childIds: result.childIds, children, parent: node });
        }
      }
    }

    if (budgetReached) {
      if (level < depth) truncated ||= markBudgetTruncation(nextParents, visited);
      break;
    }
    parents = nextParents;
  }

  return { nodes, truncated, cachedAt, stale };
}
