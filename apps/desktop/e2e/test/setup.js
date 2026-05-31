import { spawn, spawnSync } from "child_process";
import os from "os";
import path from "path";
import { Builder, Capabilities } from "selenium-webdriver";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Path to the Tauri application binary (debug build)
const application = path.resolve(
  __dirname,
  "..",
  "..",
  "src-tauri",
  "target",
  "debug",
  "backstage.exe"
);

// WebDriver instance
let driver = null;

// tauri-driver process
let tauriDriver = null;
let exitingCleanly = false;

/**
 * Build the Tauri app in debug mode (if not already built)
 */
export function buildApp() {
  console.log("Building Tauri app in debug mode...");
  const result = spawnSync(
    "bun",
    ["run", "tauri", "build", "--debug", "--no-bundle"],
    {
      cwd: path.resolve(__dirname, "../.."),
      stdio: "inherit",
      shell: true,
    }
  );

  if (result.status !== 0) {
    throw new Error(`Failed to build Tauri app. Exit code: ${result.status}`);
  }
  console.log("Build complete.");
}

/**
 * Start the tauri-driver process
 */
export function startTauriDriver() {
  console.log("Starting tauri-driver...");

  const tauriDriverPath = path.resolve(
    os.homedir(),
    ".cargo",
    "bin",
    "tauri-driver.exe"
  );
  // msedgedriver.exe is in global cargo bin directory (reusable across projects)
  const msEdgeDriverPath = path.resolve(
    os.homedir(),
    ".cargo",
    "bin",
    "msedgedriver.exe"
  );

  tauriDriver = spawn(tauriDriverPath, ["--native-driver", msEdgeDriverPath], {
    stdio: [null, process.stdout, process.stderr],
  });

  tauriDriver.on("error", (error) => {
    console.error("tauri-driver error:", error);
    if (!exitingCleanly) {
      process.exit(1);
    }
  });

  tauriDriver.on("exit", (code) => {
    if (!exitingCleanly) {
      console.error("tauri-driver exited unexpectedly with code:", code);
      process.exit(1);
    }
  });

  // Give tauri-driver time to start
  return new Promise((resolve) => setTimeout(resolve, 2000));
}

/**
 * Create and connect the Selenium WebDriver
 */
export async function createDriver() {
  console.log("Connecting WebDriver to Tauri app...");

  const capabilities = new Capabilities();
  capabilities.set("tauri:options", { application });
  capabilities.setBrowserName("wry");

  driver = await new Builder()
    .withCapabilities(capabilities)
    .usingServer("http://127.0.0.1:4444/")
    .build();

  console.log("WebDriver connected.");
  return driver;
}

/**
 * Get the current WebDriver instance
 */
export function getDriver() {
  return driver;
}

/**
 * Clean up: close the driver and kill tauri-driver
 */
export async function cleanup() {
  exitingCleanly = true;

  if (driver) {
    try {
      await driver.quit();
      console.log("WebDriver closed.");
    } catch (error) {
      console.error("Error closing WebDriver:", error.message);
    }
    driver = null;
  }

  if (tauriDriver) {
    tauriDriver.kill();
    console.log("tauri-driver stopped.");
    tauriDriver = null;
  }
}

/**
 * Initialize everything for testing
 */
export async function initialize() {
  buildApp();
  await startTauriDriver();
  await createDriver();
}

// Handle process shutdown gracefully
function setupShutdownHandlers() {
  const shutdownHandler = async () => {
    await cleanup();
    process.exit();
  };

  process.on("SIGINT", shutdownHandler);
  process.on("SIGTERM", shutdownHandler);
  process.on("SIGHUP", shutdownHandler);
}

setupShutdownHandlers();
