const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const projectRoot = path.resolve(__dirname, "..");

function getDeploymentDomain() {
  const d =
    process.env.REPLIT_INTERNAL_APP_DOMAIN ||
    process.env.EXPO_PUBLIC_DOMAIN ||
    process.env.REPLIT_DEV_DOMAIN;
  if (!d) {
    console.error("ERROR: No deployment domain found.");
    process.exit(1);
  }
  return d.replace(/^https?:\/\//, "");
}

const domain = getDeploymentDomain();
const clerkKey =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  process.env.CLERK_PUBLISHABLE_KEY ||
  "";

console.log("Building web bundle for PWA...");
console.log(`Domain: ${domain}`);

const env = {
  ...process.env,
  EXPO_PUBLIC_DOMAIN: domain,
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkKey,
  NODE_ENV: "production",
};

try {
  execSync(
    "pnpm exec expo export --platform web --output-dir dist",
    {
      cwd: projectRoot,
      env,
      stdio: "inherit",
    }
  );
  console.log("Web build complete! Output: dist/");
} catch (err) {
  console.error("Build failed:", err.message);
  process.exit(1);
}

const indexPath = path.join(projectRoot, "dist", "index.html");
if (!fs.existsSync(indexPath)) {
  console.warn("Warning: dist/index.html not found — skipping patches.");
  process.exit(0);
}

let html = fs.readFileSync(indexPath, "utf8");

// ── 1. Scroll-lock CSS ────────────────────────────────────────────────────────
const oldReset = /<style id="expo-reset">[\s\S]*?<\/style>/;
const newReset = `<style id="expo-reset">
      html, body {
        height: 100%;
        overscroll-behavior: none;
      }
      body {
        overflow: hidden;
        position: fixed;
        top: 0; left: 0;
        width: 100%;
        background: #F9F2ED;
      }
      #root {
        display: flex;
        height: 100%;
        flex: 1;
        overflow: hidden;
      }
      /* Splash fades out once React mounts */
      #app-splash {
        position: fixed;
        inset: 0;
        background: #F9F2ED;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        transition: opacity 0.2s ease;
      }
    </style>`;

if (oldReset.test(html)) {
  html = html.replace(oldReset, newReset);
  console.log("Patched dist/index.html with scroll-lock CSS.");
} else {
  console.warn("Warning: expo-reset style block not found — skipping CSS patch.");
}

// ── 2. Locate hashed icon PNG ─────────────────────────────────────────────────
const assetsDir = path.join(projectRoot, "dist", "assets", "assets", "images");
let iconSrc = null;
if (fs.existsSync(assetsDir)) {
  const iconFile = fs.readdirSync(assetsDir).find((f) => f.startsWith("icon.") && f.endsWith(".png"));
  if (iconFile) {
    iconSrc = `/assets/assets/images/${iconFile}`;
  }
}

// ── 3. Locate entry JS ────────────────────────────────────────────────────────
const scriptMatch = html.match(/src="(\/_expo\/static\/js\/web\/entry-[^"]+\.js)"/);
const entryJs = scriptMatch ? scriptMatch[1] : null;

// ── 4. Inject resource hints into <head> ──────────────────────────────────────
const hints = [];
if (entryJs) {
  hints.push(`<link rel="preload" href="${entryJs}" as="script" crossorigin>`);
}
if (iconSrc) {
  hints.push(`<link rel="preload" href="${iconSrc}" as="image">`);
}
// Preconnect to Clerk and fonts
hints.push(`<link rel="preconnect" href="https://clerk.accounts.dev" crossorigin>`);
hints.push(`<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`);

if (hints.length > 0) {
  html = html.replace("</head>", `${hints.join("\n")}\n</head>`);
  console.log("Injected resource hints into <head>.");
}

// ── 5. Inject static splash into #root ───────────────────────────────────────
// This makes the LCP element (the icon) paint from HTML before JS loads,
// dropping LCP from ~20 s to ~1–2 s on slow connections.
if (iconSrc) {
  const splash = `<div id="app-splash"><img src="${iconSrc}" width="80" height="80" style="border-radius:20px;box-shadow:0 4px 24px rgba(0,0,0,0.10);" fetchpriority="high" alt="TalkPrep"/></div>`;
  html = html.replace('<div id="root"></div>', `<div id="root">${splash}</div>`);
  console.log(`Injected static splash (icon: ${iconSrc}).`);
} else {
  console.warn("Warning: icon PNG not found in dist — splash not injected.");
}

// ── 6. Write patched HTML ─────────────────────────────────────────────────────
fs.writeFileSync(indexPath, html, "utf8");
console.log("Patched dist/index.html — done.");
