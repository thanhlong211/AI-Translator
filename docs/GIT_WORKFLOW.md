# AI Translator Git Workflow

## Repository layout

Use one private monorepo:

```text
AI-Translator/
├── desktop/
├── backend/
├── docs/
├── scripts/
├── .editorconfig
├── .gitattributes
├── .gitignore
└── .env.example
```

Do not create nested `.git` folders inside `desktop/` or `backend/`.

## Baseline

The first repository snapshot represents the stable state after Manga Session + Context Inspector.

Recommended baseline tag:

```text
v0.10.1
```

Recommended first commit:

```text
chore: establish AI Translator baseline
```

## Before the first commit

From the repository root:

```powershell
git init
git branch -M main
git status --ignored
powershell -ExecutionPolicy Bypass -File .\scripts\git-preflight.ps1
```

Review the output. In particular, `.venv`, `node_modules`, `dist`, `target`, `.env`, runtime screenshots, logs and local databases must not be staged.

Then:

```powershell
git add .
git status
```

Only after reviewing the staged file list:

```powershell
git commit -m "chore: establish AI Translator baseline"
git tag -a v0.10.1 -m "Manga session and context inspector baseline"
```

## Feature workflow from Batch 11 onward

Start every batch from a clean `main`:

```powershell
git status
git switch -c feature/batch-11-continuous-manga
```

Apply the batch, then inspect changes:

```powershell
git diff
git status
```

After testing:

```powershell
git add .
git commit -m "feat(manga): add continuous translation mode"
git switch main
git merge feature/batch-11-continuous-manga
git branch -d feature/batch-11-continuous-manga
```

Tag stable milestones rather than every small hotfix.

## Commit naming

Use Conventional Commits:

```text
feat(manga): add continuous page translation
feat(memory): add inline correction
fix(overlay): restore keyboard focus while editing
fix(electron): prevent blank main renderer
perf(ocr): reuse OCR worker
refactor(ai): introduce provider abstraction
build(windows): package OCR worker
chore: establish AI Translator baseline
```

Avoid commit messages such as `update`, `final`, `fix2`, or `test`.

## Flyway rule

Once a Flyway migration has been committed and used, do not rewrite it. Add a new migration instead.

Example:

```text
V12__add_subscription_plan.sql
V13__add_entitlements.sql
```

## Secrets

Never commit real API keys, JWT secrets, database passwords, private certificates or refresh tokens.

If a secret has ever been committed, deleting it in a later commit is not sufficient. Rotate/revoke the secret because it remains in Git history.

## GitHub

For a commercial application, keep the repository Private.

After creating the empty private repository on GitHub:

```powershell
git remote add origin <YOUR_PRIVATE_REPOSITORY_URL>
git push -u origin main
git push origin --tags
```
