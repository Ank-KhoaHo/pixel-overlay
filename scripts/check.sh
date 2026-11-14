#!/usr/bin/env bash
# The full local gate for pixel-overlay. CI runs the same steps (.github/workflows/ci.yml).
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
npm run --silent build:e2e > .check/build-e2e.out

step "Firefox build, then Mozilla's linter (the validator AMO runs)"
npm run --silent build:firefox > .check/build-firefox.out
if grep -q '"host_permissions"' .output/firefox-mv3/manifest.json; then
  echo "FAIL: the Firefox build has host_permissions"; exit 1
fi
npx web-ext lint --source-dir .output/firefox-mv3 2>&1 | tee .check/webext-lint.out

step "unit (vitest)"
$PY scripts/extension_step.py unit 2>&1 | tee .check/vitest.out

step "end to end (playwright)"
$PY scripts/extension_step.py browser 2>&1 | tee .check/e2e.out

step "python tests (docs guard, extension steps)"
$PY -m pytest -q tests

echo; echo "ALL CHECKS PASSED (local; CI is separate)"
