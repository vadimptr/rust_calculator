import test from 'node:test';
import assert from 'node:assert/strict';
import { record, redo, startHistory, undo } from './history.ts';

test('undo and redo walk the recorded states, a new action drops the redo branch', () => {
  let h = startHistory('a');
  h = record(h, 'b');
  h = record(h, 'c');
  h = undo(h);
  assert.equal(h.present, 'b');
  h = undo(h);
  assert.equal(h.present, 'a');
  assert.equal(undo(h), h);
  h = redo(h);
  assert.equal(h.present, 'b');
  h = record(h, 'd');
  assert.deepEqual([h.past, h.present, h.future], [['a', 'b'], 'd', []]);
});

test('changes with the same mark close in time merge into one step', () => {
  let h = startHistory(0);
  h = record(h, 1, 'rock', 1000);
  h = record(h, 2, 'rock', 1300);
  h = record(h, 3, 'rock', 1600);
  assert.deepEqual(h.past, [0]);
  h = record(h, 4, 'rock', 5000);
  assert.deepEqual(h.past, [0, 3]);
  assert.equal(undo(undo(h)).present, 0);
});
