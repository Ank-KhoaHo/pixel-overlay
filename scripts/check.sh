#!/usr/bin/env bash
# The old local gate for pixel-overlay, kept while it and scripts/check.py are compared.
# scripts/check.py is the gate, and what CI runs. Both run the same steps.
# Fails on any skipped test: a skip is an assertion that did not run.
#
# The store build's steps go through scripts/extension_step.py: each has a time limit, a
# skipped test fails it, and a step that runs past its limit is stopped with every process
# it started (npm, the tool, the browsers the tests opened), by process ID, never by name.
set -eo pipefail
cd "$(dirname "$0")/.."

PY=python
command -v python >/dev/null 2>&1 || PY=python3

mkdir -p .check
step() { echo; echo "=== $1"; }

step "typecheck"
$PY scripts/extension_step.py typecheck

step "build (the store build)"
$PY scripts/extension_step.py build > .check/build.out

step "extension checks (no site access at install, one version in three places)"
$PY scripts/extension_step.py checks

step "the e2e test build"
$PY scripts/extension_step.py e2e-build > .check/build-e2e.out

step "Firefox build, its site access, then Mozilla's linter (the validator AMO runs)"
$PY scripts/extension_step.py firefox 2>&1 | tee .check/webext-lint.out

step "unit (vitest)"
$PY scripts/extension_step.py unit 2>&1 | tee .check/vitest.out

step "end to end (playwright)"
$PY scripts/extension_step.py browser 2>&1 | tee .check/e2e.out

step "python tests (docs guard, extension steps)"
$PY -m pytest -q tests

echo; echo "ALL CHECKS PASSED (local; CI is separate)"
