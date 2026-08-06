#!/bin/sh

# wait minio initialize
sleep 15

mc config host add myminio http://minio:9000 "$S3_ACCESS_KEY" "$S3_SECRET_KEY"

if mc stat "myminio/$S3_BUCKET_NAME" > /dev/null 2>&1; then
    echo "Bucket already exists, skipping create buckets.."
else
    mc mb "myminio/$S3_BUCKET_NAME"
    echo "Bucket created: $S3_BUCKET_NAME"
fi

exit 0
