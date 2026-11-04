#!/usr/bin/env sh
# SCREENSHOT TOOLING ONLY. Builds a throwaway copy of the mobile app that runs in a browser:
#   sh prepare-mobile.sh <worktree-dir> [branch]
# 1. a detached git worktree of <branch> (default: the current branch) in <worktree-dir>
# 2. its own node_modules + react-dom/react-native-web (the app itself does not ship web support)
# 3. metro.config.js + mocks (camera, GPS, secure storage, image resize)
# 4. lifts the root layout's "phone only" web gate IN THAT COPY ONLY
# Nothing here touches Mobile/. Remove the copy afterwards with: git worktree remove --force <worktree-dir>
set -e
DIR="$1"; BRANCH="${2:-HEAD}"
HERE="$(cd "$(dirname "$0")" && pwd)"
git worktree add --detach "$DIR" "$BRANCH"
cd "$DIR/Mobile"
npm ci --no-audit --no-fund
npx expo install react-dom react-native-web
cp "$HERE/metro.config.js" metro.config.js
mkdir -p screenshot-mocks && cp "$HERE"/mocks/*.js screenshot-mocks/
sed -i "s/if (Platform.OS === 'web') {/if (false) {/" src/app/_layout.tsx
echo "ready: cd $DIR/Mobile && EXPO_PUBLIC_API_URL=http://localhost:4100 npx expo start --web --port 8095"
