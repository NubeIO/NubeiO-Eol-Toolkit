# Creating a Release

This guide explains how to create a new release of Nube iO Toolkit.

## Quick Start

To create a release, simply push a version tag:

```bash
# Create a version tag
git tag v1.0.0

# Push the tag to trigger the release workflow
git push origin v1.0.0
```

That's it! The automated workflow will:
- ✅ Build for Windows and Linux
- ✅ Generate release notes from commits
- ✅ Create releases in both private and public repositories
- ✅ Upload all build artifacts

## Detailed Steps

### 1. Prepare Your Release

Before creating a release tag:

```bash
# Make sure you're on the main/electron branch
git checkout electron

# Pull latest changes
git pull origin electron

# Verify everything is working
cd electron-app
npm install
npm run build:linux  # or build:win on Windows
```

### 2. Update Version (Optional)

The workflow automatically updates the version in `package.json`, but you can do it manually:

```bash
cd electron-app
npm version 1.0.0 --no-git-tag-version
git add package.json
git commit -m "Bump version to 1.0.0"
git push origin electron
```

### 3. Create and Push Tag

```bash
# Create a tag (use semantic versioning)
git tag v1.0.0

# Or create an annotated tag with a message
git tag -a v1.0.0 -m "Release version 1.0.0"

# Push the tag (this triggers the workflow)
git push origin v1.0.0
```

### 4. Monitor the Workflow

1. Go to [Actions](https://github.com/NubeIO/ZC-NubeiO-Toolkit/actions)
2. Find the "Build Electron App" workflow run
3. Monitor the progress:
   - Build Windows (5-10 minutes)
   - Build Linux (5-10 minutes)
   - Create Release (1-2 minutes)

### 5. Verify the Release

Check that releases were created:

**Private Repository:**
- https://github.com/NubeIO/ZC-NubeiO-Toolkit/releases

**Public Repository:**
- https://github.com/NubeIO/ZC-NubeiO-Toolkit-Release/releases

## Version Naming

Use [Semantic Versioning](https://semver.org/):

### Standard Releases

```bash
v1.0.0    # Major release (breaking changes)
v1.1.0    # Minor release (new features, backward compatible)
v1.1.1    # Patch release (bug fixes)
```

### Pre-releases

```bash
v1.0.0-alpha.1    # Alpha release
v1.0.0-beta.1     # Beta release
v1.0.0-rc.1       # Release candidate
```

## Manual Release (Alternative Method)

If you prefer manual control:

### Using GitHub Web UI

1. Go to [Actions](https://github.com/NubeIO/ZC-NubeiO-Toolkit/actions)
2. Select "Build Electron App" workflow
3. Click "Run workflow" button
4. Fill in the parameters:
   - **Branch**: `electron`
   - **Platform**: `all` (or specific platform)
   - **Create GitHub Release**: ✅ Checked
   - **Release tag**: `v1.0.0`
5. Click "Run workflow"

### Using GitHub CLI

```bash
# Install GitHub CLI if not already installed
# https://cli.github.com/

# Trigger workflow with parameters
gh workflow run "Build Electron App" \
  --ref electron \
  -f platform=all \
  -f create_release=true \
  -f release_tag=v1.0.0
```

## What Gets Released

Each release includes:

### Windows Build
- `Nube_iO_Toolkit-Setup-{version}.exe` - Full installer

### Linux Builds
- `Nube_iO_Toolkit-{version}.AppImage` - Portable application
- `nube-io-toolkit_{version}_amd64.deb` - Debian package

### Generated Content
- Release notes with:
  - Changelog (from git commits)
  - Feature list
  - Installation instructions
  - System requirements
  - Build metadata

## Common Workflows

### Bug Fix Release

```bash
# Fix the bug
git checkout electron
git pull origin electron

# Make your changes
# ... edit files ...

# Commit and push
git add .
git commit -m "Fix: Description of bug fix"
git push origin electron

# Create patch release
git tag v1.0.1
git push origin v1.0.1
```

### Feature Release

```bash
# Develop feature
git checkout -b feature/new-feature electron
# ... develop ...
git commit -m "Add: New feature description"
git push origin feature/new-feature

# Create PR and merge to electron
# ... merge PR ...

# Create minor release
git checkout electron
git pull origin electron
git tag v1.1.0
git push origin v1.1.0
```

### Pre-release Testing

```bash
# Create a pre-release tag
git tag v1.0.0-beta.1
git push origin v1.0.0-beta.1

# Or use manual workflow with prerelease option
gh workflow run "release-public.yml" \
  -f release_tag=v1.0.0-beta.1 \
  -f prerelease=true
```

## Troubleshooting

### Release Failed to Create

**Check the workflow logs:**
1. Go to Actions → Select failed run
2. Check each job's logs
3. Common issues:
   - Build errors (missing dependencies)
   - Token permissions (check `PUBLIC_REPO_TOKEN` secret)
   - Network issues (retry the workflow)

### Wrong Version in Release

If the version in `package.json` doesn't match your tag:
1. The workflow uses the tag version, not package.json
2. The workflow will update package.json during build
3. No action needed unless you want them in sync before tagging

### Deleting a Release

**To delete and recreate a release:**

```bash
# Delete the tag locally
git tag -d v1.0.0

# Delete the tag remotely
git push --delete origin v1.0.0

# Delete the releases from GitHub UI
# Go to releases → Click the release → Delete

# Create the tag again
git tag v1.0.0
git push origin v1.0.0
```

### Release Not Appearing in Public Repo

**Verify:**
1. `PUBLIC_REPO_TOKEN` secret is set correctly
2. Token has `public_repo` permission
3. Public repository exists: `NubeIO/ZC-NubeiO-Toolkit-Release`
4. Check workflow logs for error messages

**Fix:**
- Re-run the workflow from Actions tab
- Check `.github/RELEASE_SETUP.md` for token setup

## Release Checklist

Before creating a production release:

- [ ] All tests pass locally
- [ ] Documentation is updated
- [ ] CHANGELOG.md updated (if you maintain one)
- [ ] Version number follows semantic versioning
- [ ] All PRs merged to electron branch
- [ ] Local build successful
- [ ] Branch is clean (`git status`)
- [ ] Changes pushed to remote
- [ ] Tag created with correct version
- [ ] Tag pushed to remote
- [ ] Workflow started successfully
- [ ] All builds completed
- [ ] Release created in private repo
- [ ] Release created in public repo
- [ ] Artifacts uploaded successfully
- [ ] Release notes look correct
- [ ] Downloads tested on target platforms

## Tips

### View Recent Tags

```bash
# List all tags
git tag

# List tags sorted by version
git tag --sort=-version:refname

# List tags with messages
git tag -n
```

### Update Local Tags

```bash
# Fetch all tags from remote
git fetch --tags

# Prune deleted remote tags
git fetch --prune --prune-tags
```

### Dry Run Before Release

Test the build locally before creating a tag:

```bash
cd electron-app

# Install dependencies
npm ci

# Build for your platform
npm run build:linux  # or build:win

# Check the dist/ folder
ls -lh dist/
```

## Support

- **Workflow Setup**: See `.github/RELEASE_SETUP.md`
- **Build Issues**: Check `electron-app/README.md`
- **General Help**: Contact repository maintainers
