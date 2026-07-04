# VBI PME

VBI PME is a desktop business management app built with React, Vite, Electron, and SQLite. It includes windows for products, clients, suppliers, purchases, sales, cash tracking, statistics, configuration, and user management.

## Tech Stack

- React 19
- Vite 6
- Electron 42
- TypeScript
- Tailwind CSS
- SQLite through `better-sqlite3`
- Electron Builder for Windows `.exe` packaging

## Requirements

- Node.js LTS
- npm
- Windows is recommended for building the Windows installer

## Install

```bash
npm install
```

If native Electron/SQLite dependencies need to be rebuilt, run:

```bash
npm run rebuild:native
```

## Environment Variables

Copy the example environment file if you need local variables:

```bash
copy .env.example .env
```

The current `.env.example` includes:

- `GEMINI_API_KEY`
- `APP_URL`

Do not commit real `.env` files. They are ignored by Git.

## Development

Run the web app only:

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

Run the full Electron desktop app in development:

```bash
npm run electron:dev
```

## Build

Build the Vite app:

```bash
npm run build
```

Create the Windows installer:

```bash
npm run build:exe
```

The packaged app is generated in:

```text
dist-exe/
```

This folder can become very large, so it is ignored by Git. Rebuild it locally whenever you need a fresh `.exe`.

## Useful Scripts

- `npm run dev` starts Vite on port `3000`
- `npm run dev:vite` starts only the Vite dev server
- `npm run dev:electron` starts Electron after Vite is ready
- `npm run electron:dev` starts Vite and Electron together
- `npm run lint` runs TypeScript checks
- `npm run build` creates the web production build
- `npm run build:exe` creates the Windows installer
- `npm run clean:build` removes `dist` and `dist-exe`

## GitHub Upload Notes

The repository ignores heavy/generated files such as:

- `node_modules/`
- `dist/`
- `dist-exe/`
- `win-unpacked/`
- Windows installers and binaries (`*.exe`, `*.blockmap`, `*.asar`, `*.yml`)
- local `.env` files
- local SQLite database files
- logs and cache files

Only source code, configuration, and lock files should be committed. After cloning the project on another machine, run `npm install` and rebuild the app locally.

## Project Structure

```text
electron/       Electron main process, preload script, and SQLite database code
src/            React application source
src/components/ App windows and UI components
src/services/   Local persistence helpers
assets/         Static project assets
dist/           Generated Vite build, ignored by Git
dist-exe/       Generated Windows installer/build output, ignored by Git
```
