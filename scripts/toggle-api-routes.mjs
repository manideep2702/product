#!/usr/bin/env node
import { existsSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";

function log(msg) {
  // eslint-disable-next-line no-console
  console.log(`[toggle-api-routes] ${msg}`);
}

function findApiDir(rootDir) {
  const candidates = [
    join(rootDir, "src", "app", "api"),
    join(rootDir, "app", "api"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

function findDisabledDir(rootDir) {
  const candidates = [
    join(rootDir, "src", "app", "__api_disabled"),
    join(rootDir, "app", "__api_disabled"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

function disable(rootDir) {
  const apiDir = findApiDir(rootDir);
  if (!apiDir) {
    log("No app/api directory found. Nothing to disable.");
    return;
  }
  const disabledDir = join(dirname(apiDir), "__api_disabled");
  if (existsSync(disabledDir)) {
    log("Already disabled.");
    return;
  }
  renameSync(apiDir, disabledDir);
  log(`Disabled API routes: ${apiDir} -> ${disabledDir}`);
}

function enable(rootDir) {
  const disabledDir = findDisabledDir(rootDir);
  if (!disabledDir) {
    log("No __api_disabled directory found. Nothing to enable.");
    return;
  }
  const apiDir = join(dirname(disabledDir), "api");
  if (existsSync(apiDir)) {
    log("api directory already exists. Skipping enable.");
    return;
  }
  renameSync(disabledDir, apiDir);
  log(`Enabled API routes: ${disabledDir} -> ${apiDir}`);
}

function main() {
  const action = process.argv[2];
  const rootDir = process.cwd();
  if (action !== "disable" && action !== "enable") {
    // eslint-disable-next-line no-console
    console.error("Usage: node scripts/toggle-api-routes.mjs <disable|enable>");
    process.exit(1);
  }
  try {
    if (action === "disable") disable(rootDir);
    else enable(rootDir);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  }
}

main();


