# Vendored Claude Code skills

Third-party skills checked into this repo so they travel with it — Claude Code picks
them up automatically for anyone working in `frontend/`, with no per-machine setup.

Project-scoped skills take precedence over the same skill installed globally in
`~/.claude/skills/`.

| Skill | Source | Version | License |
|---|---|---|---|
| `frontend-design` | [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/frontend-design) | tracks `main` | see `frontend-design/LICENSE.txt` |
| `ui-ux-pro-max` | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | 2.13.0 | MIT — see `ui-ux-pro-max/LICENSE` |

Installed 2026-08-26.

## What they are

- **frontend-design** — guidance for visual design decisions: aesthetic direction,
  typography, avoiding templated-looking defaults. Prose only, no scripts.
- **ui-ux-pro-max** — searchable local database (CSV) of UI styles, colour palettes,
  font pairings, UX guidelines, icons and chart types across 22 stacks. Queried via
  `ui-ux-pro-max/scripts/search.py`, which needs Python 3 and no third-party packages.

## Updating

Only the skill payload is vendored, not the whole upstream repo — the
`ui-ux-pro-max-skill` repository is ~23 MB of CLI, gallery and screenshots that the
skill does not need at runtime.

```sh
# frontend-design
git clone --depth 1 --filter=blob:none --sparse \
  https://github.com/anthropics/skills.git /tmp/anthropic-skills
git -C /tmp/anthropic-skills sparse-checkout set skills/frontend-design
rm -rf .claude/skills/frontend-design
cp -r /tmp/anthropic-skills/skills/frontend-design .claude/skills/

# ui-ux-pro-max — the payload lives in the upstream repo's own .claude/skills/
git clone --depth 1 \
  https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git /tmp/uupm
rm -rf .claude/skills/ui-ux-pro-max
cp -r /tmp/uupm/.claude/skills/ui-ux-pro-max .claude/skills/
cp /tmp/uupm/LICENSE .claude/skills/ui-ux-pro-max/LICENSE

rm -rf /tmp/anthropic-skills /tmp/uupm
```

Then bump the version in the table above and sanity-check the database still loads:

```sh
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "dark minimal" --domain style
```
