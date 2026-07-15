# Delivery Pods

## Pod Pages CMS

The private editor is available at `/admin/`. It edits the existing HTML pages,
shows a live preview, uses OpenAI to propose copy changes, and publishes approved
changes to GitHub so Vercel can deploy them.

Configure these environment variables in Vercel:

- `CMS_ACCESS_TOKEN` — a long private password shared with approved editors
- `GITHUB_TOKEN` — a fine-grained token with Contents read/write access to this repository
- `GITHUB_REPO` — repository in `owner/repository` format
- `GITHUB_BRANCH` — deployment branch (optional; defaults to `main`)
- `OPENAI_API_KEY` — server-side OpenAI API key
- `OPENAI_CMS_MODEL` — optional model override (defaults to `gpt-5.4-mini`)

The API key and GitHub token are only used by server-side functions and are never
sent to the browser. Each publish creates a GitHub commit and therefore retains a
full audit trail and rollback history.
