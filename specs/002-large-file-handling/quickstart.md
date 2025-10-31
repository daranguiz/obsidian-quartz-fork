# Quickstart: Setting Up CDN for Large Files

**Feature**: 002-large-file-handling
**Audience**: Developers implementing this feature
**Time**: ~30-45 minutes for initial setup

## Prerequisites

- Cloudflare account with domain (`dario.ca`)
- Cloudflare Zero Trust enabled (existing setup)
- Access to Cloudflare Pages projects (existing)
- R2 enabled on Cloudflare account

## Overview

This guide walks through setting up the infrastructure needed for large file handling:
1. Create 4 R2 buckets (one per access tier)
2. Configure custom domains for each bucket
3. Set up Cloudflare Access policies for restricted tiers
4. Configure environment variables for build process
5. Test the setup

## Step 1: Create R2 Buckets

### 1.1 Navigate to R2 in Cloudflare Dashboard
- Go to https://dash.cloudflare.com
- Select your account
- Click **R2** in the left sidebar
- Click **Create bucket**

### 1.2 Create Four Buckets

Create each bucket with these names:

| Bucket Name | Purpose | Access Level |
|------------|---------|--------------|
| `vault-files-full` | Files from Full-tier notes | Most restrictive |
| `vault-files-trusted` | Files from Trusted-tier notes | Trusted users only |
| `vault-files-shachu` | Files from Shachu-tier notes | Shachu members only |
| `vault-files-public` | Files from Public-tier notes | No authentication |

For each bucket:
1. Click **Create bucket**
2. Enter bucket name (e.g., `vault-files-full`)
3. Leave location as default (automatic)
4. Click **Create bucket**
5. Repeat for all four buckets

### 1.3 Note Bucket Endpoints

After creating buckets, note down the R2 endpoint URL for your account:
- Format: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
- Find in R2 dashboard > Any bucket > Settings > Bucket Details

You'll need this for environment variables.

## Step 2: Configure Custom Domains

### 2.1 Add DNS Records (if not already present)

For each tier, add a CNAME record in Cloudflare DNS:

| Type | Name | Target | Proxy Status |
|------|------|--------|--------------|
| CNAME | `cdn-full` | `dario.ca` | Proxied (orange cloud) |
| CNAME | `cdn-trusted` | `dario.ca` | Proxied (orange cloud) |
| CNAME | `cdn-shachu` | `dario.ca` | Proxied (orange cloud) |
| CNAME | `cdn-public` | `dario.ca` | Proxied (orange cloud) |

Steps:
1. Go to **DNS** tab in Cloudflare dashboard
2. Click **Add record**
3. Type: `CNAME`
4. Name: `cdn-full` (or cdn-trusted, cdn-shachu, cdn-public)
5. Target: `dario.ca`
6. Proxy status: **Proxied** (orange cloud icon)
7. Click **Save**
8. Repeat for all four subdomains

### 2.2 Connect Custom Domains to R2 Buckets

For each bucket, connect its custom domain:

1. Go to **R2** > Select bucket (e.g., `vault-files-full`)
2. Click **Settings** tab
3. Scroll to **Public Access** section
4. Click **Connect Domain**
5. Enter custom domain (e.g., `cdn-full.dario.ca`)
6. Click **Continue**
7. Wait for domain verification (usually instant if DNS is correct)
8. Repeat for all four buckets

**Mapping**:
- `vault-files-full` → `cdn-full.dario.ca`
- `vault-files-trusted` → `cdn-trusted.dario.ca`
- `vault-files-shachu` → `cdn-shachu.dario.ca`
- `vault-files-public` → `cdn-public.dario.ca`

**⚠️ Important**: Do NOT enable "Public Access" on any bucket yet. We'll configure Access policies first.

## Step 3: Configure Cloudflare Access Policies

### 3.1 Create Access Application for Full Tier

1. Go to **Zero Trust** > **Access** > **Applications**
2. Click **Add an application**
3. Select **Self-hosted**
4. Configure application:
   - **Application name**: `CDN Full Access`
   - **Session duration**: `24 hours` (or match vault.dario.ca)
   - **Application domain**:
     - Subdomain: `cdn-full`
     - Domain: `dario.ca`
