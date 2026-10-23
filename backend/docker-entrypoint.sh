#!/bin/sh
set -eu

# A mounted named volume hides the image directory and may be owned by root.
mkdir -p /app/backend/uploads
chown node:node /app/backend/uploads
if [ -e /app/backend/uploads/sample-banner-0001.png ]; then
  chown node:node /app/backend/uploads/sample-banner-0001.png
fi

exec su-exec node "$@"
