# Release Setup Guide

This document explains how to set up automated releases to the public repository `NubeIO/ZC-NubeiO-Toolkit-Release`.

## Overview

The project uses GitHub Actions to automatically build and release the Nube iO Toolkit to a public repository when tags are pushed. This keeps the main development repository private while making releases publicly available.

## Required Setup

### 1. Create a Personal Access Token (PAT)

You need a GitHub Personal Access Token with permissions to create releases in the public repository.

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give it a descriptive name like "ZC-NubeiO-Toolkit Release Token"
4. Set expiration (or choose "No expiration" for permanent token)
5. Select the following scopes:
   - ✅ `repo` (Full control of private repositories)
     - ✅ `repo:status`
     - ✅ `repo_deployment`
     - ✅ `public_repo` (Access public repositories)
     - ✅ `repo:invite`
   - ✅ `write:packages` (if you plan to publish packages)
6. Click "Generate token"
7. **Copy the token immediately** (you won't be able to see it again!)

### 2. Add the Token to Repository Secrets

1. Go to your **private** repository: `NubeIO/ZC-NubeiO-Toolkit`
2. Navigate to Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Name: `PUBLIC_REPO_TOKEN`
5. Value: Paste the Personal Access Token you created
6. Click "Add secret"

### 3. Verify Public Repository Exists

Make sure the public repository exists:
- Repository: `NubeIO/ZC-NubeiO-Toolkit-Release`
- Visibility: Public
- Settings: Ensure "Issues" is enabled if you want users to report bugs

## How It Works

### Automatic Releases (Recommended)

When you push a version tag to the repository, the workflow automatically:

1. Builds the application for Windows and Linux
2. Creates a release with generated release notes
3. Uploads the built artifacts
4. Publishes the release to **both**:
   - The private repository (for internal tracking)
   - The public repository `NubeIO/ZC-NubeiO-Toolkit-Release`

**Example:**
```bash
# Create and push a version tag
git tag v1.0.0
git push origin v1.0.0
```

### Manual Releases

You can also trigger releases manually:

1. Go to Actions → "Build Electron App" workflow
2. Click "Run workflow"
3. Fill in the parameters:
   - **Platform**: Choose `all`, `windows`, or `linux`
   - **Create GitHub Release**: ✅ Enable
   - **Release tag**: Enter version (e.g., `v1.0.0`)
4. Click "Run workflow"

## Workflow Files

### `main.yml`
The main workflow that:
- Builds for both Windows and Linux
- Creates releases in **both** repositories (private and public)
- Triggered by tags matching `v*.*.*` or manual dispatch

### `release-public.yml`
A dedicated workflow for public releases:
- Can be used for independent public releases
- Same build process as main.yml
- Only publishes to the public repository

## Release Notes

Release notes are automatically generated from:
- Git commits since the previous tag
- Pre-defined feature list
- Build information
- Installation instructions

The release notes include:
- 📝 Changelog with commit history
- 📦 Download links and instructions
- ✨ Feature highlights
- 🛠️ System requirements
- ℹ️ Build metadata

## Troubleshooting

### Error: "Context access might be invalid: PUBLIC_REPO_TOKEN"

This is a warning from GitHub Actions validation. It's safe to ignore - the token will be available at runtime when the workflow runs.

### Release Not Created in Public Repository

**Check:**
1. Is `PUBLIC_REPO_TOKEN` secret set correctly?
2. Does the token have `public_repo` permission?
3. Does the public repository exist?
4. Is the token still valid (not expired)?

**Fix:**
- Verify the secret exists: Settings → Secrets and variables → Actions
- Re-generate the PAT if expired
- Check workflow run logs for specific error messages

### Build Fails

**Common issues:**
- Node.js version mismatch: Workflow uses Node.js 18
- Dependencies not installing: Check `package-lock.json` is committed
- Build script errors: Test locally with `npm run build:win` or `npm run build:linux`

### Artifacts Not Uploaded

**Check:**
- Build completed successfully
- Artifacts exist in expected paths:
  - Windows: `electron-app/dist/*.exe`
  - Linux: `electron-app/dist/*.AppImage` and `electron-app/dist/*.deb`

## Best Practices

### Version Tags

Use semantic versioning:
- `v1.0.0` - Major release
- `v1.1.0` - Minor release (new features)
- `v1.1.1` - Patch release (bug fixes)
- `v1.0.0-beta.1` - Pre-release

### Release Checklist

Before creating a release:

- [ ] Update version in `electron-app/package.json`
- [ ] Update CHANGELOG.md (if you maintain one)
- [ ] Test the build locally
- [ ] Commit all changes
- [ ] Create and push the tag
- [ ] Verify workflow runs successfully
- [ ] Check release appears in public repository
- [ ] Test download and installation from public release

### Pre-releases

For beta or RC versions:
1. Use workflow dispatch (manual trigger)
2. Tag with pre-release suffix: `v1.0.0-beta.1`
3. Enable "Mark as pre-release" option

## Security Notes

### Token Security

⚠️ **Important:**
- Never commit the PAT token to the repository
- Use GitHub Secrets to store sensitive tokens
- Rotate tokens periodically
- Use minimal required permissions

### Public Repository

Remember that the public repository:
- Shows release notes and changelogs
- Contains downloadable binaries
- May receive issues from users
- Does **not** expose source code (only releases)

## Monitoring Releases

### Check Release Status

1. **Private repo**: `https://github.com/NubeIO/ZC-NubeiO-Toolkit/releases`
2. **Public repo**: `https://github.com/NubeIO/ZC-NubeiO-Toolkit-Release/releases`

### Workflow Runs

Monitor workflow execution:
1. Go to Actions tab
2. Select "Build Electron App" workflow
3. View recent runs and their status
4. Check logs for any errors

## Support

For issues with:
- **Workflow/CI**: Contact repository maintainers
- **Application bugs**: Check private repository issues
- **User support**: Direct users to public repository issues
