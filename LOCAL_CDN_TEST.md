# Local CDN Testing Guide

This guide walks through testing the CDN feature locally before pushing to production.

## Prerequisites

1. ✅ R2 buckets created
2. ✅ Environment variables in `.env` file (copy from `.env.example`)
3. ✅ Test content with large files

## Setup

### 1. Create `.env` file (DO NOT COMMIT)

```bash
# Copy the example with your real credentials
cp .env.example .env

# Verify it contains your R2 credentials
cat .env
```

### 2. Load environment variables

Node.js doesn't automatically load `.env` files, so we need to load them before running Quartz:

```bash
# Load env vars and run build
export $(cat .env | xargs) && npx quartz build --publish-mode public
```

Or create a helper script:

```bash
# Create test script
cat > test-cdn.sh <<'EOF'
#!/bin/bash
set -a
source .env
set +a
npx quartz build "$@"
EOF

chmod +x test-cdn.sh

# Use it
./test-cdn.sh --publish-mode public
```

### 3. Create test content

```bash
# Create test directory
mkdir -p content/cdn-test

# Create a 25MB test file (larger than 20MB threshold)
dd if=/dev/zero of=content/cdn-test/large-file.pdf bs=1m count=25

# Create a test note
cat > content/cdn-test/index.md <<'EOF'
---
title: CDN Test Page
publish: "[[Public]]"
---

# CDN Test

This page tests large file handling.

Download this large file: [Large PDF](large-file.pdf)

This file is 25MB and should be uploaded to R2.
EOF
```

## Test Scenarios

### Test 1: Basic Upload to Public Tier

```bash
# Run build with public mode
export $(cat .env | xargs) && npx quartz build --publish-mode public

# Expected output:
# 📦 Detected 1 large files
# ⬆️  Uploading 1 files to CDN...
#   ✓ large-file.pdf → https://cdn-public.dario.ca/cdn-test/[hash]-large-file.pdf
# ✓ CDN upload complete (1 files, 0 orphans removed)
```

**Verify**:
1. Check build logs for CDN upload messages
2. Verify `.quartz-cache/cdn-mappings.json` was created:
   ```bash
   cat .quartz-cache/cdn-mappings.json
   ```
3. Check R2 bucket:
   ```bash
   aws s3 ls s3://vault-files-public/cdn-test/ --endpoint-url https://e86dfd0fe883a226db7cb97a327b98ad.r2.cloudflarestorage.com
   ```
4. Test CDN URL (should work without authentication):
   ```bash
   curl -I https://cdn-public.dario.ca/cdn-test/[hash]-large-file.pdf
   # Expected: 200 OK
   ```

### Test 2: Cache Hit (Deduplication)

```bash
# Run build again without changing anything
export $(cat .env | xargs) && npx quartz build --publish-mode public

# Expected output:
# 📦 Detected 1 large files
#   ⏭️  Skipped: large-file.pdf (already uploaded)
# ✓ No large files detected  # or similar
```

**Verify**:
- Build completes faster (no upload)
- Logs show "Skipped" for the file
- Cache file unchanged

### Test 3: Trusted Tier with Authentication

```bash
# Create trusted test
cat > content/cdn-test/trusted-test.md <<'EOF'
---
title: Trusted CDN Test
publish: "[[Trusted]]"
---

# Trusted File Test

Download: [Private Document](private-doc.pdf)
EOF

# Create another large file
dd if=/dev/zero of=content/cdn-test/private-doc.pdf bs=1m count=25

# Build with trusted mode
export $(cat .env | xargs) && npx quartz build --publish-mode trusted

# Expected: File uploaded to vault-files-trusted bucket
```

**Verify**:
1. Check R2 bucket:
   ```bash
   aws s3 ls s3://vault-files-trusted/cdn-test/ --endpoint-url https://e86dfd0fe883a226db7cb97a327b98ad.r2.cloudflarestorage.com
   ```
2. Test CDN URL (should require authentication):
   ```bash
   curl -I https://cdn-trusted.dario.ca/cdn-test/[hash]-private-doc.pdf
   # Expected: 403 Forbidden or redirect to Cloudflare Access login
   ```
3. Visit URL in browser (incognito):
   - Should see Cloudflare Access login page
   - After auth: file downloads

### Test 4: Multi-Reference (Least Restrictive Tier)

```bash
# Create files that reference the same large file
cat > content/cdn-test/public-ref.md <<'EOF'
---
title: Public Reference
publish: "[[Public]]"
---
Download: [Shared File](shared.pdf)
EOF

cat > content/cdn-test/trusted-ref.md <<'EOF'
---
title: Trusted Reference
publish: "[[Trusted]]"
---
Also references: [Shared File](shared.pdf)
EOF

# Create the shared file
dd if=/dev/zero of=content/cdn-test/shared.pdf bs=1m count=25

# Build public mode
export $(cat .env | xargs) && npx quartz build --publish-mode public

# Expected: File uploaded to vault-files-public (least restrictive)
```

**Verify**:
1. Only one upload (not two)
2. File in vault-files-public bucket
3. Accessible without authentication

### Test 5: Orphan Cleanup

```bash
# Remove the test note but keep the file
rm content/cdn-test/index.md

# Rebuild
export $(cat .env | xargs) && npx quartz build --publish-mode public

# Expected output:
# 🗑️  Removing 1 orphaned files from CDN...
#   ✓ Deleted: cdn-test/[hash]-large-file.pdf
```

