#!/usr/bin/env node
/**
 * Detect tech stack signals from the project repo.
 * Run from project root: node docs/superpowers/control/scripts/detect-stack.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function findProjectRoot(start) {
  let dir = path.resolve(start);
  for (let i = 0; i < 12; i++) {
    if (fs.existsSync(path.join(dir, "docs", "superpowers", "control", "INDEX.md"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(start);
}

function exists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function hasAny(root, names) {
  return names.some((n) => exists(path.join(root, n)));
}

function listDirs(root, name) {
  const p = path.join(root, name);
  if (!exists(p)) return [];
  return fs.readdirSync(p, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
}

const root = findProjectRoot(process.cwd());
const detected = { root, signals: [], platforms: [], frameworks: [], packageManagers: [] };

if (exists(path.join(root, "package.json"))) {
  detected.signals.push("package.json");
  const pkg = readJson(path.join(root, "package.json"));
  const deps = { ...pkg?.dependencies, ...pkg?.devDependencies };
  if (deps?.next) {
    detected.frameworks.push("Next.js");
    detected.platforms.push("web");
  }
  if (deps?.react && !deps?.next) detected.frameworks.push("React");
  if (deps?.["react-native"]) {
    detected.frameworks.push("React Native");
    detected.platforms.push("mobile");
  }
  if (deps?.expo) detected.frameworks.push("Expo");
  if (deps?.electron) {
    detected.frameworks.push("Electron");
    detected.platforms.push("desktop");
  }
  if (deps?.["@supabase/supabase-js"]) detected.frameworks.push("Supabase");
  if (exists(path.join(root, "pnpm-lock.yaml"))) detected.packageManagers.push("pnpm");
  else if (exists(path.join(root, "yarn.lock"))) detected.packageManagers.push("yarn");
  else if (exists(path.join(root, "package-lock.json"))) detected.packageManagers.push("npm");
}

if (hasAny(root, ["next.config.js", "next.config.mjs", "next.config.ts"])) {
  if (!detected.frameworks.includes("Next.js")) detected.frameworks.push("Next.js");
  if (!detected.platforms.includes("web")) detected.platforms.push("web");
}

if (hasAny(root, ["vite.config.ts", "vite.config.js"])) detected.frameworks.push("Vite");
if (exists(path.join(root, "turbo.json"))) detected.frameworks.push("Turborepo");

const iosProjects = listDirs(root, ".").filter((d) => d.endsWith(".xcodeproj") || d.endsWith(".xcworkspace"));
if (iosProjects.length || exists(path.join(root, "ios"))) {
  detected.platforms.push("ios");
  detected.signals.push("ios/");
  if (!detected.frameworks.includes("Swift/iOS")) detected.frameworks.push("Swift/iOS");
}

if (exists(path.join(root, "android"))) {
  detected.platforms.push("android");
  detected.signals.push("android/");
}

if (exists(path.join(root, "Cargo.toml"))) {
  detected.frameworks.push("Rust");
  detected.signals.push("Cargo.toml");
}

if (exists(path.join(root, "pyproject.toml")) || exists(path.join(root, "requirements.txt"))) {
  detected.frameworks.push("Python");
}

detected.platforms = [...new Set(detected.platforms)];
detected.frameworks = [...new Set(detected.frameworks)];
detected.packageManagers = [...new Set(detected.packageManagers)];
detected.likelyExisting = detected.signals.length > 0;

const suggestedLayoutTargets = [];
if (detected.platforms.includes("web")) suggestedLayoutTargets.push("web-saas");
if (detected.platforms.includes("ios")) suggestedLayoutTargets.push("ios-tab-nav");
if (detected.platforms.includes("android")) suggestedLayoutTargets.push("android-tab-nav");
if (detected.platforms.includes("desktop")) suggestedLayoutTargets.push("desktop-mac");
detected.suggestedLayoutTargets = [...new Set(suggestedLayoutTargets)];

console.log(JSON.stringify(detected, null, 2));