5. Click **Next**
6. Add policy:
   - **Policy name**: `Allow Vault Owner`
   - **Action**: `Allow`
   - **Session duration**: `24 hours`
   - **Configure rules**:
     - Include: `Emails` → Enter vault owner's email
7. Click **Next**
8. Review and click **Add application**

### 3.2 Create Access Application for Trusted Tier

Repeat Step 3.1 with these changes:
- **Application name**: `CDN Trusted Access`
- **Application domain**: `cdn-trusted.dario.ca`
- **Policy name**: `Allow Trusted Users`
- **Configure rules**:
  - Include: `Emails` → Enter trusted users' emails (or use Google Groups)

### 3.3 Create Access Application for Shachu Tier

Repeat Step 3.1 with these changes:
- **Application name**: `CDN Shachu Access`
- **Application domain**: `cdn-shachu.dario.ca`
- **Policy name**: `Allow Shachu Members`
- **Configure rules**:
  - Include: `Emails` → Enter shachu members' emails

### 3.4 No Access Policy for Public Tier

**Do NOT create an Access application for `cdn-public.dario.ca`.**

Public files should be accessible without authentication.

## Step 4: Generate R2 API Tokens

### 4.1 Create API Token for Build Process

1. Go to **R2** > **Manage R2 API Tokens**
2. Click **Create API token**
3. Configure token:
   - **Token name**: `quartz-build-cdn-upload`
   - **Permissions**: `Admin Read & Write`
   - **TTL**: No expiration (or 1 year if you prefer rotation)
   - **Buckets**: Select all four buckets:
     - `vault-files-full`
     - `vault-files-trusted`
     - `vault-files-shachu`
     - `vault-files-public`
4. Click **Create API Token**
5. **SAVE THESE CREDENTIALS** (shown only once):
   - Access Key ID: `<ACCESS_KEY_ID>`
   - Secret Access Key: `<SECRET_ACCESS_KEY>`
   - Jurisdiction-specific Endpoint for S3 Clients: `<ENDPOINT_URL>`

**⚠️ Security**: Store these securely. They will be added to Cloudflare Pages environment variables (not committed to git).

## Step 5: Configure Cloudflare Pages Environment Variables

For **each of the four Cloudflare Pages projects**:

1. Go to **Pages** > Select project (e.g., `vault-full`)
2. Click **Settings** tab
3. Click **Environment variables**
4. Add the following variables:

| Variable Name | Value | Type |
|--------------|-------|------|
| `R2_ENDPOINT` | From Step 4.1 (e.g., `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`) | Encrypted |
| `R2_ACCESS_KEY_ID` | From Step 4.1 | Encrypted |
| `R2_SECRET_ACCESS_KEY` | From Step 4.1 | Encrypted |
| `CDN_DOMAIN_FULL` | `cdn-full.dario.ca` | Plain text |
| `CDN_DOMAIN_TRUSTED` | `cdn-trusted.dario.ca` | Plain text |
| `CDN_DOMAIN_SHACHU` | `cdn-shachu.dario.ca` | Plain text |
| `CDN_DOMAIN_PUBLIC` | `cdn-public.dario.ca` | Plain text |

5. Click **Save**

**Note**: You may need to set these for both "Production" and "Preview" environments.

Repeat for all four projects:
- `vault-full` (full tier)
- `vault-trusted` (trusted tier)
- `vault-shachu` (shachu tier)
- `vault-public` (public tier)

## Step 6: Test the Setup

### 6.1 Test R2 Upload (Manual)

Use the AWS CLI or a test script to verify R2 access:

```bash
# Install AWS CLI if needed
# brew install awscli

# Configure AWS CLI with R2 credentials
aws configure set aws_access_key_id <R2_ACCESS_KEY_ID>
aws configure set aws_secret_access_key <R2_SECRET_ACCESS_KEY>

# Test upload to public bucket
echo "Test file content" > test.txt
aws s3 cp test.txt s3://vault-files-public/test.txt \
  --endpoint-url <R2_ENDPOINT>

# Verify upload
aws s3 ls s3://vault-files-public/ \
  --endpoint-url <R2_ENDPOINT>

# Clean up
aws s3 rm s3://vault-files-public/test.txt \
  --endpoint-url <R2_ENDPOINT>
rm test.txt
```

