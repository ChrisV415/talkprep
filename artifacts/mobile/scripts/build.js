const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const projectRoot = path.resolve(__dirname, "..");

function getDeploymentDomain() {
  // REPLIT_DOMAINS is a comma-separated list available in both build and run
  // environments: "talk-prep.replit.app,..." — take the first entry.
  const replitDomains = process.env.REPLIT_DOMAINS
    ? process.env.REPLIT_DOMAINS.split(",")[0].trim()
    : null;

  const d =
    process.env.REPLIT_INTERNAL_APP_DOMAIN ||
    replitDomains ||
    process.env.EXPO_PUBLIC_DOMAIN ||
    process.env.REPLIT_DEV_DOMAIN ||
    "talk-prep.replit.app"; // hardcoded last-resort so the build never fails

  console.log(`Domain resolved: ${d} (REPLIT_INTERNAL_APP_DOMAIN=${process.env.REPLIT_INTERNAL_APP_DOMAIN || "unset"}, REPLIT_DOMAINS=${process.env.REPLIT_DOMAINS || "unset"})`);
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

// ── 7. Write robots.txt ───────────────────────────────────────────────────────
// Without this the SPA fallback serves index.html for /robots.txt, causing
// Lighthouse to report 46 robots.txt syntax errors.
const robotsPath = path.join(projectRoot, "dist", "robots.txt");
const robotsTxt = `User-agent: *\nAllow: /\n`;
fs.writeFileSync(robotsPath, robotsTxt, "utf8");
console.log("Written dist/robots.txt.");

// ── 8. Font-display: swap for Sora ───────────────────────────────────────────
// expo-font's useFonts() injects @font-face without font-display, causing FOIT
// (Flash of Invisible Text) on slow connections. Pre-declare the @font-face
// rules with font-display:swap + src so the browser uses a fallback font
// immediately and swaps to Sora once it's loaded.
const soraWeights = [
  { name: "Sora_400Regular", weight: 400, dir: "400Regular" },
  { name: "Sora_500Medium",  weight: 500, dir: "500Medium"  },
  { name: "Sora_600SemiBold", weight: 600, dir: "600SemiBold" },
  { name: "Sora_700Bold",    weight: 700, dir: "700Bold"    },
];

function findSoraTtf(weightDir) {
  // Locate the versioned pnpm dir — e.g. ".pnpm/@expo-google-fonts+sora@0.4.2"
  const pnpmRoot = path.join(projectRoot, "dist", "assets", "__node_modules", ".pnpm");
  if (!fs.existsSync(pnpmRoot)) return null;
  const soraEntry = fs.readdirSync(pnpmRoot).find((d) => d.startsWith("@expo-google-fonts+sora"));
  if (!soraEntry) return null;
  const dir = path.join(pnpmRoot, soraEntry, "node_modules", "@expo-google-fonts", "sora", weightDir);
  if (!fs.existsSync(dir)) return null;
  const file = fs.readdirSync(dir).find((f) => f.endsWith(".ttf"));
  if (!file) return null;
  return `/assets/__node_modules/.pnpm/${soraEntry}/node_modules/@expo-google-fonts/sora/${weightDir}/${file}`;
}

const fontFaceRules = [];
let soraRegularSrc = null;
for (const { name, weight, dir } of soraWeights) {
  const src = findSoraTtf(dir);
  if (src) {
    if (name === "Sora_400Regular") soraRegularSrc = src;
    fontFaceRules.push(
      `  @font-face { font-family: '${name}'; src: url('${src}') format('truetype'); font-weight: ${weight}; font-style: normal; font-display: swap; }`
    );
  }
}

if (fontFaceRules.length > 0) {
  const fontStyle = `<style id="font-display-swap">\n${fontFaceRules.join("\n")}\n</style>`;
  html = html.replace("</head>", `${fontStyle}\n</head>`);
  console.log(`Injected font-display:swap for ${fontFaceRules.length} Sora weights.`);
}

if (soraRegularSrc) {
  html = html.replace(
    "</head>",
    `<link rel="preload" href="${soraRegularSrc}" as="font" type="font/ttf" crossorigin>\n</head>`
  );
  console.log(`Preloaded Sora_400Regular.`);
}

// ── 9. Final write ────────────────────────────────────────────────────────────
fs.writeFileSync(indexPath, html, "utf8");
console.log("Final index.html written.");
