import assert from "node:assert/strict";
import test from "node:test";

import {
  runGraphDemo,
  runHarnessDemo,
  runLoopDemo,
} from "../app/lab-model.mjs";

test("Harness Demo exposes missing environment feedback as the failure cause", () => {
  const result = runHarnessDemo({
    tools: true,
    observability: false,
    constraints: true,
    completionProof: true,
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.failedAt, "observe");
  assert.match(result.explanation, /日志|指标|界面状态/);
});

test("Harness Demo completes when every execution affordance is available", () => {
  const result = runHarnessDemo({
    tools: true,
    observability: true,
    constraints: true,
    completionProof: true,
  });

  assert.equal(result.status, "completed");
  assert.equal(result.trace.at(-1).kind, "proof");
});

test("Loop Demo converges only through bounded observe-adjust iterations", () => {
  const result = runLoopDemo({
    initialScore: 35,
    targetScore: 80,
    maxIterations: 5,
    budget: 5,
  });

  assert.equal(result.status, "converged");
  assert.equal(result.iterations, 3);
  assert.equal(result.trace.at(-1).score, 80);
});

test("Loop Demo reports budget exhaustion instead of pretending success", () => {
  const result = runLoopDemo({
    initialScore: 35,
    targetScore: 90,
    maxIterations: 8,
    budget: 2,
  });

  assert.equal(result.status, "budget_exhausted");
  assert.equal(result.iterations, 2);
});

test("Graph Demo reveals local green metrics drifting from the external goal", () => {
  const result = runGraphDemo({
    anchorEnabled: false,
    vetoEnabled: false,
  });

  assert.equal(result.localMetricsGreen, true);
  assert.equal(result.systemHealthy, false);
  assert.equal(result.status, "drift");
});

test("Graph Demo uses anchor and veto edges to correct conflicting loops", () => {
  const result = runGraphDemo({
    anchorEnabled: true,
    vetoEnabled: true,
  });

  assert.equal(result.status, "corrected");
  assert.equal(result.systemHealthy, true);
  assert.ok(result.events.some((event) => event.kind === "veto"));
});

test("Graph Demo explains the drift outcome with the external metric", () => {
  const result = runGraphDemo({ anchorEnabled: false, vetoEnabled: false });
  assert.equal(result.status, "drift");
  assert.match(result.explanation, /62/);
});

test("Graph Demo explains the corrected outcome with the recovered metric", () => {
  const result = runGraphDemo({ anchorEnabled: true, vetoEnabled: true });
  assert.equal(result.status, "corrected");
  assert.match(result.explanation, /84/);
});