Expected output: File uploads successfully and appears in bucket listing.

### 6.2 Test Access Policies

#### Test Full Tier (Restricted)
1. Visit `https://cdn-full.dario.ca` in private/incognito browser
2. **Expected**: Cloudflare Access login page appears
3. Log in with vault owner's Google account
4. **Expected**: Access granted (even if no files exist, you should get past auth)
5. Try logging in with a different Google account (not in policy)
6. **Expected**: Access denied

#### Test Trusted Tier
Repeat 6.2 Full Tier test with `https://cdn-trusted.dario.ca` and trusted user's account.

#### Test Shachu Tier
Repeat 6.2 Full Tier test with `https://cdn-shachu.dario.ca` and shachu member's account.

#### Test Public Tier
1. Visit `https://cdn-public.dario.ca` in private/incognito browser
2. **Expected**: No authentication required (direct access, may show 404 if no files)

### 6.3 Test File Access with Authentication

Upload a test file to restricted bucket and verify Access policy:

```bash
# Upload test file to trusted bucket
aws s3 cp test.pdf s3://vault-files-trusted/test.pdf \
  --endpoint-url <R2_ENDPOINT>

# Try accessing via CDN URL
# In browser: https://cdn-trusted.dario.ca/test.pdf
# Expected: Cloudflare Access login, then file downloads
```

## Step 7: Document Configuration

Create a `.env.example` file in the repository root to document environment variables:

```bash
# Cloudflare R2 Configuration
# These values should be set in Cloudflare Pages environment variables
# DO NOT commit actual values to git

# R2 API Credentials
R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<your_access_key_id>
R2_SECRET_ACCESS_KEY=<your_secret_access_key>

# CDN Custom Domains
CDN_DOMAIN_FULL=cdn-full.dario.ca
CDN_DOMAIN_TRUSTED=cdn-trusted.dario.ca
CDN_DOMAIN_SHACHU=cdn-shachu.dario.ca
CDN_DOMAIN_PUBLIC=cdn-public.dario.ca

# R2 Bucket Names
R2_BUCKET_FULL=vault-files-full
R2_BUCKET_TRUSTED=vault-files-trusted
R2_BUCKET_SHACHU=vault-files-shachu
R2_BUCKET_PUBLIC=vault-files-public
```

## Troubleshooting

### Domain Connection Fails
- Verify DNS records are proxied (orange cloud)
- Wait 5-10 minutes for DNS propagation
- Check domain is on Cloudflare (not external DNS provider)

### Access Policy Not Working
- Ensure Access application domain exactly matches R2 custom domain
- Check policy includes correct email addresses or groups
- Try clearing browser cookies and logging in again
- Verify user's Google account matches email in policy

### R2 Upload Fails
- Verify API token has correct permissions (Admin Read & Write)
- Check API token includes all four buckets
- Verify endpoint URL format: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
- Check Access Key ID and Secret Access Key are correct

### Files Not Accessible After Upload
- Verify custom domain is connected to correct bucket
- Check file was uploaded to correct bucket for tier
- Test with curl to see raw response:
  ```bash
  curl -I https://cdn-trusted.dario.ca/test.pdf
  ```

### Build Can't Access R2
- Verify environment variables are set in Cloudflare Pages (not just .env)
- Check variable names match exactly (case-sensitive)
- Ensure variables are saved for both Production and Preview environments
- Redeploy site after adding environment variables

## Next Steps

After completing this setup:

1. ✅ R2 buckets created and configured
2. ✅ Custom domains connected
3. ✅ Access policies active
4. ✅ Environment variables configured
5. ✅ Test uploads and access working

You're ready to implement the Quartz plugins that will:
- Detect large files during build
- Upload to appropriate R2 bucket
- Rewrite links to CDN URLs
- Remove orphaned files

Proceed to `/speckit.tasks` to generate implementation tasks.

## Reference

- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [Protect R2 with Cloudflare Access](https://developers.cloudflare.com/r2/tutorials/cloudflare-access/)
- [Zero Trust Access Policies](https://developers.cloudflare.com/cloudflare-one/policies/access/)
- [AWS S3 SDK for R2](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js/)
