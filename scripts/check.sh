#!/usr/bin/env bash
# The full local gate for pixel-overlay. CI runs the same steps (.github/workflows/ci.yml).
# Fails on any skipped test: a skip is an assertion that did not run.
set -eo pipefail
cd "$(dirname "$0")/.."

mkdir -p .check
step() { echo; echo "=== $1"; }

step "typecheck"
npm run --silent typecheck

step "build (store build, then the e2e test build)"
npm run --silent build > .check/build.out
if grep -q '"host_permissions"' .output/chrome-mv3/manifest.json; then
  echo "FAIL: the store build has host_permissions"; exit 1
fi
npm run --silent build:e2e > .check/build-e2e.out

step "unit (vitest)"
npx vitest run 2>&1 | tee .check/vitest.out
if grep -qiE '[0-9]+ (skipped|todo)' .check/vitest.out; then
  echo "FAIL: vitest skipped tests"; exit 1
fi

step "end to end (playwright)"
npx playwright test 2>&1 | tee .check/e2e.out
if grep -qiE '[0-9]+ skipped' .check/e2e.out; then
  echo "FAIL: playwright skipped tests"; exit 1
fi

step "docs guard"
python -m pytest -q tests/test_docs_integrity.py

echo; echo "ALL CHECKS PASSED (local; CI is separate)"
