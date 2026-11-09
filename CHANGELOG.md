# Changelog

## [1.29.0](https://github.com/stericishere/autojobs/releases/tag/autojobs-v1.29.0) (2026-11-09)

First autojobs release, built on career-ops 1.28.0.

### Features

* **autopilot:** collect roles from SimplifyJobs and Instagram stories, evaluate them, and fill Greenhouse and Workday applications through Ego Lite or Claude in Chrome. It stops on every review page unless `auto_submit` is on.
* **setup:** `npm run setup` asks for your details, work authorization, education, work history and CV, then checks your browser backend.

### Bug Fixes

* **update:** the update check reads autojobs releases instead of upstream career-ops, so autojobs changes are not overwritten by an upstream update.

