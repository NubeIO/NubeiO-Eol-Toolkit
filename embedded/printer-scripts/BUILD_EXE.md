# Building Standalone Printer Executable

This guide explains how to build a standalone executable for the printer script that doesn't require Python to be installed on user machines.

## Prerequisites

1. Python 3.x installed on your development machine
2. Install required packages:
   ```bash
   pip install pyinstaller brother_ql pyusb Pillow python-barcode
   ```

## Build the Executable

1. Navigate to this directory:
   ```bash
   cd embedded/printer-scripts
   ```

2. Run the build script:
   ```bash
   python build_exe.py
   ```

3. The executable will be created at:
   ```
   embedded/printer-scripts/dist/print_product_label.exe
   ```

4. Copy the executable to this directory:
   ```bash
   copy dist\print_product_label.exe .
   # or on Linux/Mac:
   cp dist/print_product_label.exe .
   ```

## How It Works

The `main.js` file has been updated to:
1. Check if `print_product_label.exe` exists
2. If yes, use the .exe directly (no Python needed)
3. If no, fall back to running the .py script with Python (development mode)

This allows:
- **Development**: Use `.py` script with Python installed
- **Production**: Bundle `.exe` in the app (users don't need Python)

## Building the Electron App

After creating the executable:

1. Make sure `print_product_label.exe` is in `embedded/printer-scripts/`
2. Build the Electron app:
   ```bash
   npm run build:win
   ```

The executable will be automatically included in the build because it's in the `embedded/` folder.

## Testing

Test the executable directly:
```bash
.\print_product_label.exe --check
```

## Notes

- The .exe is ~25-30MB because it bundles Python runtime and all dependencies
- Add `*.exe` to `.gitignore` if you don't want to commit the binary
- Rebuild the .exe whenever you update `print_product_label.py`
- The .exe only works on Windows; for Linux/Mac, use the Python script approach
