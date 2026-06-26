#!/usr/bin/env bash
set -euo pipefail

VERSION_FILE="VERSION"
PACKAGE_JSON="package.json"
BACKEND_PACKAGE_JSON="backend/package.json"
FRONTEND_PACKAGE_JSON="frontend/package.json"

log() {
  echo "[version] $(date '+%Y-%m-%d %H:%M:%S') $*" >&2
}

get_current_version() {
  if [ -f "$VERSION_FILE" ]; then
    cat "$VERSION_FILE"
  else
    grep '"version"' "$PACKAGE_JSON" | head -1 | sed 's/.*"version": "\(.*\)".*/\1/'
  fi
}

bump() {
  local part=$1
  local version
  version=$(get_current_version)

  IFS='.' read -r major minor patch <<< "$version"

  case "$part" in
    major)
      major=$((major + 1))
      minor=0
      patch=0
      ;;
    minor)
      minor=$((minor + 1))
      patch=0
      ;;
    patch)
      patch=$((patch + 1))
      ;;
    *)
      echo "Usage: $0 bump {major|minor|patch}" >&2
      exit 1
      ;;
  esac

  local new_version="$major.$minor.$patch"

  echo "$new_version" > "$VERSION_FILE"

  for pkg in "$PACKAGE_JSON" "$BACKEND_PACKAGE_JSON" "$FRONTEND_PACKAGE_JSON"; do
    if [ -f "$pkg" ]; then
      sed -i "s/\"version\": \".*\"/\"version\": \"$new_version\"/" "$pkg"
    fi
  done

  log "Version bumped: $version -> $new_version"
  echo "$new_version"
}

tag() {
  local version
  version=$(get_current_version)
  local tag="v$version"

  if git rev-parse "$tag" >/dev/null 2>&1; then
    error "Tag $tag already exists"
  fi

  git add "$VERSION_FILE" "$PACKAGE_JSON" "$BACKEND_PACKAGE_JSON" "$FRONTEND_PACKAGE_JSON" 2>/dev/null || true
  git commit -m "chore: bump version to $version"

  git tag -a "$tag" -m "Release $version"
  log "Created tag: $tag"

  echo "$tag"
}

show() {
  local version
  version=$(get_current_version)
  local sha
  sha=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
  local date
  date=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

  echo "Version: $version"
  echo "Commit:  $sha"
  echo "Date:    $date"
}

case "${1:-show}" in
  show)
    show
    ;;
  bump)
    bump "${2:-patch}"
    ;;
  tag)
    tag
    ;;
  *)
    echo "Usage: $0 {show|bump <major|minor|patch>|tag}" >&2
    exit 1
    ;;
esac
