#!/usr/bin/env node
import { existsSync, copyFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function copyIfMissing(src, dest) {
  if (!existsSync(src)) return false;
  if (existsSync(dest)) return true;
  ensureDir(dirname(dest));
  copyFileSync(src, dest);
  return true;
}

const root = process.cwd();

const tasks = [
  {
    src: join(root, "ayya.pdf"),
    dest: join(root, "public", "ayya.pdf"),
    label: "PDF",
  },
  {
    src: join(root, "Sreekovil-Nada-Thurannu-Jayan-Jaya-Vijaya.mp3"),
    dest: join(root, "public", "Sreekovil-Nada-Thurannu-Jayan-Jaya-Vijaya.mp3"),
    label: "Audio",
  },
];

let copiedAny = false;
for (const t of tasks) {
  const copied = copyIfMissing(t.src, t.dest);
  if (copied) copiedAny = true;
}

// Copy gallery images into public/gallery for static export if present
const gallerySrc = join(root, "gallery");
const galleryDest = join(root, "public", "gallery");
if (existsSync(gallerySrc)) {
  ensureDir(galleryDest);
  for (const entry of readdirSync(gallerySrc)) {
    const srcPath = join(gallerySrc, entry);
    const destPath = join(galleryDest, entry);
    try {
      if (statSync(srcPath).isFile()) {
        if (!existsSync(destPath)) copyFileSync(srcPath, destPath);
      }
    } catch {}
  }
}

process.exit(0);


