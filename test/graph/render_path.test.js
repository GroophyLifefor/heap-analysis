import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSnapshot, loadSnapshot } from '../../src/snapshot.js';
import { shortestPathToRoot } from '../../src/graph/gc_path.js';
import { renderPath } from '../../src/graph/render_path.js';
import { tinySnapshot, withRealSnapshot } from '../helpers/fixture.js';

test('renders the chain fixture\'s path with property edge labels', () => {
  const snap = parseSnapshot(tinySnapshot());
  const path = shortestPathToRoot(snap, 2);
  assert.equal(renderPath(snap, path), '(synthetic) --.prop--> object Foo --.prop--> string hello');
});

test('renders an element edge with a bracketed index instead of a dot', () => {
  const json = tinySnapshot();
  json.edges[0] = 1; // element
  json.edges[1] = 7; // array index 7, not a string-table index
  const snap = parseSnapshot(json);
  const path = shortestPathToRoot(snap, 1);
  assert.equal(renderPath(snap, path), '(synthetic) --[7]--> object Foo');
});

test('a single-node path (the root itself) renders with no arrows', () => {
  const snap = parseSnapshot(tinySnapshot());
  assert.equal(renderPath(snap, [0]), '(synthetic)');
});

test('on a real snapshot, renders a non-empty string containing every node\'s type', async () => {
  await withRealSnapshot(async (file) => {
    const snap = await loadSnapshot(file);
    let target = -1;
    for (const nodeIndex of snap.reachableNodes()) {
      if (snap.referrersOf(nodeIndex).length > 0 && nodeIndex !== 0) {
        target = nodeIndex;
        break;
      }
    }
    const path = shortestPathToRoot(snap, target);
    const rendered = renderPath(snap, path);
    assert.ok(rendered.length > 0);
    for (const nodeIndex of path) {
      assert.ok(rendered.includes(snap.typeOf(nodeIndex)));
    }
  });
});
