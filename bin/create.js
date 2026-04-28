#!/usr/bin/env node
/**
 * @westeuropeco/create-martha-plugin
 *
 * Scaffolds a new Martha plugin (BFF + ui/) from
 * westeuropeco/martha-plugin-template.
 *
 * Interactive mode (TTY): prompts for each input.
 * Non-interactive mode: pass all values via flags + --yes.
 *
 * Flags:
 *   --slug <slug>            URL segment, package suffix
 *   --display <name>         Display name (defaults to title-cased slug)
 *   --icon <name>            Phosphor icon name (default: puzzle-piece)
 *   --color <hex>            Brand color hex (default: #6366f1)
 *   --description <text>     Manifest description (default: "<display> plugin for Martha.")
 *   --yes                    Accept defaults for any unspecified value (skip prompts)
 *
 * Zero runtime deps — built-ins only.
 */

import { spawnSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { join, resolve, basename } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const TEMPLATE_REPO =
  "https://github.com/westeuropeco/martha-plugin-template.git";
const TEMPLATE_REF = process.env.MARTHA_PLUGIN_TEMPLATE_REF || "";

const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "__pycache__",
  "venv",
  "env",
  ".venv",
  "dist",
  ".pytest_cache",
]);

const BINARY_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".ico",
  ".pdf",
  ".zip",
  ".tar",
  ".gz",
  ".whl",
]);

const c = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

function fail(msg) {
  console.error(`${c.red}error:${c.reset} ${msg}`);
  process.exit(1);
}

function check(name) {
  const r = spawnSync(name, ["--version"], { stdio: "pipe" });
  if (r.status !== 0) fail(`\`${name}\` is required but not found on PATH.`);
}

function titleCase(s) {
  return s
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

const validateSlug = (s) => /^[a-z][a-z0-9-]{2,30}$/.test(s);
const validateColor = (s) => /^#[0-9a-fA-F]{6}$/.test(s);

function parseArgs(argv) {
  const out = { positional: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--yes" || a === "-y") {
      out.flags.yes = true;
    } else if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        fail(`flag --${key} requires a value`);
      }
      out.flags[key] = next;
      i++;
    } else {
      out.positional.push(a);
    }
  }
  return out;
}

