const {
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} = require("node:fs/promises");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const outputDirectory = path.join(projectRoot, "dist");
const defaultProductionApi =
  "https://brilliant-mercy-production-c94f.up.railway.app/api/v1";

function publicBuildValue(name, fallback = "") {
  const value = process.env[name]?.trim() || fallback;

  if (/\r|\n|["\\]/u.test(value)) {
    throw new Error(
      `${name} contains characters that are unsafe for JavaScript`,
    );
  }

  return value;
}

async function buildFrontend() {
  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });

  await Promise.all([
    cp(path.join(projectRoot, "assets"), path.join(outputDirectory, "assets"), {
      recursive: true,
    }),
    cp(path.join(projectRoot, "pages"), path.join(outputDirectory, "pages"), {
      recursive: true,
    }),
    cp(
      path.join(projectRoot, "index.html"),
      path.join(outputDirectory, "index.html"),
    ),
  ]);

  const rootFiles = await readdir(projectRoot, { withFileTypes: true });
  const googleVerificationFiles = rootFiles.filter(
    (entry) => entry.isFile() && /^google[a-z0-9_-]+\.html$/iu.test(entry.name),
  );

  await Promise.all(
    googleVerificationFiles.map((entry) =>
      cp(
        path.join(projectRoot, entry.name),
        path.join(outputDirectory, entry.name),
      ),
    ),
  );

  const configPath = path.join(
    outputDirectory,
    "assets",
    "js",
    "api",
    "config.js",
  );
  const apiBaseUrl = publicBuildValue(
    "SHOPWISE_API_BASE_URL",
    defaultProductionApi,
  ).replace(/\/$/u, "");
  const stripePublishableKey = publicBuildValue("STRIPE_PUBLISHABLE_KEY");
  const source = await readFile(configPath, "utf8");
  const configuredSource = source
    .replace("__SHOPWISE_API_BASE_URL__", apiBaseUrl)
    .replace("__STRIPE_PUBLISHABLE_KEY__", stripePublishableKey);

  await writeFile(configPath, configuredSource, "utf8");
  console.log(`Frontend built in ${outputDirectory}`);
  console.log(`API: ${apiBaseUrl}`);
  console.log(
    `Stripe: ${stripePublishableKey ? "publishable key configured" : "not configured"}`,
  );
  console.log(`Google verification files: ${googleVerificationFiles.length}`);
}

buildFrontend().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
