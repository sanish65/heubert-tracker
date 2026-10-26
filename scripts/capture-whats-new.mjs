// Screenshots for the What's new tour: every feature in whats-new/content.json, as the web app
// (localhost:3000, so `npm run dev` must be running) and as the mobile app (its web build, in a
// phone-sized window). Saved to whats-new/shots/{web,mobile}/<id>.webp, which /api/whats-new
// serves to signed-in employees only, since the screens show real team data.
//
//   npm run whats-new:shots                      every feature, both apps
//   npm run whats-new:shots -- --only=tasks,meeting --platform=web
//   npm run whats-new:shots -- --as=someone@heubert.com
//
// It signs in as --as (default sanish@heubert.com, an admin, so admin-only screens are
// captured) with a one-time magic link made with the service-role key; nothing is emailed.
// A screen whose data is slow (the calendar asks Google) sets "wait" (ms) in content.json.

import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, readFileSync, existsSync, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "package.json"));
require("@next/env").loadEnvConfig(root, true, { info() {}, error() {} });
const { createClient } = require("@supabase/supabase-js");
const puppeteer = require("puppeteer-core");

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v = "true"] = a.replace(/^--/, "").split("=");
    return [k, v];
  })
);
const only = args.only ? new Set(args.only.split(",")) : null;
const platforms = args.platform ? [args.platform] : ["web", "mobile"];
const email = args.as || "sanish@heubert.com";
const webBase = (args.web || "http://localhost:3000").replace(/\/+$/, "");
const chrome = args.chrome || "/usr/bin/google-chrome";
const SETTLE_MS = 2500;

// --content=<file> captures another list of screens (to check one), into the same folders.
const content = JSON.parse(readFileSync(args.content || path.join(root, "whats-new/content.json"), "utf8"));
const features = content.features.filter((f) => !only || only.has(f.id));

async function signIn() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw new Error(`Couldn't make a sign-in link for ${email}: ${error.message}`);
  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data: verified, error: verifyError } = await anon.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: "magiclink",
  });
  if (verifyError || !verified.session) throw new Error(`Couldn't sign in as ${email}: ${verifyError?.message}`);
  const storageKey = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
  return { storageKey, session: JSON.stringify(verified.session) };
}

// The mobile app's web build, served with every unknown path falling back to index.html. It is
// built to call its own origin for /api/*, which is passed on to the local web app: a browser
// won't let localhost call the production API, and the screens should show what the code does.
function buildMobile() {
  const out = mkdtempSync(path.join(tmpdir(), "whats-new-mobile-"));
  const port = Number(args["mobile-port"] || 8765);
  console.log("Building the mobile app for web…");
  execFileSync("npx", ["expo", "export", "--platform", "web", "--clear", "--output-dir", out], {
    cwd: path.join(root, "mobile"),
    stdio: ["ignore", "ignore", "inherit"],
    env: { ...process.env, EXPO_PUBLIC_API_BASE_URL: `http://localhost:${port}` },
  });
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".ttf": "font/ttf", ".svg": "image/svg+xml" };
  const server = createServer(async (req, res) => {
    if (req.url.startsWith("/api/")) {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const headers = { ...req.headers };
      delete headers.host;
      const upstream = await fetch(`${webBase}${req.url}`, {
        method: req.method,
        headers,
        body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks),
      }).catch(() => null);
      if (!upstream) {
        res.writeHead(502);
        res.end();
        return;
      }
      res.writeHead(upstream.status, { "Content-Type": upstream.headers.get("content-type") || "application/octet-stream" });
      res.end(Buffer.from(await upstream.arrayBuffer()));
      return;
    }
    const clean = decodeURIComponent(req.url.split("?")[0]);
    let file = path.join(out, clean);
    if (!file.startsWith(out) || !existsSync(file) || statSync(file).isDirectory()) file = path.join(out, "index.html");
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    res.end(readFileSync(file));
  });
  return new Promise((resolve) => server.listen(port, () => resolve({ server, out, base: `http://localhost:${port}` })));
}

async function shoot(browser, { base, auth, viewport, target, extraStorage, wait, file }) {
  const page = await browser.newPage();
  if (args.debug) {
    page.on("pageerror", (err) => console.log(`  page error: ${err.message}`));
    page.on("console", (msg) => msg.type() === "error" && console.log(`  console: ${msg.text().slice(0, 300)}`));
    page.on("requestfailed", (r) => console.log(`  failed: ${r.url().slice(0, 120)} ${r.failure()?.errorText}`));
    page.on("response", (r) => r.status() >= 400 && console.log(`  ${r.status()}: ${r.url().slice(0, 120)}`));
  }
  await page.setViewport(viewport);
  // Sign in (and pick the tab) before the app's own scripts run.
  await page.evaluateOnNewDocument(
    (entries) => entries.forEach(([k, v]) => localStorage.setItem(k, v)),
    [[auth.storageKey, auth.session], ...Object.entries(extraStorage || {})]
  );
  await page.goto(`${base}${target}`, { waitUntil: "networkidle2", timeout: 60000 });
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  await new Promise((r) => setTimeout(r, wait || SETTLE_MS));
  await page.screenshot({ path: file, type: "webp", quality: 80 });
  await page.close();
}

const auth = await signIn();
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--hide-scrollbars"] });
const failures = [];
let mobile = null;

try {
  for (const platform of platforms) {
    const dir = path.join(root, "whats-new/shots", platform);
    mkdirSync(dir, { recursive: true });
    if (platform === "mobile") mobile = await buildMobile();
    for (const f of features) {
      const spec = f[platform];
      if (!spec) continue;
      const file = path.join(dir, `${f.id}.webp`);
      try {
        if (platform === "web") {
          await shoot(browser, {
            base: webBase,
            auth,
            viewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
            target: spec.path || "/",
            extraStorage: spec.tab ? { "heubert-active-tab": spec.tab } : null,
            wait: spec.wait,
            file,
          });
        } else {
          await shoot(browser, {
            base: mobile.base,
            auth,
            viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
            target: spec.path,
            wait: spec.wait,
            file,
          });
        }
        console.log(`✓ ${platform} ${f.id}`);
      } catch (err) {
        failures.push(`${platform} ${f.id}: ${err.message}`);
        console.log(`✗ ${platform} ${f.id}: ${err.message}`);
      }
    }
  }
} finally {
  await browser.close();
  if (mobile) {
    mobile.server.close();
    rmSync(mobile.out, { recursive: true, force: true });
  }
}

if (failures.length) {
  console.log(`\n${failures.length} screen(s) not captured.`);
  process.exitCode = 1;
}
