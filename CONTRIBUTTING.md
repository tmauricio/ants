# Contributing to Ants

Thank you for your interest in contributing! Ants is a modular desktop platform built with Tauri and Rust. This document covers everything you need to get started.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [How to Contribute](#how-to-contribute)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Adding a New Module](#adding-a-new-module)
- [Commit Convention](#commit-convention)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)

---

## Code of Conduct

This project follows our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold it.

---

## Getting Started

### Prerequisites

- [Rust](https://rustup.rs/) (stable toolchain, `x86_64-pc-windows-gnu` target)
- [Node.js](https://nodejs.org/) 18+ (for Tauri frontend tooling)
- [Tauri CLI](https://tauri.app/v1/guides/getting-started/prerequisites): `cargo install tauri-cli`
- Windows 10/11 with WebView2 runtime installed

```bash
# Add the required Rust target
rustup target add x86_64-pc-windows-gnu
```

### Fork and clone

```bash
git clone https://github.com/<your-username>/ants.git
cd ants
```

---

## Development Setup

```bash
# Run the shell in dev mode
cd shell/src-tauri
cargo tauri dev

# Run a specific module in dev mode
cd modules/notes/src-tauri
cargo tauri dev
```

Run tests before submitting any PR:

```bash
cargo test
rustfmt --check src/**/*.rs
```

---

## Project Structure

```
ants/
├── shell/          # Host Tauri app — dashboard, store, process manager
│   └── src-tauri/
├── modules/        # Independent module apps
│   ├── notes/
│   ├── tasks/
│   ├── chat/
│   └── music/
```

Each module is a self-contained Tauri process with its own `manifest.json`, frontend, and SQLite database. The shell discovers and launches them; they are not linked at compile time.

---

## How to Contribute

1. **Check existing issues** before opening a new one.
2. **Comment on an issue** to indicate you're working on it — avoids duplicate effort.
3. For non-trivial changes, **open a discussion or issue first** to align on direction before writing code.
4. Keep PRs focused: one feature or fix per PR. Avoid mixing unrelated changes.

---

## Pull Request Process

1. Fork the repo and create a branch from `main`:
   ```bash
   git checkout -b feat/my-feature
   ```
2. Make your changes and ensure all tests pass.
3. Run `rustfmt` on all modified files.
4. Push to your fork and open a PR against `main`.
5. Fill in the PR template — describe what changed and why.
6. A maintainer will review and may request changes.
7. Once approved, a maintainer merges the PR (squash or merge commit).

---

## Coding Standards

- **Language**: all code, variable names, comments, and commit messages in **English**.
- **Formatting**: `rustfmt` with default config — no exceptions.
- **Error handling**: use `anyhow` for application-level errors; define domain errors with `thiserror`.
- **Async**: `tokio` runtime; avoid blocking the async executor.
- **Tests**: unit tests live in the same file as the code under `#[cfg(test)]`. Integration tests go in `tests/`.
- **No commented-out code** in PRs. Remove dead code or open a follow-up issue.
- **No `unwrap()` in production paths** — propagate errors with `?` or handle them explicitly.

---

## Adding a New Module

1. Copy an existing module (e.g., `modules/notes`) as a starting point.
2. Update `manifest.json`:
   - Set a unique `id` (snake_case).
   - Declare only the permissions your module actually needs.
   - Set `entry.backend` to your binary name.
3. Register your module in the shell scanner (it picks up `modules/*/manifest.json` automatically at runtime — no code change needed in the shell).
4. Build the module before testing with the shell:
   ```bash
   cd modules/<your-module>/src-tauri
   cargo tauri build
   ```
5. Add a README inside your module directory describing its purpose and any setup steps.

Valid permissions: `storage:local`, `notifications`, `sync:optional`, `network:outbound`, `ipc:read:<module_id>`.

---

## Commit Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(scope): short description

[optional body]
[optional footer]
```

| Type | When to use |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code change with no behavior change |
| `test` | Adding or updating tests |
| `docs` | Documentation only |
| `chore` | Build, tooling, or dependency updates |
| `perf` | Performance improvement |

**Examples:**

```
feat(shell): add kill command for running modules
fix(notes): resolve crash on empty note title
docs: update module manifest permission list
```

---

## Reporting Bugs

Open a [GitHub Issue](../../issues/new) with:

- **Description** — what happened vs. what you expected.
- **Steps to reproduce** — minimal sequence to trigger the bug.
- **Environment** — OS version, Rust version (`rustc --version`), Tauri CLI version.
- **Logs** — relevant output from `cargo tauri dev` or the Windows Event Viewer.

---

## Requesting Features

Open a [GitHub Discussion](../../discussions/new) or an Issue tagged `enhancement`. Include:

- The problem you're solving (not just the solution you want).
- How it fits the project's goal: lightweight native modules, low RAM footprint.
- Any alternatives you've considered.

---

## Questions?

If something in this guide is unclear, open an issue tagged `question` or start a Discussion. We're happy to help.
