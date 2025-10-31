# Testing Guide: Large File CDN Handling

**Feature**: 002-large-file-handling
**Date**: 2025-10-31
**Status**: Implementation Complete - Awaiting Infrastructure Setup & Testing

## Overview

This guide provides instructions for testing the large file CDN handling feature after completing the infrastructure setup.

## Prerequisites

Before testing, you must complete the infrastructure setup described in [specs/002-large-file-handling/quickstart.md](specs/002-large-file-handling/quickstart.md):

1. ✅ Create 4 R2 buckets (vault-files-full, vault-files-trusted, vault-files-shachu, vault-files-public)
2. ✅ Configure custom domains (cdn-full.dario.ca, cdn-trusted.dario.ca, cdn-shachu.dario.ca, cdn-public.dario.ca)
3. ✅ Set up Cloudflare Zero Trust Access policies for Full, Trusted, and Shachu tiers
4. ✅ Generate R2 API tokens
5. ✅ Configure environment variables in all four Cloudflare Pages projects

## Testing Checklist

### Phase 1: Local Testing (Optional)

**Note**: The CDN uploader requires R2 credentials. Local testing will skip uploads if credentials are not configured.

```bash
# Test build without CDN (no R2 credentials)
npx quartz build --publish-mode public

# Verify no errors (CDN upload should skip gracefully)
```

### Phase 2: Infrastructure Validation

#### Test R2 Upload (Manual)

```bash
# Install AWS CLI if needed
brew install awscli

# Configure with R2 credentials
aws configure set aws_access_key_id <R2_ACCESS_KEY_ID>
aws configure set aws_secret_access_key <R2_SECRET_ACCESS_KEY>

# Test upload to public bucket
echo "Test file content" > test.txt
aws s3 cp test.txt s3://vault-files-public/test.txt \
  --endpoint-url <R2_ENDPOINT>

# Verify upload
aws s3 ls s3://vault-files-public/ \
  --endpoint-url <R2_ENDPOINT>

# Test CDN access
curl -I https://cdn-public.dario.ca/test.txt
# Expected: 200 OK

# Clean up
aws s3 rm s3://vault-files-public/test.txt \
  --endpoint-url <R2_ENDPOINT>
rm test.txt
```

#### Test Access Policies

**Full Tier**:
1. Visit https://cdn-full.dario.ca in incognito browser
2. Expected: Cloudflare Access login page
3. Log in with vault owner's Google account → Access granted
4. Try with different account → Access denied

**Trusted Tier**:
1. Visit https://cdn-trusted.dario.ca in incognito browser
2. Expected: Cloudflare Access login page
3. Log in with trusted user's Google account → Access granted
4. Try with non-trusted account → Access denied

**Public Tier**:
1. Visit https://cdn-public.dario.ca in incognito browser
2. Expected: No authentication required (direct access)

### Phase 3: Integration Testing

#### Test Case 1: Public Large File

**Setup**:
```markdown
# content/test-public.md
---
title: Test Public Large File
publish: "[[Public]]"
---

# Test Page

Download this large file: [Large PDF](files/large-test.pdf)
```

**Requirements**:
- Create a test file `content/files/large-test.pdf` (>20MB)
- You can generate one with: `dd if=/dev/zero of=content/files/large-test.pdf bs=1m count=25`

**Expected Behavior**:
1. Build with: `npx quartz build --publish-mode public`
2. During build:
   - ✅ Plugin detects large file (>20MB)
   - ✅ Computes SHA-256 hash
   - ✅ Uploads to `vault-files-public` bucket
   - ✅ Logs: "✓ large-test.pdf → https://cdn-public.dario.ca/..."
3. After build:
   - ✅ File accessible at CDN URL without authentication
   - ✅ `.quartz-cache/cdn-mappings.json` contains mapping entry
4. Rebuild:
   - ✅ Second build skips upload (logs: "Skipped: large-test.pdf (already uploaded)")

#### Test Case 2: Trusted Large File with Authentication

**Setup**:
```markdown
# content/test-trusted.md
---
title: Test Trusted Large File
publish: "[[Trusted]]"
---

# Private Test Page

Download this file: [Private Document](files/private-doc.pdf)
```

**Requirements**:
- Create `content/files/private-doc.pdf` (>20MB)

**Expected Behavior**:
1. Build with: `npx quartz build --publish-mode trusted`
2. During build:
   - ✅ File uploads to `vault-files-trusted` bucket
   - ✅ CDN URL: `https://cdn-trusted.dario.ca/files/{hash}-private-doc.pdf`
3. Access test (unauthenticated):
   - Visit CDN URL in incognito browser
   - ✅ Blocked by Cloudflare Access (login required)
4. Access test (authenticated):
   - Log in as trusted user
   - ✅ File downloads successfully

#### Test Case 3: Multi-Reference File (Least Restrictive Tier)

**Setup**:
```markdown
# content/public-note.md
---
title: Public Note
publish: "[[Public]]"
---
Link to: [Shared File](files/shared.pdf)

# content/trusted-note.md
---
title: Trusted Note
publish: "[[Trusted]]"
---
Also references: [Shared File](files/shared.pdf)
```

**Expected Behavior**:
1. Build with: `npx quartz build --publish-mode public`
2. Access level resolution:
   - ✅ Plugin detects file referenced by both Public and Trusted notes
   - ✅ Resolves to **Public** (least restrictive)
   - ✅ Uploads to `vault-files-public` bucket
   - ✅ Accessible without authentication
3. Verify:
   - Only one upload (deduplication by hash)
   - File accessible on public CDN domain

#### Test Case 4: Orphan Cleanup

