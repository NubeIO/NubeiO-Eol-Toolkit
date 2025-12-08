# Brother Printer Software Manual

## Table of Contents

1. [Installation](#installation)
2. [Operation Guide](#operation-guide)
3. [Troubleshooting](#troubleshooting)
4. [Configuration](#configuration)

## Installation

### Hardware Setup

1. **Connect Printer**
   - Connect Brother PT-P900W to USB port
   - Power on the printer
   - Wait for Windows to recognize the device

2. **Load Tape**
   - Open tape compartment
   - Insert 12mm TZe laminated tape
   - Close compartment securely

3. **Verify Connection**
   - Open Nube iO Toolkit
   - Navigate to Factory Testing page
   - Click "Check Printer" button
   - Status should show "Connected"

### Software Setup (Development)

For developers who need to modify the printer script:

```bash
# Install Python dependencies
pip install brother_ql pyusb Pillow python-barcode

# Test printer connection
cd embedded/printer-scripts
python print_product_label.py --check
```

## Operation Guide

### Printing a Label

1. **Navigate to Factory Testing Module**
   - Launch Nube iO Toolkit
   - Click "Factory Testing" in navigation menu

2. **Complete Device Testing**
   - Run all factory tests
   - Ensure all tests pass
   - Device information will be captured

3. **Print Label**
   - Click "Print Label" button
   - Wait for label to print
   - Verify label quality

### Label Information

Each label contains:

```
┌─────────────────────────────────────┐
│ ║║║║║║║║║║║║  MN: ME-05-N1         │
│ ║║ME-05-F8AC║  SW: 1.3.6            │
│ ║║  119F    ║  BA: 01202434         │
│                                     │
│    ME-05-F8AC119F                   │
└─────────────────────────────────────┘
```

- **Barcode**: Device UID (Code128)
- **MN**: Model Number
- **SW**: Software/Firmware Version
- **BA**: Batch ID
- **Bottom Text**: Model-LoRaAddr

## Troubleshooting

### Printer Not Detected

**Symptom**: "CHECK_FAILED: No backend available"

**Solutions**:
1. Verify USB connection
2. Check printer power
3. Restart application
4. Try different USB port
5. Reinstall USB drivers

### Python Not Found Error

**Symptom**: "Error: spawn py ENOENT"

**Solution**: 
- This should NOT occur in production builds
- Ensure `print_product_label.exe` exists in `embedded/printer-scripts/`
- If developing, install Python 3.x

### Print Quality Issues

**Symptom**: Faded or unclear labels

**Solutions**:
1. Replace tape cartridge
2. Clean print head
3. Check tape type (must be TZe laminated)
4. Adjust print quality in script (if needed)

### Access Denied Error

**Symptom**: "errno 13" or "Access denied"

**Solutions**:
1. Close other applications using printer
2. Unplug and replug USB
3. Run application as administrator (if needed)
4. Check Windows device permissions

## Configuration

### Printer Settings

Default settings in `print_product_label.py`:

```python
# Tape size
tape = '12'  # 12mm TZe tape

# Print quality
threshold = 70.0
dither = False
hq = True  # High quality

# Auto cut
cut = True
```

### Label Dimensions

```python
# Label canvas
label_width = barcode_width + 500
label_height = 160  # Pixels

# Barcode
barcode_display_height = 120
module_height = 28
module_width = 0.5

# Fonts
font_medium = 44pt
font_small = 39pt
font_tiny = 34pt
```

### Modifying Label Layout

To customize the label design:

1. Edit `print_product_label.py`
2. Modify `create_product_label()` function
3. Test with: `python print_product_label.py <test_data>`
4. Rebuild executable: `python build_exe.py`
5. Copy new `.exe` to `embedded/printer-scripts/`

## Command Line Usage

### Check Printer Status

```bash
print_product_label.exe --check
```

**Output**:
- Exit code 0: Printer connected
- Exit code 1: Printer not found

### Print Label

```bash
print_product_label.exe <barcode> <mn> <firmware> <batchId> <uid> <date>
```

**Example**:
```bash
print_product_label.exe "ME051EACDADB" "ME-05-N1" "1.3.6" "01202434" "F8AC119F" "2024/11/08"
```

## API Reference

See [CLASS_REFERENCE.md](./CLASS_REFERENCE.md) for detailed API documentation.

## Maintenance

### Regular Maintenance

- **Weekly**: Check tape level
- **Monthly**: Clean print head with cleaning tape
- **Quarterly**: Update firmware if available

### Log Files

Preview labels are saved to:
```
embedded/printer-scripts/preview_label.png
```

Use this to verify label layout without printing.

## Support

For issues or questions:
- Check [Troubleshooting](#troubleshooting)
- Review [GitHub Issues](https://github.com/NubeIO/NubeiO-Eol-Toolkit/issues)
- Contact: support@nube-io.com