async function promptInteractive(rl, question, defaultVal, validate) {
  const suffix = defaultVal ? ` ${c.dim}(${defaultVal})${c.reset}` : "";
  while (true) {
    const ans = (
      await rl.question(`${c.cyan}?${c.reset} ${question}${suffix} `)
    ).trim();
    const value = ans || defaultVal || "";
    if (!value) {
      console.log(`  ${c.red}value required${c.reset}`);
      continue;
    }
    if (validate && !validate(value)) {
      console.log(`  ${c.red}invalid value${c.reset}`);
      continue;
    }
    return value;
  }
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

function replaceTokens(filePath, tokens) {
  const ext = filePath.slice(filePath.lastIndexOf("."));
  if (BINARY_EXT.has(ext.toLowerCase())) return false;

  let content;
  try {
    content = readFileSync(filePath, "utf8");
  } catch {
    return false;
  }

  let changed = false;
  for (const [token, value] of Object.entries(tokens)) {
    if (content.includes(token)) {
      content = content.split(token).join(value);
      changed = true;
    }
  }
  if (changed) writeFileSync(filePath, content);
  return changed;
}

async function resolveInput(
  name,
  flagValue,
  defaultVal,
  validate,
  rl,
  useDefaults,
) {
  if (flagValue !== undefined) {
    if (validate && !validate(flagValue)) {
      fail(`--${name}: invalid value "${flagValue}"`);
    }
    return flagValue;
  }
  if (useDefaults) {
    if (!defaultVal)
      fail(`--${name} required when --yes is set without a default`);
    return defaultVal;
  }
  return promptInteractive(
    rl,
    `${name[0].toUpperCase()}${name.slice(1)}:`,
    defaultVal,
    validate,
  );
}

async function main() {
  console.log(`${c.bold}create-martha-plugin${c.reset}\n`);

  check("git");

  const { positional, flags } = parseArgs(process.argv.slice(2));
  const targetArg = positional[0];
  const useDefaults = !!flags.yes;
  const isInteractive = stdin.isTTY && !useDefaults;

  const rl = isInteractive
    ? createInterface({ input: stdin, output: stdout })
    : null;

  const targetDir = targetArg
    ? resolve(targetArg)
    : isInteractive
      ? resolve(await promptInteractive(rl, "Plugin directory:", "my-plugin"))
      : fail(
          "target directory required as positional arg in non-interactive mode",
        );

  if (existsSync(targetDir)) {
    const entries = readdirSync(targetDir);
    if (entries.length > 0) {
      rl?.close();
      fail(`target directory \`${targetDir}\` exists and is not empty.`);
    }
  }

  const defaultSlug = basename(targetDir).replace(/^martha-/, "");

  const slug = await resolveInput(
    "slug",
    flags.slug,
    defaultSlug,
    validateSlug,
    rl,
    useDefaults,
  );
  const display = await resolveInput(
    "display",
    flags.display,
    titleCase(slug),
    null,
    rl,
    useDefaults,
  );
  const icon = await resolveInput(
    "icon",
    flags.icon,
    "puzzle-piece",
    null,
    rl,
    useDefaults,
  );
  const color = await resolveInput(
    "color",
    flags.color,
    "#6366f1",
    validateColor,
    rl,
    useDefaults,
  );
  const description = await resolveInput(
    "description",
    flags.description,
    `${display} plugin for Martha.`,
    null,
    rl,
    useDefaults,
  );

  rl?.close();

  const tokens = {
    __PLUGIN_SLUG__: slug,
    __PLUGIN_NAME__: `martha-${slug}`,
    __PLUGIN_DISPLAY__: display,
    __PLUGIN_ICON__: icon,
    __PLUGIN_COLOR__: color,
    __PLUGIN_DESCRIPTION__: description,
  };

  console.log(
    `\n${c.bold}Scaffolding${c.reset} ${c.cyan}${targetDir}${c.reset}…\n`,
  );

  if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });

  const cloneArgs = ["clone", "--depth=1"];
  if (TEMPLATE_REF) cloneArgs.push("--branch", TEMPLATE_REF);
  cloneArgs.push(TEMPLATE_REPO, targetDir);
  const clone = spawnSync("git", cloneArgs, { stdio: "inherit" });
  if (clone.status !== 0) {
    fail(
      `git clone failed (status ${clone.status}). Is GITHUB_TOKEN set with read access to westeuropeco/martha-plugin-template? Or set MARTHA_PLUGIN_TEMPLATE_REF to a public mirror.`,
    );
  }

  rmSync(join(targetDir, ".git"), { recursive: true, force: true });

  let touched = 0;
  for (const file of walk(targetDir)) {
    if (replaceTokens(file, tokens)) touched++;
  }
  console.log(
    `${c.green}✓${c.reset} Substituted tokens across ${touched} file(s)`,
  );

  spawnSync("git", ["init", "-b", "main"], { cwd: targetDir, stdio: "ignore" });
  spawnSync("git", ["add", "-A"], { cwd: targetDir, stdio: "ignore" });
  const commit = spawnSync(
    "git",
    [
      "commit",
      "-m",
      `chore: scaffold ${slug} plugin from martha-plugin-template`,
    ],
    { cwd: targetDir, stdio: "ignore" },
  );
  if (commit.status === 0) {
    console.log(
      `${c.green}✓${c.reset} Initialized git repo with initial commit`,
    );
  } else {
    console.log(
      `${c.yellow}!${c.reset} Skipped initial commit (configure \`user.name\` / \`user.email\` and run \`git commit\` manually)`,
    );
  }

  const printSteps = (title, lines) => {
    console.log(`\n${c.bold}${title}${c.reset}`);
    for (const line of lines) console.log(`  ${line}`);
  };

  console.log(
    `\n${c.green}${c.bold}Plugin scaffolded${c.reset} at ${c.cyan}${targetDir}${c.reset}`,
  );

  printSteps("1. Auth (one-time, per dev machine):", [
    `${c.dim}gh auth refresh --hostname github.com --scopes read:packages${c.reset}`,
    `${c.dim}export GITHUB_TOKEN=$(gh auth token)${c.reset}`,
    `${c.dim}# add the export to ~/.zshrc / ~/.bashrc to persist${c.reset}`,
  ]);

  printSteps("2. Install ui dependencies:", [
    `${c.dim}cd ${basename(targetDir)}/ui${c.reset}`,
    `${c.dim}npm install --legacy-peer-deps${c.reset}`,
  ]);

  printSteps("3. Run the BFF locally:", [
    `${c.dim}cd ${basename(targetDir)}${c.reset}`,
    `${c.dim}docker compose up -d${c.reset}`,
    `${c.dim}curl http://localhost:8099/health${c.reset}`,
  ]);

  printSteps("4. Publish your ui package (when you're ready):", [
    `${c.dim}cd ${basename(targetDir)}/ui${c.reset}`,
    `${c.dim}git tag ${slug}-ui-v0.0.1 && git push origin --tags${c.reset}`,
    `${c.dim}# GHA at .github/workflows/publish-ui.yml publishes to GHCR${c.reset}`,
  ]);

  printSteps("5. Wire into the Martha host (PR to westeuropeco/martha):", [
    `${c.dim}martha-admin-svelte/package.json:${c.reset}`,
    `    "@westeuropeco/${slug}-ui": "^0.0.1"`,
    `${c.dim}martha-admin-svelte/src/lib/plugins/discover.ts:${c.reset}`,
    `    REGISTRY["${slug}"] = () => import("@westeuropeco/${slug}-ui");`,
    `${c.dim}martha-admin-svelte/vite.config.ts ssr.noExternal:${c.reset}`,
    `    "@westeuropeco/${slug}-ui",`,
    `${c.dim}+ register your BFF spec via Martha's seed_plugins flow${c.reset}`,
  ]);

  printSteps("6. Read the docs:", [
    `${c.dim}https://github.com/westeuropeco/martha/blob/main/dev_docs/specs/plugin-author-guide.md${c.reset}`,
  ]);

  console.log("");
}

main().catch((e) => {
  console.error(`${c.red}fatal:${c.reset}`, e?.stack || e);
  process.exit(1);
});
