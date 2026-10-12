export const commentTreeStoryId = 98_310_000;

const chainIds = Array.from({ length: 9 }, (_, index) => commentTreeStoryId + index + 1);
const mainIds = Array.from({ length: 212 }, (_, index) => commentTreeStoryId + 100 + index);
const baseTime = Math.floor(Date.parse('2026-10-12T09:59:00.000Z') / 1000);
const items = {};
const parents = new Map();
const children = new Map();
let ordinal = 0;

parents.set(chainIds[0], commentTreeStoryId);
for (let index = 0; index < chainIds.length; index += 1) {
  const id = chainIds[index];
  const nextId = chainIds[index + 1];
  const kids = nextId === undefined ? [] : [nextId];
  children.set(id, kids);
  if (nextId !== undefined) parents.set(nextId, id);
}

for (const id of mainIds.slice(0, 3)) parents.set(id, commentTreeStoryId);
let parentCursor = 0;
let nextChild = 3;
while (nextChild < mainIds.length) {
  const parentId = mainIds[parentCursor];
  if (parentId === undefined) throw new Error('Comment fixture parent allocation failed.');
  const kids = mainIds.slice(nextChild, nextChild + 3);
  children.set(parentId, kids);
  for (const childId of kids) parents.set(childId, parentId);
  nextChild += kids.length;
  parentCursor += 1;
}

for (const id of [...chainIds, ...mainIds]) {
  const parent = parents.get(id);
  if (parent === undefined) throw new Error(`Comment fixture parent missing for ${id}.`);
  const timestamp = baseTime - ordinal * 60;
  ordinal += 1;
  items[String(id)] = {
    id,
    type: 'comment',
    by: `fixture-author-${id}`,
    parent,
    time: timestamp,
    text: `<p>fixture-comment-${id}-body</p>`,
    kids: children.get(id) ?? [],
  };
}

const topLevelIds = [chainIds[0], ...mainIds.slice(0, 3)];
export const commentTreeFixtureStory = {
  id: commentTreeStoryId,
  type: 'story',
  by: 'fixture-story-author',
  title: '3.3 fixture comment tree',
  score: 33,
  descendants: chainIds.length + mainIds.length,
  time: baseTime,
  kids: topLevelIds,
};
items[String(commentTreeStoryId)] = commentTreeFixtureStory;

export function createCommentsTreeFixture() {
  return {
    storyId: commentTreeStoryId,
    story: commentTreeFixtureStory,
    items,
    chainIds: [...chainIds],
    mainIds: [...mainIds],
    allCommentIds: [...chainIds, ...mainIds],
    visibleCommentIds: [...chainIds.slice(0, 8), ...mainIds],
    depthNineId: chainIds[8],
  };
}
