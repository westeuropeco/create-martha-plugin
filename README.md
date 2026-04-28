# @westeuropeco/create-martha-plugin

Scaffolds a new Martha plugin (BFF + ui/) from [`westeuropeco/martha-plugin-template`](https://github.com/westeuropeco/martha-plugin-template). Per [issue #104](https://github.com/westeuropeco/martha/issues/104) Phase 3 Q5: the alternative to "copy-paste from one of the existing plugins".

## Usage

```bash
npm create @westeuropeco/martha-plugin my-plugin
```

You'll be prompted for:

- **Plugin slug** — URL segment + package suffix (`my-plugin` → `@westeuropeco/my-plugin-ui`, mounted at `/plugins/my-plugin`). Must match `^[a-z][a-z0-9-]{2,30}$`.
- **Display name** — what users see in the integrations list. Defaults to title-cased slug.
- **Phosphor icon name** — see [phosphoricons.com](https://phosphoricons.com).
- **Brand color** — hex, e.g. `#10b981`.
- **Description** — manifest description, page subtitles, etc.

The wrapper clones the template, substitutes placeholders, runs `git init`, and prints the post-install checklist. Zero runtime deps — only Node 20+ and `git` on PATH.

## Auth

GHCR npm requires `read:packages` for ALL reads, even on public packages. Configure once:

```bash
gh auth refresh --hostname github.com --scopes read:packages
export GITHUB_TOKEN=$(gh auth token)
```

The wrapper itself doesn't need the token, but the cloned template's `ui/` package install does. The post-install checklist reminds you.

## Source of truth

- Template repo: [`westeuropeco/martha-plugin-template`](https://github.com/westeuropeco/martha-plugin-template)
- Plugin author guide: [`dev_docs/specs/plugin-author-guide.md`](https://github.com/westeuropeco/martha/blob/main/dev_docs/specs/plugin-author-guide.md)
- Plugin host contract: [`dev_docs/specs/plugin-host-contract.md`](https://github.com/westeuropeco/martha/blob/main/dev_docs/specs/plugin-host-contract.md)

## Updating the template

This wrapper always clones `main` of `westeuropeco/martha-plugin-template`. To pin to a tag during dev, set `MARTHA_PLUGIN_TEMPLATE_REF`:

```bash
MARTHA_PLUGIN_TEMPLATE_REF=v0.1.0 npm create @westeuropeco/martha-plugin my-plugin
```

## Releasing

```bash
npm version patch         # bumps package.json
git tag v$(node -p "require('./package.json').version")
git push origin --tags
# GHA at .github/workflows/publish.yml publishes to GHCR
```
