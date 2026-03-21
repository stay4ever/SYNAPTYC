#!/bin/bash
# nano-SYNAPSYS Git Recovery Script
# Run this on your Mac to restore the corrupted repository
# Usage: chmod +x recover_repo.sh && ./recover_repo.sh

set -e

echo "=== nano-SYNAPSYS Git Recovery ==="
echo ""

BACKUP_DIR="../nanoSYNAPSYS-backup-$(date +%Y%m%d-%H%M%S)"
FRESH_DIR="../nanoSYNAPSYS-fresh"

# Step 1: Back up current state
echo "[1/5] Backing up current working directory..."
cp -r . "$BACKUP_DIR"
echo "  Backup saved to: $BACKUP_DIR"

# Step 2: Clone fresh from origin
echo "[2/5] Cloning fresh from GitHub..."
git clone https://github.com/stay4ever/SYNAPTYC.git "$FRESH_DIR"
echo "  Fresh clone at: $FRESH_DIR"

# Step 3: Copy over the fixed files from current repo
echo "[3/5] Copying fixed pbxproj, CLAUDE.md, and .gitignore..."
cp nano-SYNAPSYS.xcodeproj/project.pbxproj "$FRESH_DIR/nano-SYNAPSYS.xcodeproj/project.pbxproj"
cp CLAUDE.md "$FRESH_DIR/CLAUDE.md"
cp .gitignore "$FRESH_DIR/.gitignore"

# Step 4: Copy Expo/RN files that may not be in main branch
echo "[4/5] Copying Expo/React Native files (if not already present)..."
for f in App.js app.json eas.json package.json package-lock.json; do
    if [ -f "$f" ] && [ ! -f "$FRESH_DIR/$f" ]; then
        cp "$f" "$FRESH_DIR/$f"
        echo "  Copied: $f"
    fi
done

# Copy directories
for d in src assets maestro ios; do
    if [ -d "$d" ] && [ ! -d "$FRESH_DIR/$d" ]; then
        cp -r "$d" "$FRESH_DIR/$d"
        echo "  Copied directory: $d/"
    fi
done

# Step 5: Verify
echo "[5/5] Verifying restored repository..."
cd "$FRESH_DIR"
echo "  Swift sources:"
ls -d nano-SYNAPSYS/ 2>/dev/null && echo "    OK" || echo "    MISSING!"
echo "  Tests:"
ls -d nano-SYNAPSYSTests/ 2>/dev/null && echo "    OK" || echo "    MISSING!"
echo "  CI/CD:"
ls -d .github/workflows/ 2>/dev/null && echo "    OK" || echo "    MISSING!"
echo "  Fastlane:"
ls -d fastlane/ 2>/dev/null && echo "    OK" || echo "    MISSING!"
echo "  Backend:"
ls -d backend/ 2>/dev/null && echo "    OK" || echo "    MISSING!"
echo ""
echo "  Git status:"
git status --short | head -20
echo ""
echo "=== Recovery complete ==="
echo "Fresh repo is at: $FRESH_DIR"
echo "Your backup is at: $BACKUP_DIR"
echo ""
echo "Next steps:"
echo "  1. cd $FRESH_DIR"
echo "  2. Review git status and commit the fixes"
echo "  3. Set your DEVELOPMENT_TEAM in Xcode: open nano-SYNAPSYS.xcodeproj"
echo "     Go to Signing & Capabilities > select your team"
echo "  4. Archive and submit to TestFlight"
