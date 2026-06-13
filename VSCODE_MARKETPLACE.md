# Medullo — VS Code Marketplace Publish Pack

Parallel to [CHROME_WEBSTORE.md](CHROME_WEBSTORE.md), but for the VS Code
Marketplace. Free, faster review than Chrome (usually same-day).

Source of truth for the marketplace listing is
[vscode-extension/README.md](vscode-extension/README.md). When you run
`vsce package`, the README content becomes the listing page on the
marketplace — so the polish lives in that file, not here.

---

## 0 · One-time setup

You need a **Publisher** identity on Azure DevOps. Free, but a few clicks.

1. Go to [dev.azure.com](https://dev.azure.com/) and sign in with the
   Microsoft account you want to publish under.
2. Create an organization (any name — used internally).
3. From your user settings (top right), pick **Personal access tokens →
   New Token**. Scope: **Organization → All accessible organizations**,
   permission: **Marketplace → Manage**. Copy the token — you'll only see
   it once.
4. Create the publisher profile at
   [marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage).
   The **Publisher ID** you choose here must match the `publisher` field
   in [vscode-extension/package.json](vscode-extension/package.json) (it's
   currently set to `medullo` — change to whatever you registered if
   different).

---

## 1 · Verify the package

```bash
cd vscode-extension
npm install -g @vscode/vsce      # one-time
vsce package
```

You'll see something like:

```
DONE  Packaged: …/medullo-vscode-0.1.0.vsix (X files, Y KB)
```

**Inspect what got bundled** before publishing — the `.vscodeignore` file
controls this, but worth a sanity check:

```bash
unzip -l medullo-vscode-0.1.0.vsix
```

Confirm presence of: `extension.js`, `package.json`, `README.md`,
`icon.png`, `LICENSE`. Confirm absence of: `node_modules`, any `.vsix`
from previous builds, source maps.

Also confirm `package.json` contributes both settings:
`medullo.backendUrl` and `medullo.accessToken`.

---

## 2 · Authenticate

```bash
vsce login medullo
# (replace `medullo` with your Publisher ID if different)
# Paste the Personal Access Token from step 0
```

The token is cached locally — subsequent `vsce publish` runs won't prompt
again unless you log out.

---

## 3 · Publish

```bash
vsce publish
```

That's the whole flow. `vsce` reads the `.vsix`, validates it, and uploads.

A few seconds later the extension goes live at:

```
https://marketplace.visualstudio.com/items?itemName=medullo.medullo-vscode
```

Replace `medullo` with your Publisher ID if different.

---

## 4 · After publish

- The marketplace listing pulls the README.md content directly — anything
  there is what users see. Edit
  [vscode-extension/README.md](vscode-extension/README.md), bump the
  version in `package.json`, and `vsce publish` again to update.
- Install statistics show up in your publisher dashboard a few hours
  later.
- The "Get Started" / "Repository" / "Bug" links on the marketplace page
  pull from the matching fields in `package.json` — those are already set
  to the GitHub URLs.

---

## 5 · Update workflow

Every time you publish a new version:

```bash
cd vscode-extension
# Bump version in package.json (manual or via vsce)
vsce publish patch        # 0.1.0 → 0.1.1
# or
vsce publish minor        # 0.1.0 → 0.2.0
# or
vsce publish 0.2.0        # explicit
```

`vsce publish patch` is the most common — auto-bumps, repackages,
uploads, and commits the version bump to git if you're in a clean repo.

---

## 6 · While you wait

Review is usually instant for a verified Publisher (it can take an hour
the first time). Until your listing is live, the local `.vsix` install
path still works for judges:

```bash
# From the repo:
cd vscode-extension
vsce package
# Then in VS Code: Extensions → ⋯ → Install from VSIX → pick the file
```

This is also the right fallback if your hackathon deadline hits before
publish completes.