**Setup**:
1. Create note with large file, build
2. Delete the referencing note
3. Rebuild

**Expected Behavior**:
1. First build:
   - ✅ File uploaded to CDN
   - ✅ Mapping added to cache with `referencedBy: ["test-note"]`
2. After deleting note and rebuilding:
   - ✅ Plugin detects orphaned file (no references)
   - ✅ Logs: "Removing 1 orphaned files from CDN..."
   - ✅ Deletes file from R2
   - ✅ Removes mapping from cache

#### Test Case 5: File Growth Detection

**Setup**:
1. Create 15MB file (below threshold)
2. Build
3. Grow file to 25MB (above threshold)
4. Rebuild

**Expected Behavior**:
1. First build (15MB):
   - ✅ File NOT uploaded (below 20MB threshold)
   - ✅ Link remains unchanged
2. Second build (25MB):
   - ✅ File detected as large (>20MB)
   - ✅ Uploaded to appropriate CDN
   - ✅ Link rewritten to CDN URL

### Phase 4: Cross-Tier Validation

Build all four publish modes and verify correct behavior:

```bash
# Full tier
npx quartz build --publish-mode full --baseUrl vault.dario.ca

# Trusted tier
npx quartz build --publish-mode trusted --baseUrl notes-private.dario.ca

# Shachu tier
npx quartz build --publish-mode shachu --baseUrl notes-shachu.dario.ca

# Public tier
npx quartz build --publish-mode public --baseUrl notes.dario.ca
```

**Verification Matrix**:

| File Publish Mode | Full Build | Trusted Build | Shachu Build | Public Build |
|-------------------|------------|---------------|--------------|--------------|
| No field (Full)   | vault-files-full | ❌ Not included | ❌ Not included | ❌ Not included |
| [[Trusted]]       | vault-files-trusted | vault-files-trusted | ❌ Not included | ❌ Not included |
| [[Shachu]]        | vault-files-shachu | vault-files-shachu | vault-files-shachu | ❌ Not included |
| [[Public]]        | vault-files-public | vault-files-public | vault-files-public | vault-files-public |

### Phase 5: Error Handling

#### Test Upload Failure

**Simulate**: Provide invalid R2 credentials

**Expected Behavior**:
- ✅ Build fails with clear error message
- ✅ Error indicates which file failed and attempt count
- ✅ No partial uploads

#### Test Network Error (Retry Logic)

**Note**: Difficult to test without simulating network conditions

**Expected Behavior** (if tested):
- ✅ Exponential backoff retry (1s, 2s, 4s)
- ✅ Up to 3 attempts before failing
- ✅ Clear error message after exhausting retries

## Performance Benchmarks

### Expected Performance Targets

- **Files ≤50**: Linear scaling, <30% build time increase
- **Files >50**: Parallel uploads (10 concurrent), maintain <30% increase
- **Cache hits**: Near-instant (skip upload)

### Benchmark Test

Create 60 large files (>20MB each) and measure build time:

```bash
# Create test files
mkdir -p content/perf-test
for i in {1..60}; do
  dd if=/dev/zero of=content/perf-test/file-$i.bin bs=1m count=25 2>/dev/null
done

# Create note referencing all files
cat > content/perf-test/index.md <<EOF
---
title: Performance Test
publish: "[[Public]]"
---
# Performance Test

$(for i in {1..60}; do echo "- [File $i](file-$i.bin)"; done)
EOF

# Measure build time
time npx quartz build --publish-mode public

# Clean up
rm -rf content/perf-test
```

**Expected Results**:
- First build: 60 files uploaded in parallel (batches of 10)
- Second build: 60 files skipped (cache hits)
- Build time increase: <30% compared to baseline

## Troubleshooting

### Build Not Detecting Large Files

**Check**:
- File size >20MB: `ls -lh content/files/`
- File referenced in markdown: Check link syntax
- Build logs: Look for "Detected X large files"

### Upload Failing

**Check**:
- R2 credentials configured: `echo $R2_ACCESS_KEY_ID`
- Endpoint URL correct: Should match account ID
- Network connectivity: Can you reach Cloudflare?
- Bucket permissions: Token has Read & Write access

### CDN URL Not Accessible

**Check**:
- Custom domain connected: Cloudflare R2 dashboard
- DNS records correct: `dig cdn-public.dario.ca`
- Access policy (restricted tiers): Test authentication
- File actually uploaded: `aws s3 ls s3://vault-files-public/ --endpoint-url <R2_ENDPOINT>`

### Orphan Cleanup Not Working

**Check**:
- Cache file exists: `cat .quartz-cache/cdn-mappings.json`
- Referencing notes actually deleted (not just filtered)
- Build logs show orphan detection: "Removing X orphaned files"

## Next Steps After Testing

1. ✅ Validate all test cases pass
2. ✅ Verify performance meets targets
3. ✅ Confirm security (Zero Trust blocking unauthorized access)
4. ✅ Test on all four live sites (Full, Trusted, Shachu, Public)
5. ✅ Monitor first production build logs
6. ✅ Check CDN analytics/usage
7. ✅ Update documentation if issues found

## Reference

- Feature Specification: [specs/002-large-file-handling/spec.md](specs/002-large-file-handling/spec.md)
- Implementation Plan: [specs/002-large-file-handling/plan.md](specs/002-large-file-handling/plan.md)
- Infrastructure Setup: [specs/002-large-file-handling/quickstart.md](specs/002-large-file-handling/quickstart.md)
- Architecture Documentation: [docs-custom/ARCHITECTURE.md](docs-custom/ARCHITECTURE.md#large-file-cdn-handling-custom)
