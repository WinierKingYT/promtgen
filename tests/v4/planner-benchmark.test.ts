import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  runPlannerBenchmark,
  runPlannerBenchmarkScenario,
  type PlannerBenchmarkScenario
} from '../../src/v4/benchmarks/planner-benchmark.js';
import { PLANNER_BENCHMARK_EVIDENCE } from '../../src/v4/product/generated-benchmark-evidence.js';

const scenarios = JSON.parse(
  readFileSync(path.resolve('benchmarks/planner/scenarios.json'), 'utf8')
) as PlannerBenchmarkScenario[];

describe('Planner core benchmark evidence', () => {
  it('runs ten versioned scenarios through canonical planning, task compilation, readiness and export', () => {
    const report = runPlannerBenchmark(scenarios, '2026-07-28T00:00:00.000Z');
    assert.equal(report.scenarioCount, 10);
    assert.equal(report.passedCount, 10);
    assert.equal(report.passRate, 1);
    assert.ok(report.results.every(result => result.metrics.mustTaskCoverage === 1));
    assert.ok(report.results.every(result => result.metrics.mustTestCoverage === 1));
    assert.ok(report.results.every(result => result.metrics.taskAcceptanceCoverage === 1));
    assert.ok(report.results.every(result => result.metrics.scopeContradictions === 0));
    assert.deepEqual(report.capabilities['canonical-planning'], { completed: 10, passed: 10 });
    assert.deepEqual(report.capabilities['canonical-export'], { completed: 10, passed: 10 });
    assert.deepEqual(report.capabilities['readiness-quality-gate'], { completed: 10, passed: 10 });
    assert.ok(report.results.every(result => result.capabilityResults['readiness-quality-gate']));
  });

  it('fails a scenario when its measurable quality threshold is not met', () => {
    const impossible = structuredClone(scenarios[0]);
    impossible.thresholds.minimumReadiness = 101;
    const result = runPlannerBenchmarkScenario(impossible);
    assert.equal(result.passed, false);
    assert.ok(result.failures.some(failure => failure.startsWith('Readiness')));
  });

  it('rejects duplicate scenario identifiers and exposes generated evidence', () => {
    assert.throws(
      () => runPlannerBenchmark([scenarios[0], structuredClone(scenarios[0])]),
      /yinelenen benchmark/
    );
    assert.equal(PLANNER_BENCHMARK_EVIDENCE.capabilities['canonical-planning'].passed, 10);
    assert.equal(PLANNER_BENCHMARK_EVIDENCE.capabilities['readiness-quality-gate'].passed, 10);
    assert.equal(PLANNER_BENCHMARK_EVIDENCE.reportPath, 'benchmarks/planner/latest-report.json');
  });
});
