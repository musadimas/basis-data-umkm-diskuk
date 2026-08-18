#!/bin/sh
set -eu

: "${S3_ACCESS_KEY:?missing bootstrap access key}"
: "${S3_SECRET_KEY:?missing bootstrap secret key}"
: "${S3_BUCKET_NAME:?missing Directus bucket}"
: "${DIRECTUS_STORAGE_ACCESS_KEY:?missing Directus storage access key}"
: "${DIRECTUS_STORAGE_SECRET_KEY:?missing Directus storage secret key}"
: "${ANALYTICS_EXPORT_ACCESS_KEY:?missing analytics export access key}"
: "${ANALYTICS_EXPORT_SECRET_KEY:?missing analytics export secret key}"
: "${ANALYTICS_EXPORT_BUCKET:?missing analytics export bucket}"

# Wait for MinIO to accept admin commands without printing credentials.
mc config host add myminio http://minio:9000 "$S3_ACCESS_KEY" "$S3_SECRET_KEY" >/dev/null
until mc ready myminio >/dev/null 2>&1; do sleep 2; done

ensure_bucket() {
  bucket="$1"
  if ! mc stat "myminio/$bucket" >/dev/null 2>&1; then
    mc mb "myminio/$bucket" >/dev/null
  fi
}

ensure_user() {
  user="$1"
  secret="$2"
  policy="$3"
  # mc admin user add fails when the user already exists; updating the secret is
  # intentional and keeps this bootstrap idempotent for an ephemeral stack.
  mc admin user add myminio "$user" "$secret" >/dev/null 2>&1 || true
  mc admin policy attach myminio "$policy" --user "$user" >/dev/null
}

ensure_bucket "$S3_BUCKET_NAME"
ensure_bucket "$ANALYTICS_EXPORT_BUCKET"

cat >/tmp/directus-storage-policy.json <<EOF
{
  "Version":"2012-10-17",
  "Statement":[{"Effect":"Allow","Action":["s3:GetBucketLocation","s3:ListBucket"],"Resource":["arn:aws:s3:::$S3_BUCKET_NAME"]},{"Effect":"Allow","Action":["s3:GetObject","s3:PutObject","s3:DeleteObject"],"Resource":["arn:aws:s3:::$S3_BUCKET_NAME/*"]}]
}
EOF
cat >/tmp/analytics-export-policy.json <<EOF
{
  "Version":"2012-10-17",
  "Statement":[
    {"Effect":"Allow","Action":["s3:GetBucketLocation"],"Resource":["arn:aws:s3:::$ANALYTICS_EXPORT_BUCKET"]},
    {"Effect":"Allow","Action":["s3:ListBucket"],"Resource":["arn:aws:s3:::$ANALYTICS_EXPORT_BUCKET"],"Condition":{"StringLike":{"s3:prefix":["exports/*"]}}},
    {"Effect":"Allow","Action":["s3:GetObject","s3:PutObject","s3:DeleteObject"],"Resource":["arn:aws:s3:::$ANALYTICS_EXPORT_BUCKET/exports/*"]}
  ]
}
EOF
mc admin policy create myminio diskuk-directus-storage /tmp/directus-storage-policy.json >/dev/null
mc admin policy create myminio diskuk-analytics-export /tmp/analytics-export-policy.json >/dev/null
ensure_user "$DIRECTUS_STORAGE_ACCESS_KEY" "$DIRECTUS_STORAGE_SECRET_KEY" diskuk-directus-storage
ensure_user "$ANALYTICS_EXPORT_ACCESS_KEY" "$ANALYTICS_EXPORT_SECRET_KEY" diskuk-analytics-export
rm -f /tmp/directus-storage-policy.json /tmp/analytics-export-policy.json
echo "MinIO buckets and least-privilege users are ready"
