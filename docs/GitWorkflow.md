# Git Workflow

## Branch Names

- Base branch: `main`
- Use meaningful prefixes like `feat/`, `bug-fix/`, `test/`, ...
  - ex: `feat/mobile-events-list`, `bug/devops-docker-compose`

## Before Starting

- `git checkout main`
- `git pull --rebase origin main`
- `git checkout -b <'prefix'>/<'name'>`

## While Working

- Commit small and often while following our conventions

## Sync With Main Before Pushing

- `git fetch origin`
- `git rebase origin/main`

## Resolve Conflicts

- `git push`

## Pull Request

- Link the Trello Card

# ALWAYS `pull --rebase` BEFORE PUSHING TO MINIMIZE MERGE CONFLICTS
