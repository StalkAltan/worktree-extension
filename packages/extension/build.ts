import { mkdir, rm, cp, exists } from "fs/promises";
import { join, dirname } from "path";

const ROOT_DIR = dirname(import.meta.path);
const SRC_DIR = join(ROOT_DIR, "src");
const DIST_DIR = join(ROOT_DIR, "dist");
const PUBLIC_DIR = join(ROOT_DIR, "public");

const isWatch = process.argv.includes("--watch");

async function clean() {
  if (await exists(DIST_DIR)) {
    await rm(DIST_DIR, { recursive: true });
  }
  await mkdir(DIST_DIR, { recursive: true });
}

async function buildContentScript() {
  const entrypoint = join(SRC_DIR, "content/index.tsx");
  
  if (!(await exists(entrypoint))) {
    console.log("⏭️  Skipping content script (entry not found)");
    return;
  }

  const result = await Bun.build({
    entrypoints: [entrypoint],
    outdir: join(DIST_DIR, "content"),
    target: "browser",
    format: "iife",
    minify: !isWatch,
    sourcemap: isWatch ? "inline" : "none",
  });

  if (!result.success) {
    console.error("❌ Content script build failed:");
    for (const log of result.logs) {
      console.error(log);
    }
    throw new Error("Content script build failed");
  }
  
  console.log("✅ Built content script");
}

async function buildPopup() {
  const entrypoint = join(SRC_DIR, "popup/index.tsx");
  
  if (!(await exists(entrypoint))) {
    console.log("⏭️  Skipping popup (entry not found)");
    return;
  }

  const result = await Bun.build({
    entrypoints: [entrypoint],
    outdir: join(DIST_DIR, "popup"),
    target: "browser",
    format: "esm",
    minify: !isWatch,
    sourcemap: isWatch ? "inline" : "none",
  });

  if (!result.success) {
    console.error("❌ Popup build failed:");
    for (const log of result.logs) {
      console.error(log);
    }
    throw new Error("Popup build failed");
  }
  
  console.log("✅ Built popup");
}

async function buildBackground() {
  const entrypoint = join(SRC_DIR, "background/index.ts");
  
  if (!(await exists(entrypoint))) {
    console.log("⏭️  Skipping background script (entry not found)");
    return;
  }

  const result = await Bun.build({
    entrypoints: [entrypoint],
    outdir: join(DIST_DIR, "background"),
    target: "browser",
    format: "esm",
    minify: !isWatch,
    sourcemap: isWatch ? "inline" : "none",
  });

  if (!result.success) {
    console.error("❌ Background script build failed:");
    for (const log of result.logs) {
      console.error(log);
    }
    throw new Error("Background script build failed");
  }
  
  console.log("✅ Built background script");
}

async function copyStaticFiles() {
  // Copy manifest.json
  const manifestSrc = join(ROOT_DIR, "manifest.json");
  const manifestDest = join(DIST_DIR, "manifest.json");
  await Bun.write(manifestDest, Bun.file(manifestSrc));
  console.log("✅ Copied manifest.json");

  // Copy popup HTML
  const popupHtmlSrc = join(SRC_DIR, "popup/index.html");
  const popupHtmlDest = join(DIST_DIR, "popup/index.html");
  if (await exists(popupHtmlSrc)) {
    await mkdir(dirname(popupHtmlDest), { recursive: true });
    await Bun.write(popupHtmlDest, Bun.file(popupHtmlSrc));
    console.log("✅ Copied popup/index.html");
  } else {
    console.log("⏭️  Skipping popup/index.html (not found)");
  }

  // Copy icons
  const iconsDir = join(PUBLIC_DIR, "icons");
  const iconsDestDir = join(DIST_DIR, "icons");
  if (await exists(iconsDir)) {
    await cp(iconsDir, iconsDestDir, { recursive: true });
    console.log("✅ Copied icons");
  } else {
    console.log("⏭️  Skipping icons (not found)");
  }

  // Copy content styles (if exists)
  const contentCssSrc = join(SRC_DIR, "content/styles/content.css");
  const contentCssDest = join(DIST_DIR, "content/content.css");
  if (await exists(contentCssSrc)) {
    await mkdir(dirname(contentCssDest), { recursive: true });
    await Bun.write(contentCssDest, Bun.file(contentCssSrc));
    console.log("✅ Copied content/styles/content.css");
  }

  // Copy popup styles (if exists)
  const popupCssSrc = join(SRC_DIR, "popup/styles/popup.css");
  const popupCssDest = join(DIST_DIR, "popup/popup.css");
  if (await exists(popupCssSrc)) {
    await mkdir(dirname(popupCssDest), { recursive: true });
    await Bun.write(popupCssDest, Bun.file(popupCssSrc));
    console.log("✅ Copied popup/styles/popup.css");
  }
}

async function build() {
  console.log(`\n🔨 Building extension${isWatch ? " (watch mode)" : ""}...\n`);
  
  await clean();
  
  // Run builds in parallel
  await Promise.all([
    buildContentScript(),
    buildPopup(),
    buildBackground(),
  ]);
  
  await copyStaticFiles();
  
  console.log("\n✨ Build complete!\n");
}

// Initial build
await build();

// Watch mode
if (isWatch) {
  console.log("👀 Watching for changes...\n");
  
  const { watch } = await import("fs");
  
  let buildTimeout: ReturnType<typeof setTimeout> | null = null;
  
  const rebuild = () => {
    if (buildTimeout) {
      clearTimeout(buildTimeout);
    }
    buildTimeout = setTimeout(async () => {
      try {
        await build();
      } catch (error) {
        console.error("Build error:", error);
      }
    }, 100);
  };
  
  // Watch src directory
  watch(SRC_DIR, { recursive: true }, (eventType, filename) => {
    if (filename && !filename.includes("node_modules")) {
      console.log(`📝 ${eventType}: ${filename}`);
      rebuild();
    }
  });
  
  // Watch manifest.json
  watch(join(ROOT_DIR, "manifest.json"), () => {
    console.log("📝 change: manifest.json");
    rebuild();
  });
  
  // Watch public directory
  if (await exists(PUBLIC_DIR)) {
    watch(PUBLIC_DIR, { recursive: true }, (eventType, filename) => {
      if (filename) {
        console.log(`📝 ${eventType}: public/${filename}`);
        rebuild();
      }
    });
  }
}
