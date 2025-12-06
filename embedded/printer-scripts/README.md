# Brother PT-P900W Printer Scripts

This folder contains Python scripts for printing labels via Brother PT-P900W USB printer.

## Files

- `print_product_label.py` - Main script for printing product labels with barcode
- `py-brotherlabel/` - Brother label printer library
- `libusb-1.0.dll` - USB library for Windows

## Requirements

Python packages (auto-installed by app):
- Pillow (PIL)
- python-barcode
- pyusb

## Usage

Called automatically by Electron app when "Print Label" button is clicked after successful factory testing.

## Label Format

- **Barcode**: Code128 barcode on left side
- **Info Fields**: 
  - MN: Make + Model
  - SW: Firmware version
  - BA: Batch ID
  - UID: Device unique ID
  - Date: Print date
- **Layout**: Horizontal barcode with border, optimized for 12mm TZe tape
