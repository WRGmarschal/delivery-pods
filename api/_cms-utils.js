const GITHUB_API = "https://api.github.com";

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function authenticate(req) {
  const expected = env("CMS_ACCESS_TOKEN");
  const received = req.headers["x-cms-token"] || "";
  if (received.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ received.charCodeAt(i);
  return mismatch === 0;
}

async function github(path, options = {}) {
  const response = await fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${env("GITHUB_TOKEN")}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "white-rabbit-pod-cms",
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `GitHub request failed (${response.status})`);
  return data;
}

function repository() {
  const repo = env("GITHUB_REPO");
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error("GITHUB_REPO must look like owner/repository");
  return repo;
}

function branch() {
  return process.env.GITHUB_BRANCH || "main";
}

function safePagePath(value) {
  const path = String(value || "");
  if (!/^(?!admin\/)(?!api\/)[a-z0-9][a-z0-9-]*\.html$/.test(path)) {
    throw new Error("Invalid pod page path");
  }
  return path;
}

module.exports = { authenticate, github, repository, branch, safePagePath };
