---
id: T004
title: Validate live quiz lifecycle and state transitions with automated Playwright tests
wave: 2
deps:
  - T001
  - T003
status: pending
agent: null
base: null
worktree: null
task_branch: null
files:
  - tests/campus-gateway-lifecycle.spec.js
---

# T004 — Validate live quiz lifecycle and state transitions with automated Playwright tests

## Context

Following the implementation of backend reliability hardening in T001 and frontend synchronization in T003, this task verifies the complete end-to-end quiz lifecycle from campus authentication through game session join, lobby management, active questions, and final score rendering.

## Approach

1. Update or extend `tests/campus-gateway-lifecycle.spec.js` to exercise the complete lifecycle flow across host and player browser contexts.
2. Verify host room generation, student PIN submission, real-time lobby roster appearance, game launch, synchronized question rendering, answer submission, and final results view.
3. Validate that test execution runs cleanly and asserts expected HTTP and UI state transitions.

## Interface contract

- None

## Intent coverage

- SC7

## Acceptance criteria

1. Automated tests in `tests/campus-gateway-lifecycle.spec.js` verify student PIN entry, lobby join, host game launch, and question answer progression.
2. Playwright test suite passes and verifies that session results and leaderboard rankings are displayed upon quiz completion.

## Verify

```bash
npx playwright test tests/campus-gateway-lifecycle.spec.js
```

Heavy: no

## Log

- 2026-11-13 — created by planner
