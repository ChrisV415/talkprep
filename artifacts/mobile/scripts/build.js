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

// Patch dist/index.html: replace the minimal expo-reset block with one that
// also locks the body in place (prevents address-bar resize jitter) and
// disables rubber-band overscroll on the entire page.
const indexPath = path.join(projectRoot, "dist", "index.html");
if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, "utf8");

  const oldReset = /<style id="expo-reset">[\s\S]*?<\/style>/;
  const newReset = `<style id="expo-reset">
      /* Make body full-height */
      html,
      body {
        height: 100%;
        /* Prevent rubber-band / elastic overscroll on the page */
        overscroll-behavior: none;
      }
      /* Disable body scrolling when using <ScrollView>.
         position:fixed locks the layout so the mobile browser address-bar
         appearing / disappearing never resizes the viewport and causes jitter. */
      body {
        overflow: hidden;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
      }
      /* Make root element full-height */
      #root {
        display: flex;
        height: 100%;
        flex: 1;
        overflow: hidden;
      }
    </style>`;

  if (oldReset.test(html)) {
    html = html.replace(oldReset, newReset);
    fs.writeFileSync(indexPath, html, "utf8");
    console.log("Patched dist/index.html with scroll-lock CSS.");
  } else {
    console.warn("Warning: expo-reset style block not found in index.html — skipping patch.");
  }
}
