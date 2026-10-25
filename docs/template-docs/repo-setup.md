# Repository setup — branches, defaults, and services

## 1. Create the repository

1. Create a new GitHub repository from this template (or clone + re-init).
2. Push the initial commit to `main`.
3. Create `next` from `main` and **make `next` the default branch**
   (GitHub → Settings → General → Default branch). All feature PRs target
   `next`; `main` is only touched by the Version Packages PR.

```sh
git checkout -b next
git push -u origin next
# then set next as default in GitHub settings
```

## 2. Why two branches?

- **`next`** — integration. Feature work merges here; CI (`build.yml`,
  `changes.yml`) gates every PR. Changesets accumulate here between releases.
- **`main`** — release. Only the Version Packages PR (opened automatically from
  `next`) merges here. A push to `main` triggers `publish.yml`, which builds,
  publishes to npm, tags, and opens + merges a back-merge PR into `next`.

Full flow: [branching.md](branching.md) and [publishing.md](publishing.md).

## 3. Branch protection

Nothing in the pipeline pushes to a branch directly, so both branches can be
protected. Follow the "Open App Release CI Rollout" SOP.

On `next`: changes arrive by pull request with the door checks required and **one
approving review**, and the CI GitHub App is a "pull requests only" bypass actor so
the release back-merge can merge itself rather than waiting for a reviewer.

On `main`: **two rulesets, not one.** A ruleset bypass applies to every rule in its
ruleset, and the release needs to skip the review without skipping the gate — so the
review and the checks cannot live together.

- The review ruleset (`protect-main`) carries **one approval** and dismiss-stale-reviews.
  Its bypass actors are the Repository admin role, any break-glass team the repo has,
  and **the CI GitHub App**, all "pull requests only". The App's bypass is what lets
  `release.yml` merge the Version Packages PR unattended.
- The checks ruleset (`protect-main-checks`) carries the `rr:` checks, `build`, and the
  deletion and non-fast-forward rules. Its bypass actors are the Repository admin role
  and any break-glass team — the human override for a stuck check — but **not** the App.
  Excluding it is what stops a dispatch from releasing a failing build: a human override
  is a person deciding to, whereas an App override would be anyone with write deciding to.

Releases are cut by dispatching **Cut the Release** (`release.yml`), not by clicking merge
on the Version Packages PR.

## 4. Services to connect

| Service | What to set up | Doc |
|---|---|---|
| npm | Own the org/scope; publish a `0.0.0` placeholder for each package (a package must exist before it can be configured, and CI refuses to publish until they all do); configure **Trusted Publisher** per package | [publishing.md](publishing.md) § first publish bootstrap |
| GitHub Actions | Ships enabled; workflows live in `.github/workflows/` | [publishing.md](publishing.md) |
| GitHub Releases | The publish workflow tags `vX.Y.Z`; `mj app install` resolves versions from these tags | [publishing.md](publishing.md) |

## 5. Local prerequisites

Node ≥ 18 and pnpm ≥ 10 (`corepack pnpm --version`; this repo and MJ 6.x are pnpm monorepos). A SQL Server database is only needed once you develop
schema/metadata against a MemberJunction instance — see
[linking-to-mj.md](linking-to-mj.md) for exactly when.
