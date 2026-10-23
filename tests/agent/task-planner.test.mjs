import test from 'node:test';
import assert from 'node:assert/strict';
import { createTaskPlan, topologicalSort, selectNextTask, validateTaskContract } from '../../scripts/agent/task-planner.mjs';

test('planner: creates task plan with dependencies', () => {
  const plan = createTaskPlan('Add auth');
  assert.equal(plan.tasks.length, 4);
  assert.ok(plan.tasks[0].dependencies.length === 0);
  assert.ok(plan.tasks[1].dependencies.includes(plan.tasks[0].id));
});

test('planner: topological sort resolves order', () => {
  const plan = createTaskPlan('Test');
  const sorted = topologicalSort(plan.tasks);
  assert.equal(sorted.length, 4);
  assert.equal(sorted[0].id, plan.tasks[0].id);
});

test('planner: circular dependency throws', () => {
  const tasks = [
    { id: 'A', dependencies: ['B'] },
    { id: 'B', dependencies: ['A'] },
  ];
  assert.throws(() => topologicalSort(tasks), /Circular dependency/i);
});

test('planner: selectNextTask respects dependencies', () => {
  const plan = createTaskPlan('Test');
  const next = selectNextTask(plan.tasks, new Set());
  assert.equal(next.id, plan.tasks[0].id);
  const next2 = selectNextTask(plan.tasks, new Set([plan.tasks[0].id]));
  assert.equal(next2.id, plan.tasks[1].id);
});

test('planner: validateTaskContract catches missing fields', () => {
  const errors = validateTaskContract({ id: '', title: 'T', allowedPaths: 'bad', tests: null, acceptanceCriteria: [], timeout: -1 });
  assert.ok(errors.length > 0);
});

test('planner: empty objective throws', () => {
  assert.throws(() => createTaskPlan(''), /non-empty string/i);
  assert.throws(() => createTaskPlan(null), /non-empty string/i);
});
