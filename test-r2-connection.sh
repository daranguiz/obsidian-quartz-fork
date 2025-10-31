#!/bin/bash

# Test R2 connection
echo "=== Testing R2 Connection ==="
echo ""

export R2_ENDPOINT="https://e86dfd0fe883a226db7cb97a327b98ad.r2.cloudflarestorage.com"
export AWS_ACCESS_KEY_ID="7e62bfd2801d1b29773bf396854483e1"
export AWS_SECRET_ACCESS_KEY="75fdf4a5cfdfa899c04df7f017ad3373d7805d5dc2d051387327520ce1b7d2f1"

echo "Endpoint: $R2_ENDPOINT"
echo ""
echo "Attempting to list buckets..."
echo ""

aws s3 ls --endpoint-url "$R2_ENDPOINT"

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ R2 connection successful!"
else
    echo ""
    echo "✗ R2 connection failed"
    echo "Check your credentials in .env file"
fi
