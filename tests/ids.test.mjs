// Tests de src/utils/ids.ts (Node 25 importa .ts directo con type stripping).
import test from 'node:test';
import assert from 'node:assert/strict';
import { toNumericIdArray, toNumericId } from '../src/utils/ids.ts';

test('toNumericIdArray: array de números se mantiene', () => {
  assert.deepEqual(toNumericIdArray([3, 5]), [3, 5]);
  assert.deepEqual(toNumericIdArray([]), []);
});

test('toNumericIdArray: string JSON "[3,5]" → [3, 5]', () => {
  assert.deepEqual(toNumericIdArray('[3,5]'), [3, 5]);
  assert.deepEqual(toNumericIdArray('[ 3 , 5 ]'), [3, 5]);
  assert.deepEqual(toNumericIdArray('[]'), []);
});

test('toNumericIdArray: número/string legacy → [n]', () => {
  assert.deepEqual(toNumericIdArray(3), [3]);
  assert.deepEqual(toNumericIdArray('3'), [3]);
});

test('toNumericIdArray: null/undefined/"" → []', () => {
  assert.deepEqual(toNumericIdArray(null), []);
  assert.deepEqual(toNumericIdArray(undefined), []);
  assert.deepEqual(toNumericIdArray(''), []);
  assert.deepEqual(toNumericIdArray('   '), []);
});

test('toNumericIdArray: JSON corrupto → [] sin lanzar', () => {
  assert.deepEqual(toNumericIdArray('[3,'), []);
  assert.deepEqual(toNumericIdArray('[3] basura'), []);
  assert.deepEqual(toNumericIdArray('null'), []);
});

test('toNumericIdArray: array mixto filtra nulls y strings con type guard', () => {
  assert.deepEqual(toNumericIdArray(['3', null, 5, undefined, 'x']), [3, 5]);
});

test('toNumericIdArray: entrada inesperada → []', () => {
  assert.deepEqual(toNumericIdArray({}), []);
  assert.deepEqual(toNumericIdArray(true), []);
});

test('toNumericId: comportamiento previo sin regresiones', () => {
  assert.equal(toNumericId('3'), 3);
  assert.equal(toNumericId(3), 3);
  assert.equal(toNumericId(null), null);
  assert.equal(toNumericId(''), null);
  assert.equal(toNumericId('x'), null);
});
