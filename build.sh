#!/bin/bash
# Cross-platform build script using Docker

echo "Building FGA Simulator for all platforms using Docker..."

# Build the Docker image
docker build -f Dockerfile.build -t fga-simulator-builder .

# Run the build inside Docker
docker run --rm \
  -v "$(pwd)/dist:/project/dist" \
  fga-simulator-builder

echo "Build complete! Check the dist/ directory for outputs."
