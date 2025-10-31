#!/bin/bash

# Linux USB Permissions Setup for ST-Link
# This script sets up udev rules to allow non-root access to ST-Link debuggers

set -e

echo "=== ST-Link USB Permissions Setup ==="
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo "⚠️  Please run this script as a normal user (without sudo)"
    echo "   The script will ask for sudo password when needed."
    exit 1
fi

# Check if running on Linux
if [ "$(uname)" != "Linux" ]; then
    echo "❌ This script is only for Linux systems."
    exit 1
fi

echo "This script will:"
echo "  1. Create udev rules for ST-Link devices"
echo "  2. Add your user to the 'plugdev' group"
echo "  3. Reload udev rules"
echo ""
read -p "Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Setup cancelled."
    exit 0
fi

# Create udev rules
echo ""
echo "Creating udev rules file..."
sudo tee /etc/udev/rules.d/60-stlink.rules > /dev/null <<'EOF'
# ST-Link V2
SUBSYSTEMS=="usb", ATTRS{idVendor}=="0483", ATTRS{idProduct}=="3748", MODE="0666", GROUP="plugdev", TAG+="uaccess"

# ST-Link V2-1
SUBSYSTEMS=="usb", ATTRS{idVendor}=="0483", ATTRS{idProduct}=="374b", MODE="0666", GROUP="plugdev", TAG+="uaccess"
SUBSYSTEMS=="usb", ATTRS{idVendor}=="0483", ATTRS{idProduct}=="3752", MODE="0666", GROUP="plugdev", TAG+="uaccess"

# ST-Link V3
SUBSYSTEMS=="usb", ATTRS{idVendor}=="0483", ATTRS{idProduct}=="374d", MODE="0666", GROUP="plugdev", TAG+="uaccess"
SUBSYSTEMS=="usb", ATTRS{idVendor}=="0483", ATTRS{idProduct}=="374e", MODE="0666", GROUP="plugdev", TAG+="uaccess"
SUBSYSTEMS=="usb", ATTRS{idVendor}=="0483", ATTRS{idProduct}=="374f", MODE="0666", GROUP="plugdev", TAG+="uaccess"
SUBSYSTEMS=="usb", ATTRS{idVendor}=="0483", ATTRS{idProduct}=="3753", MODE="0666", GROUP="plugdev", TAG+="uaccess"
SUBSYSTEMS=="usb", ATTRS{idVendor}=="0483", ATTRS{idProduct}=="3754", MODE="0666", GROUP="plugdev", TAG+="uaccess"
EOF

echo "✅ udev rules created at /etc/udev/rules.d/60-stlink.rules"

# Check if plugdev group exists, create if not
if ! getent group plugdev > /dev/null 2>&1; then
    echo ""
    echo "Creating 'plugdev' group..."
    sudo groupadd plugdev
    echo "✅ 'plugdev' group created"
fi

# Add user to plugdev group
echo ""
echo "Adding user '$USER' to 'plugdev' group..."
sudo usermod -a -G plugdev "$USER"
echo "✅ User added to 'plugdev' group"

# Reload udev rules
echo ""
echo "Reloading udev rules..."
sudo udevadm control --reload-rules
sudo udevadm trigger
echo "✅ udev rules reloaded"

# Check if ST-Link is currently connected
echo ""
echo "Checking for connected ST-Link devices..."
STLINK_COUNT=$(lsusb | grep -c "STMicroelectronics" || true)

if [ "$STLINK_COUNT" -gt 0 ]; then
    echo "✅ Found $STLINK_COUNT ST-Link device(s)"
    lsusb | grep "STMicroelectronics"
    echo ""
    echo "⚠️  Please unplug and replug your ST-Link for the new rules to take effect."
else
    echo "ℹ️  No ST-Link devices currently connected."
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "⚠️  ⚠️  ⚠️  CRITICAL: LOG OUT AND LOG BACK IN NOW! ⚠️  ⚠️  ⚠️"
echo ""
echo "The group membership changes WILL NOT WORK until you log out!"
echo "The STM32 Flasher will FAIL with 'init mode failed' until you log out!"
echo ""
echo "After logging back in, you can verify the setup:"
echo "  1. Connect your ST-Link"
echo "  2. Run: groups"
echo "     (should show 'plugdev' in the list)"
echo "  3. Run: lsusb | grep STMicro"
echo "     (should show your ST-Link device)"
echo "  4. Run: ls -l /dev/bus/usb/*/$(lsusb | grep STMicro | awk '{print $4}' | tr -d ':')"
echo "     (should show Mode 0666 or similar)"
echo ""
echo "Then you can use the STM32 Flasher without sudo!"
