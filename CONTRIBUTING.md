# Contributing

This is a Discourse theme repository: raw SCSS, Handlebars templates, and Ember/JS theme source,
with no build step of its own. Development happens against a real (or local) Discourse instance.

## Local Development

There is no `package.json` and no local dev server in this repo — Discourse itself compiles and
serves theme assets. The standard way to develop a Discourse theme locally is Discourse's own
[`discourse_theme`](https://github.com/discourse/discourse_theme) CLI gem, which live-reloads this
repo's files into a running Discourse instance (local or remote) as you save:

```
gem install discourse_theme
discourse_theme watch .
```

You'll need a Discourse instance to point it at (Discourse's official
[`discourse_docker`](https://github.com/discourse/discourse_docker) setup, or a Discourse dev
container). See `discourse_theme`'s own docs for connecting it to your instance.

Alternatively, for changes you're comfortable verifying without live reload: push to a branch and
install the theme from that branch via **Admin → Customize → Themes → Install → From a git
repository**.

There is no automated test suite. Verify changes manually in a real Discourse instance, checking
both desktop and mobile breakpoints, before opening a PR.

## Before You Start

Read [ARCHITECTURE.md](ARCHITECTURE.md), especially **Known Gaps / Unwired Code**. Most settings in
`settings.yml` (8 of 12) are read by real code; the remaining 4 are intentionally reserved for
planned work, documented as such — confirm which before assuming a given setting does something.
Three genuinely dead files (`common/homepage.html`, `common/sidebar.html`, `common/variables.scss`)
were removed in RC cleanup — if you're reading this in an older checkout, they no longer exist on the
current branch.

## Code Conventions

See [CODING_STANDARDS.md](CODING_STANDARDS.md) for the full, detailed reference (folder structure,
naming conventions, JS/SCSS style, and the connector/service/lib split). The short version: match
what the existing code already does rather than introducing a new style in one file, never
duplicate logic that already exists in `lib/`/`services/`, and keep connectors thin — presentation
only, no business logic.

## Adding a Theme Setting

Add it to `settings.yml` with a `type`, `default`, and a `description`. Most existing settings are
now wired to real code (see ARCHITECTURE.md's **Known Gaps / Unwired Code** for the current count) —
if you add a new one, make sure your own code actually checks `settings.your_setting_name`, so it
doesn't become another inert toggle.

## Commit Messages & Branch Naming

See [CODING_STANDARDS.md](CODING_STANDARDS.md#commit-messages) — Conventional Commits going
forward, no ad hoc version labels in commit messages, and a proposed branch-naming pattern (this
repo has no existing branch convention to follow yet).

## Documentation

If a change is more than a small fix, consider whether it needs a design note in `docs/`, following
the existing format used there (a `Version` / `Repository` / `Scope` header followed by prose
sections). Update `ARCHITECTURE.md` if you wire up something previously listed under **Known Gaps**,
or if you introduce a new gap worth flagging for the next person.
