import test from 'node:test';
import assert from 'node:assert/strict';
import { renderTable } from '../../src/cli/render_table.js';

test('aligns columns to the widest cell, plus the header', () => {
  const table = renderTable(
    [
      { name: 'a', count: 1 },
      { name: 'longer-name', count: 20 },
    ],
    [
      { key: 'name', header: 'name' },
      { key: 'count', header: 'count', align: 'right' },
    ],
  );
  const lines = table.split('\n');
  assert.equal(lines.length, 3);
  assert.equal(lines[0], 'name         count');
  assert.equal(lines[1], 'a                1');
  assert.equal(lines[2], 'longer-name     20');
});

test('an empty row list still renders the header', () => {
  const table = renderTable([], [{ key: 'x', header: 'x' }]);
  assert.equal(table, 'x');
});
