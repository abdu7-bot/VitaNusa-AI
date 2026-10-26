#!/usr/bin/env node
/**
 * VitaNusa AI - Task Planner
 * Converts engineering objectives into small, verifiable tasks with dependency ordering.
 */

export function createTaskPlan(objective, options = {}) {
  if (!objective || typeof objective !== 'string' || !objective.trim()) {
    throw new Error('Objective must be a non-empty string');
  }
  const tasks = [];
  const baseId = options.baseId || 'T';
  let counter = 1;
  const addTask = (title, deps = [], opts = {}) => {
    const id = `${baseId}${String(counter++).padStart(3, '0')}`;
    tasks.push({
      id,
      title,
      status: 'READY',
      priority: opts.priority || 'P2',
      priorityRank: Number((opts.priority || 'P2').match(/\d+/)?.[0] ?? 2),
      allowedPaths: opts.allowedPaths || [],
      tests: opts.tests || [],
      acceptanceCriteria: opts.acceptanceCriteria || [],
      dependencies: deps,
      timeout: opts.timeout || 300,
      riskLevel: opts.riskLevel || 'low',
      instructions: opts.instructions || '',
    });
    return id;
  };

  // Simple planning: break objective into analyze, implement, test, verify
  const analyzeId = addTask(`Analyze: ${objective}`, [], { priority: 'P1', riskLevel: 'low', acceptanceCriteria: ['Scope identified', 'Dependencies mapped'] });
  const implementId = addTask(`Implement: ${objective}`, [analyzeId], { priority: 'P1', riskLevel: 'medium', acceptanceCriteria: ['Code changes complete', 'No scope violations'] });
  const testId = addTask(`Test: ${objective}`, [implementId], { priority: 'P1', riskLevel: 'low', acceptanceCriteria: ['All tests pass', 'No regressions'] });
  const verifyId = addTask(`Verify: ${objective}`, [testId], { priority: 'P2', riskLevel: 'low', acceptanceCriteria: ['Evidence collected', 'PR ready'] });

  return { objective, tasks, createdAt: new Date().toISOString() };
}

export function topologicalSort(tasks) {
  const byId = new Map(tasks.map(t => [t.id, t]));
  const visited = new Set();
  const result = [];
  const visiting = new Set();

  function visit(id) {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error(`Circular dependency detected at ${id}`);
    visiting.add(id);
    const task = byId.get(id);
    if (task) {
      for (const dep of (task.dependencies || [])) {
        visit(dep);
      }
    }
    visiting.delete(id);
    visited.add(id);
    result.push(id);
  }

  for (const task of tasks) {
    visit(task.id);
  }
  return result.map(id => byId.get(id)).filter(Boolean);
}

export function selectNextTask(tasks, completed = new Set()) {
  const eligible = tasks.filter(t => {
    if (t.status !== 'READY') return false;
    if (completed.has(t.id)) return false;
    return (t.dependencies || []).every(d => completed.has(d));
  });
  return eligible.sort((a, b) => a.priorityRank - b.priorityRank || a.id.localeCompare(b.id))[0] || null;
}

export function validateTaskContract(task) {
  const errors = [];
  if (!task.id) errors.push('Missing task ID');
  if (!task.title) errors.push('Missing task title');
  if (!Array.isArray(task.allowedPaths)) errors.push('allowedPaths must be array');
  if (!Array.isArray(task.tests)) errors.push('tests must be array');
  if (!Array.isArray(task.acceptanceCriteria)) errors.push('acceptanceCriteria must be array');
  if (typeof task.timeout !== 'number' || task.timeout <= 0) errors.push('timeout must be positive number');
  return errors;
}
