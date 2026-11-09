# Changelog

## [1.30.0](https://github.com/stericishere/autojobs/compare/autojobs-v1.29.0...autojobs-v1.30.0) (2026-11-09)


### Features

* autojobs autopilot layer ([c8e8f9e](https://github.com/stericishere/autojobs/commit/c8e8f9e12168f829fa3838a331c060cae7c24858))
* **setup:** ask for education, work history and CV during npm run setup ([2816ae1](https://github.com/stericishere/autojobs/commit/2816ae10b06adef2da4737c79590043a0c27d3ee))

## [1.29.0](https://github.com/stericishere/autojobs/releases/tag/autojobs-v1.29.0) (2026-11-09)

First autojobs release, built on career-ops 1.28.0.

### Features

* **autopilot:** collect roles from SimplifyJobs and Instagram stories, evaluate them, and fill Greenhouse and Workday applications through Ego Lite or Claude in Chrome. It stops on every review page unless `auto_submit` is on.
* **setup:** `npm run setup` asks for your details, work authorization, education, work history and CV, then checks your browser backend.

### Bug Fixes

* **update:** the update check reads autojobs releases instead of upstream career-ops, so autojobs changes are not overwritten by an upstream update.
