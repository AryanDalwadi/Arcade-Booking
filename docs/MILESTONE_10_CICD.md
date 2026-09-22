# Milestone 10: CI/CD

## Goal

Add a **robot on GitHub** that repeats your laptop checks on every push.

Milestone 9 packed lunchboxes (images). This milestone **inspects the recipe
before anyone eats**. It does not deploy Kubernetes or AWS.

## CI vs CD, in one tray

```text
you push code
      ↓
   CI = tests + types + lockfile install   (the health inspector)
      ↓
   image build + scan, tagged with git SHA (the labeled lunchbox)
      ↓
   CD = promote that same box later        (delivery; still gated here)
```

**CI** (continuous integration): merge is blocked if typecheck, tests, or
Dockerfile policy fail.

**CD** (continuous delivery): the passing image is identified by **commit SHA**,
not `latest`. Promoting that SHA later is delivery. Auto-deploying it is
continuous **deployment** — this repo does not turn that on.

## Files

| File | Role |
| --- | --- |
| `.github/workflows/ci.yml` | `npm ci`, typecheck, test, build, secret-file guard |
| `.github/workflows/images.yml` | Build each service image, tag `:sha`, Trivy scan |
| `.github/workflows/deploy.yml` | Manual skeleton; off unless `DEPLOY_ENABLED` |
| `infra/ci/policy.test.mjs` | Checks lockfile CI, SHA tags, deploy gate |
| `infra/docker/policy.test.mjs` | Still checks Dockerfiles from Milestone 9 |

Local stand-in for the robot:

```powershell
npm run verify
```

That is typecheck + tests (including policies) + build.

## Lockfile in CI

The workflow uses **`npm ci`**, the same rule as Docker. `npm install` in GitHub
could pick newer packages than your laptop.

## One artifact, one SHA

Images are tagged `${{ github.sha }}` and labeled `org.opencontainers.image.revision`.

Rebuild-for-prod is the failure mode this avoids: a “prod” image that never ran
the tests that passed on the PR.

Publish to GHCR stays **off** until you set `vars.PUBLISH_IMAGES=true` **and**
run the images workflow with `publish=true`. A green CI does not mean images
were uploaded.

## Deploy stays a skeleton

`deploy.yml` only applies to a cluster when **all** of these are true:

1. You type `confirm=deploy`
2. GitHub variable `DEPLOY_ENABLED` is `true`
3. AWS/EKS variables exist on a GitHub Environment

Until then the workflow only prints that it is not a live deploy. That is
intentional. Milestone 11 is Kubernetes; AWS is later.

## How to verify

1. Run `npm run test:policies` on your laptop (must pass).
2. Push this branch. Open **Actions** on GitHub.
3. Workflow **CI** should run Install / typecheck / test / build.
4. Optionally open **Container images** after Docker files change.
5. In the repo settings, mark **CI** as a required check on `main` so a red
   robot cannot merge.

The arcade UI at http://localhost:3000 does not change. The new surface is the
green/red check on the pull request.

## What is still not production CI/CD

- GitHub required checks must be clicked in the repo settings (this file cannot
  do that for you)
- Images are scanned; they are not signed or attested
- GHCR publish and AWS deploy are gated off
- A green pipeline is not proof a player completed a booking in production

## Interview answer

> CI is a robot that runs the same typecheck, tests, and lockfile install as my
> laptop on every push. Images are built once and tagged with the git SHA so
> later environments can promote that exact artifact instead of rebuilding.
> I scan the image and keep deploy behind an explicit confirm plus environment
> flags, because a workflow file is not a live cluster. Flaky tests, `latest`
> tags, and cloud credentials in the repo are the usual failure modes.
