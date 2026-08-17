#!/bin/bash
# version.sh - Automates the version bump, commit, tag, and push workflow

# 1. Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "Current version is: v$CURRENT_VERSION"
echo "----------------------------------------"

# 2. Ask for new version
read -p "Enter new version (e.g., 1.1.0): " NEW_VERSION
if [[ -z "$NEW_VERSION" ]]; then
  echo "❌ Version cannot be empty. Aborting."
  exit 1
fi

# 3. Ask for commit message
read -p "Enter commit message (e.g., 'feat(P1.S1): type system'): " COMMIT_MSG
if [[ -z "$COMMIT_MSG" ]]; then
  echo "❌ Commit message cannot be empty. Aborting."
  exit 1
fi

echo "----------------------------------------"
echo "🚀 Bumping version to $NEW_VERSION..."
npm version "$NEW_VERSION" --no-git-tag-version

echo "📦 Committing and tagging..."
git add .
git commit -m "$COMMIT_MSG"
git tag "v$NEW_VERSION"

echo "☁️  Pushing commit to main..."
git push origin main

echo "🏷️  Pushing tag v$NEW_VERSION..."
git push origin "v$NEW_VERSION"

echo "✅ Successfully released v$NEW_VERSION and pushed to GitHub!"
