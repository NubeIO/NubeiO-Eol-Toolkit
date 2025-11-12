#!/bin/bash

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "=== OpenOCD Linux Setup ==="
echo "Downloading xPack OpenOCD for Linux x64..."
echo ""

# Check if already exists
if [ -d "linux" ]; then
    echo "⚠️  Linux OpenOCD directory already exists."
    read -p "Do you want to re-download? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Skipping download."
        exit 0
    fi
    echo "Removing existing directory..."
    rm -rf linux
fi

# Download
OPENOCD_VERSION="0.12.0-3"
DOWNLOAD_URL="https://github.com/xpack-dev-tools/openocd-xpack/releases/download/v${OPENOCD_VERSION}/xpack-openocd-${OPENOCD_VERSION}-linux-x64.tar.gz"

echo "Downloading from: $DOWNLOAD_URL"
wget -q --show-progress "$DOWNLOAD_URL" || {
    echo "❌ Download failed!"
    echo "Please check your internet connection or download manually from:"
    echo "$DOWNLOAD_URL"
    exit 1
}

# Extract
echo "Extracting..."
tar -xzf "xpack-openocd-${OPENOCD_VERSION}-linux-x64.tar.gz" || {
    echo "❌ Extraction failed!"
    exit 1
}

# Rename
echo "Setting up directory structure..."
mv "xpack-openocd-${OPENOCD_VERSION}" linux

# Make executable
chmod +x linux/bin/openocd

# Clean up
rm "xpack-openocd-${OPENOCD_VERSION}-linux-x64.tar.gz"

# Verify
echo ""
echo "=== Setup Complete ==="
echo "OpenOCD version:"
./linux/bin/openocd --version 2>&1 | head -1 || echo "Error: Failed to run openocd"

echo ""
echo "Directory structure:"
ls -lh linux/bin/openocd 2>/dev/null || echo "❌ Binary not found"
ls -d linux/share/openocd/scripts 2>/dev/null || echo "❌ Scripts not found"

echo ""
echo "✅ Linux OpenOCD binaries are ready!"
echo ""
echo "📝 Note: Users will need to set up USB permissions for ST-Link."
echo "   See LINUX_SETUP.md for udev rules instructions."