**Verify**:
1. File removed from R2:
   ```bash
   aws s3 ls s3://vault-files-public/cdn-test/ --endpoint-url https://e86dfd0fe883a226db7cb97a327b98ad.r2.cloudflarestorage.com
   # Should not show large-file.pdf
   ```
2. CDN URL returns 404:
   ```bash
   curl -I https://cdn-public.dario.ca/cdn-test/[hash]-large-file.pdf
   # Expected: 404 Not Found
   ```

### Test 6: Small File (Should NOT Upload)

```bash
# Create a small file (10MB, below 20MB threshold)
dd if=/dev/zero of=content/cdn-test/small-file.pdf bs=1m count=10

# Create note
cat > content/cdn-test/small-test.md <<'EOF'
---
title: Small File Test
publish: "[[Public]]"
---
Download: [Small PDF](small-file.pdf)
EOF

# Build
export $(cat .env | xargs) && npx quartz build --publish-mode public

# Expected: No CDN upload for small-file.pdf
```

**Verify**:
- Build logs don't mention small-file.pdf
- File NOT in R2 bucket
- File copied to `public/` directory instead

## Debugging

### Check Environment Variables Are Loaded

```bash
export $(cat .env | xargs)
echo "R2_ENDPOINT: $R2_ENDPOINT"
echo "R2_ACCESS_KEY_ID: $R2_ACCESS_KEY_ID"
echo "CDN_DOMAIN_PUBLIC: $CDN_DOMAIN_PUBLIC"
```

### Verify R2 Connection

```bash
# List buckets to verify credentials work
aws s3 ls --endpoint-url https://e86dfd0fe883a226db7cb97a327b98ad.r2.cloudflarestorage.com

# Expected: List of your 4 buckets
```

### Check Build Logs

```bash
# Run build with verbose output
export $(cat .env | xargs) && npx quartz build --publish-mode public --verbose
```

### Inspect CDN Cache

```bash
# Pretty-print the cache file
cat .quartz-cache/cdn-mappings.json | python -m json.tool
```

### Check TypeScript Compilation

```bash
# Verify no compilation errors
npx tsc --noEmit
```

## Common Issues

### "R2 credentials not configured"

**Cause**: Environment variables not loaded

**Fix**:
```bash
# Make sure to export before running
export $(cat .env | xargs)
```

### "Failed to upload... 403 Forbidden"

**Cause**: API token doesn't have correct permissions

**Fix**:
- Go to R2 dashboard > Manage API Tokens
- Verify token has "Object Read & Write" permissions
- Verify all 4 buckets are selected in token scope

### Files not being detected as large

**Cause**: Files might be <20MB

**Fix**:
```bash
# Check actual file size
ls -lh content/cdn-test/

# Must be > 20MB (20971520 bytes)
```

### Upload succeeds but URL returns 404

**Cause**: Custom domain not properly connected to bucket

**Fix**:
- Check Cloudflare R2 dashboard > Bucket > Settings > Public Access
- Verify custom domain is connected
- Wait a few minutes for DNS propagation

## Cleanup

After testing, clean up test files:

```bash
# Remove test content
rm -rf content/cdn-test

# Remove cache
rm -rf .quartz-cache/cdn-mappings.json

# Clean build output
rm -rf public

# Delete test files from R2
aws s3 rm s3://vault-files-public/cdn-test/ --recursive --endpoint-url https://e86dfd0fe883a226db7cb97a327b98ad.r2.cloudflarestorage.com
```

## Ready for Production?

Once all local tests pass:

1. ✅ Files upload correctly to R2
2. ✅ Cache deduplication works
3. ✅ CDN URLs are accessible
4. ✅ Access controls work (public vs trusted tiers)
5. ✅ Orphan cleanup works
6. ✅ Small files ignored

**Then**:
- Commit your changes (except `.env`)
- Push to the repository
- Environment variables are already set in Cloudflare Pages
- Cloudflare Pages will build with CDN upload enabled

## Quick Test Script

Save this as `test-cdn-quick.sh`:

```bash
#!/bin/bash
set -e

echo "=== CDN Feature Quick Test ==="

# Load env
set -a
source .env
set +a

# Create test content
echo "Creating test content..."
mkdir -p content/cdn-test
dd if=/dev/zero of=content/cdn-test/test.pdf bs=1m count=25 2>/dev/null
cat > content/cdn-test/test.md <<'EOF'
---
title: CDN Test
publish: "[[Public]]"
---
Download: [Test File](test.pdf)
EOF

# Build
echo "Building..."
npx quartz build --publish-mode public

# Check results
echo ""
echo "=== Results ==="
if [ -f .quartz-cache/cdn-mappings.json ]; then
    echo "✓ CDN cache created"
    cat .quartz-cache/cdn-mappings.json | grep -q "test.pdf" && echo "✓ File in cache"
else
    echo "✗ CDN cache not found"
fi

# List R2
echo ""
echo "Files in R2:"
aws s3 ls s3://vault-files-public/cdn-test/ --endpoint-url $R2_ENDPOINT || echo "✗ Failed to list R2"

echo ""
echo "=== Test Complete ==="
```

Run it:
```bash
chmod +x test-cdn-quick.sh
./test-cdn-quick.sh
```
