#!/bin/bash
# SessionStart hook for Claude Code on the web.
#
# Why this exists: the remote web environment is an ephemeral container whose
# disk is reverted to the session's initial snapshot after periods of inactivity
# (between turns). Two things break each time: node_modules disappears, and the
# local branch falls behind origin. This hook repairs both at session start.
#
# Safe to run repeatedly. No-op outside the remote env.
set -euo pipefail

# Only act in the Claude Code on the web remote env; never touch a local clone.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# 1) Fast-forward the current branch to origin (non-destructive: --ff-only
#    refuses if local diverged or the tree is dirty, so nothing is ever lost).
branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
if [ -n "$branch" ] && [ "$branch" != "HEAD" ]; then
  git fetch origin "$branch" 2>/dev/null \
    && git merge --ff-only "origin/$branch" 2>/dev/null \
    || echo "[session-start] git fast-forward skipped (diverged/dirty/offline)"
fi

# 2) Restore node_modules. npm install (not ci) so the post-hook container
#    cache is reused; idempotent when already installed.
npm install
