"""
Build print_product_label.py as a standalone executable using PyInstaller.
Run this script to create print_product_label.exe that can be bundled with the Electron app.

Usage: python build_exe.py
"""
import PyInstaller.__main__
import os
import shutil

# Get the directory of this script
script_dir = os.path.dirname(os.path.abspath(__file__))
main_script = os.path.join(script_dir, 'print_product_label.py')
output_dir = os.path.join(script_dir, 'dist')

# Clean previous build
if os.path.exists(output_dir):
    shutil.rmtree(output_dir)
build_dir = os.path.join(script_dir, 'build')
if os.path.exists(build_dir):
    shutil.rmtree(build_dir)

print("Building print_product_label.exe...")
print(f"Script: {main_script}")
print(f"Output: {output_dir}")

# PyInstaller arguments
PyInstaller.__main__.run([
    main_script,
    '--onefile',                    # Create a single executable
    '--console',                    # Show console window (for debugging)
    '--name=print_product_label',   # Name of the executable
    '--clean',                      # Clean cache
    '--noconfirm',                  # Replace output without asking
    f'--distpath={output_dir}',     # Output directory
    '--hidden-import=PIL',
    '--hidden-import=PIL._imaging',
    '--hidden-import=barcode',
    '--hidden-import=barcode.writer',
    '--hidden-import=brother_ql',
    '--hidden-import=brother_ql.backends',
    '--hidden-import=brother_ql.backends.helpers',
    '--hidden-import=brother_ql.conversion',
    '--hidden-import=brother_ql.raster',
    '--hidden-import=usb',
    '--hidden-import=usb.core',
    '--hidden-import=usb.util',
    '--hidden-import=usb.backend',
    '--hidden-import=usb.backend.libusb1',
])

print("\n[OK] Build complete!")
print(f"Executable: {os.path.join(output_dir, 'print_product_label.exe')}")
print("\nNext steps:")
print("1. Copy print_product_label.exe to embedded/printer-scripts/")
print("2. Update main.js to use the .exe instead of Python script")
