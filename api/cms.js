const { authenticate, github, repository, branch, safePagePath } = require("./_cms-utils");

function send(res, status, body) {
  res.status(status).json(body);
}

module.exports = async function handler(req, res) {
  try {
    if (!authenticate(req)) return send(res, 401, { error: "Invalid CMS access token" });
    const repo = repository();

    if (req.method === "GET" && req.query.action === "list") {
      const tree = await github(`/repos/${repo}/git/trees/${encodeURIComponent(branch())}?recursive=1`);
      const pages = tree.tree
        .filter((item) => item.type === "blob" && /^(?!admin\/)(?!api\/)[a-z0-9][a-z0-9-]*\.html$/.test(item.path))
        .map((item) => item.path)
        .sort((a, b) => a.localeCompare(b));
      return send(res, 200, { pages });
    }

    if (req.method === "GET" && req.query.action === "read") {
      const path = safePagePath(req.query.path);
      const file = await github(`/repos/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch())}`);
      return send(res, 200, {
        path,
        sha: file.sha,
        content: Buffer.from(file.content, "base64").toString("utf8"),
        url: file.html_url,
      });
    }

    if (req.method === "POST" && req.body?.action === "save") {
      const path = safePagePath(req.body.path);
      if (typeof req.body.content !== "string" || !req.body.content.includes("<!DOCTYPE html>")) {
        return send(res, 400, { error: "The submitted page is not valid HTML" });
      }
      if (!/^[a-f0-9]{40}$/.test(req.body.sha || "")) return send(res, 400, { error: "Missing file version" });
      const company = path.replace(/\.html$/, "").replace(/-/g, " ");
      const result = await github(`/repos/${repo}/contents/${encodeURIComponent(path)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `CMS: update ${company}`,
          content: Buffer.from(req.body.content, "utf8").toString("base64"),
          sha: req.body.sha,
          branch: branch(),
        }),
      });
      return send(res, 200, { sha: result.content.sha, commit: result.commit.html_url });
    }

    return send(res, 405, { error: "Unsupported CMS action" });
  } catch (error) {
    return send(res, 500, { error: error.message || "CMS request failed" });
  }
};
