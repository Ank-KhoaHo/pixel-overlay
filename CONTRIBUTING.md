# Contributing to pixel-overlay

This project has a [Code of Conduct](CODE_OF_CONDUCT.md). By participating you are expected to
uphold it.

Thanks for considering a contribution. This file explains what will get a change rejected, not
just the mechanics of building and testing it.

## Building and testing

You need Node 24 and Python 3.12 with pytest.

```
npm ci
npx playwright install chromium
python scripts/check.py
```

`scripts/check.py` is the whole gate, and CI runs this same script. In order: the Python tests
(the docs guard and the scripts' own tests), TypeScript, the store build (which must ask for no
site at install, with one version in `package.json`, `VERSION` and the manifest), a separate
end-to-end build, the Firefox build and Mozilla's linter, unit tests (Vitest), and browser tests
in a real Chromium with the unpacked extension (Playwright). **Any skipped test fails the
gate**: a skip is an assertion that did not run. Every step has a time limit, and a step that
runs past it is stopped with every process it started. It stops at the first step that fails.
`python scripts/check.py --list` prints the steps and runs nothing.

CI runs on another operating system. A change that passes here has passed CI's steps on this
machine only: a path separator, a line ending or the case of a file name can still differ there.

The end-to-end build (`npm run build:e2e`, output `.output/chrome-mv3-e2e`) adds `localhost`
access so the tests can skip Chrome's permission prompt. Never load or ship that build as the
real extension.

## Branching and pull requests

There is one branch: `main`. Branch from it, make your change, and open a pull request back
into it — there is no direct push and no second way in.

Rebasing onto `main` is preferred over merging it in, for a history that stays easy to read:

```
git pull --rebase origin main
```

## Commit messages

Explain **why** a change was made, not just what changed — the diff already says what. Never
add a `Co-Authored-By` trailer.

**A commit message may name a ticket; code may not.** A ticket number in a comment or a test
name points at notes a reader cannot open. Say in the comment what the code does and why.

**Never summarise what a change hid.** If a commit touches anything this repository keeps
private — see [PUBLIC.md](PUBLIC.md) — its message describes the change, not the material. A
commit message is published exactly like a file, permanently, and a summary of what was
withheld is the same leak wearing different clothes.

## What gets a pull request rejected

- **It publishes working material.** [PUBLIC.md](PUBLIC.md) explains why that material is
  absent; a change that adds it back — even by accident, even only in a commit message — is
  rejected on sight. `python scripts/check_leaks.py` checks the staged diff, the commit
  messages and `.gitignore` for exactly this before you push.
- **It has no explanation.** A change nobody can review for intent gets sent back for one,
  however small the diff.
- **It changes behaviour without changing what the project says about itself.** If a change
  makes a documented limitation untrue, or makes an existing claim untrue, the documentation
  moves in the same pull request, not as a follow-up.

## Review

This project also keeps a further review checklist for its own maintainers. It is not
published, so anything in it that a contributor genuinely needs to know belongs in this file
instead — if you hit a rule that feels undocumented, that is a gap in this file, worth an issue
of its own.

## Questions

Open an issue. If you are unsure whether a change fits, ask before writing it — that is a
cheaper conversation than a rejected pull request.
