const { execSync } = require("child_process");
const path = require("path");

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
