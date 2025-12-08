# Software Manual - Brother PT-P900W Label Printer

## Table of Contents

1. [Introduction](#introduction)
2. [Installation](#installation)
3. [Usage Guide](#usage-guide)
4. [API Reference](#api-reference)
5. [Configuration](#configuration)
6. [Troubleshooting](#troubleshooting)

## Introduction

### Purpose

The Brother PT-P900W Label Printer module provides automated label printing for factory testing workflows. It generates professional product labels with barcodes, device information, and metadata.

### Target Audience

- Factory testing operators
- Quality assurance personnel
- System integrators
- Software developers

### System Requirements

**Hardware:**
- Brother PT-P900W label printer
- USB connection
- Windows 10/11 (x64)
- 12mm TZe tape cartridge

**Software:**
- No requirements for end users (standalone executable)
- For developers: Python 3.13+, PyInstaller

## Installation

### End User Installation

1. **Printer Setup**
   ```
   - Connect Brother PT-P900W via USB
   - Power on the printer
   - Load 12mm TZe tape cartridge
   - Install printer drivers (automatic via Windows Update)
   ```

2. **Software Installation**
   ```
   - No installation required
   - Executable is bundled with Nube iO Toolkit
   - Location: embedded/printer-scripts/print_product_label.exe
   ```

3. **Verification**
   ```bash
   # Test printer connection
   print_product_label.exe --check
   
   # Expected output:
   # Using libusb: ...\libusb-1.0.dll
   # Checking printer connection...
   # Connecting to printer via USB...
   # CHECK_STATUS_OK
   ```

### Developer Installation

```bash
# Clone repository
git clone https://github.com/NubeIO/NubeiO-Eol-Toolkit.git
cd NubeiO-Eol-Toolkit/embedded/printer-scripts

# Install dependencies
pip install -r requirements.txt

# Or install individually:
pip install pyinstaller pillow python-barcode brother_ql pyusb

# Test installation
python print_product_label.py --check
```

## Usage Guide

### Command Line Interface

#### Check Printer Connection

```bash
print_product_label.exe --check
```

**Output:**
```
Using libusb: C:\...\libusb-1.0.dll
Checking printer connection...
Connecting to printer via USB...
CHECK_STATUS_OK
```

#### Print Label

```bash
print_product_label.exe <barcode> <mn> <firmware> <batchId> <uid> <date>
```

**Parameters:**
- `barcode`: Barcode text (Code128 format)
- `mn`: Make and Model (e.g., ME-0005)
- `firmware`: Firmware version (e.g., 3)
- `batchId`: Batch ID (e.g., 4)
- `uid`: Unique identifier (displayed on label)
- `date`: Date in YYYY/MM/DD format

**Example:**
```bash
print_product_label.exe F8AC119F ME-0005 3 4 F8AC119F 2025/12/08
```

**Output:**
```
Label data:
  Barcode: F8AC119F
  MN: ME-0005
  FW: 3
  BA: 4
  UID: F8AC119F
  Date: 2025/12/08
Creating barcode...
Building label image...
Saved preview: C:\Users\...\preview_label.png
Connecting to printer via USB...
Fetching printer status...
Status OK
Sending print job...
Print result OK

Print succeeded!
```

### Electron Integration

#### From Factory Testing Page

```javascript
// 1. Check printer before printing
const checkResult = await window.api.checkPrinterConnection();
if (!checkResult.connected) {
    alert('Printer not connected: ' + checkResult.error);
    return;
}

// 2. Prepare label data
const labelData = {
    barcode: deviceInfo.uid,
    mn: `${deviceInfo.deviceMake}-${deviceInfo.deviceModel}`,
    firmware: testResults.firmwareVersion,
    batchId: getBatchId(),
    uid: deviceInfo.uid,
    date: new Date().toISOString().slice(0, 10).replace(/-/g, '/')
};

// 3. Print label
const printResult = await window.api.printLabel(labelData);
if (printResult.success) {
    console.log('Label printed successfully');
} else {
    alert('Print failed: ' + printResult.error);
}
```

#### Main Process IPC Handlers

```javascript
// Check printer connection
ipcMain.handle('printer:checkConnection', async () => {
    const result = await checkPrinterConnection();
    return result;
});

// Print label
ipcMain.handle('printer:printLabel', async (event, payload) => {
    const result = await printLabel(payload);
    return result;
});
```

## API Reference

### Command Line Arguments

| Argument | Position | Type | Required | Description |
|----------|----------|------|----------|-------------|
| `--check` | Flag | boolean | No | Check printer connection only |
| `barcode` | 1 | string | Yes* | Barcode text for Code128 generation |
| `mn` | 2 | string | Yes* | Make and Model identifier |
| `firmware` | 3 | string | Yes* | Firmware version number |
| `batchId` | 4 | string | Yes* | Batch identifier |
| `uid` | 5 | string | Yes* | Unique device identifier |
| `date` | 6 | string | Yes* | Date in YYYY/MM/DD format |

*Required when printing (not with --check)

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (printer not found, USB error, or print failure) |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PRINTER_VID` | `0x04f9` | USB Vendor ID for Brother printers |
| `PRINTER_PID` | `0x2085` | USB Product ID for PT-P900W |
| `LABEL_DPI` | `300` | Label resolution in DPI |

## Configuration

### Label Template

Default label configuration (12mm tape):

```python
# Dimensions
LABEL_WIDTH_MM = 12      # Tape width
LABEL_HEIGHT_MM = 60     # Label length (adjustable)
DPI = 300                # Print resolution

# Layout
BARCODE_WIDTH_RATIO = 0.4    # 40% of width
BARCODE_HEIGHT_RATIO = 0.7   # 70% of height
TEXT_FONT_SIZE = 24          # Arial font size
```

### Printer Settings

Configure in `print_product_label.py`:

```python
# USB Device IDs
PRINTER_VID = 0x04f9  # Brother vendor ID
PRINTER_PID = 0x2085  # PT-P900W product ID

# Print Settings
PRINT_TIMEOUT = 5000  # 5 seconds
STATUS_CHECK_RETRIES = 3
```

### Customizing Label Layout

Modify the `create_label_image()` function:

```python
def create_label_image(barcode_text, mn, firmware, batch_id, uid, date):
    # Adjust dimensions
    width_px = mm_to_pixels(LABEL_HEIGHT_MM)
    height_px = mm_to_pixels(LABEL_WIDTH_MM)
    
    # Create image
    img = Image.new('RGB', (width_px, height_px), 'white')
    draw = ImageDraw.Draw(img)
    
    # Customize barcode position and size
    barcode_x = 10
    barcode_y = (height_px - barcode_height) // 2
    
    # Customize text layout
    text_x = barcode_x + barcode_width + 20
    text_y = 10
    line_height = 30
    
    # Add custom fields
    draw.text((text_x, text_y), f"MN: {mn}", fill='black')
    # ... more fields
    
    return img
```

## Troubleshooting

### Common Issues

#### 1. Printer Not Found

**Symptom:**
```
CHECK_FAILED: Brother PT-P900W (VID:PID=04f9:2085) not found
```

**Solutions:**
- Verify USB connection
- Check printer power
- Restart printer
- Check Windows Device Manager
- Try different USB port
- Update USB drivers

#### 2. libusb Error

**Symptom:**
```
ERROR: libusb not found
```

**Solutions:**
- Ensure `libusb-1.0.dll` is in the same directory as executable
- Download from: https://libusb.info/
- Place in `embedded/printer-scripts/` folder

#### 3. Print Job Sent but Nothing Prints

**Symptom:**
```
Print job sent successfully!
(but no physical label printed)
```

**Solutions:**
- Check tape cartridge is installed
- Verify correct tape width (12mm)
- Check printer LCD for error messages
- Ensure tape door is closed
- Try printing from P-touch Editor software to verify hardware

#### 4. Barcode Generation Error

**Symptom:**
```
ERROR: Barcode generation failed
```

**Solutions:**
- Verify barcode text is valid (alphanumeric)
- Check barcode length (max 20 characters recommended)
- Ensure `python-barcode` library is installed

#### 5. Python Not Found (Development)

**Symptom:**
```
Python not found. Please install Python from python.org
```

**Solutions:**
- Install Python 3.13+
- Add Python to PATH
- Use standalone executable instead

### Debug Mode

Enable verbose logging:

```bash
# Set environment variable
set PRINTER_DEBUG=1
print_product_label.exe F8AC119F ME-0005 3 4 F8AC119F 2025/12/08
```

### Log Files

Preview images are saved to:
```
Windows: C:\Users\<username>\AppData\Local\Temp\preview_label.png
```

View preview to verify label content before troubleshooting printer issues.

## Performance Optimization

### Print Speed

Typical print times:
- Connection check: 0.5s
- Label generation: 1.0s
- Print transmission: 1.5s
- **Total**: ~3 seconds per label

### Memory Usage

- Executable startup: ~30 MB
- During print: ~50 MB
- Peak memory: ~70 MB

### Batch Printing

For printing multiple labels:

```bash
# Loop in PowerShell
1..10 | ForEach-Object {
    .\print_product_label.exe "UID$_" ME-0005 3 4 "UID$_" 2025/12/08
    Start-Sleep -Seconds 1
}
```

## Best Practices

1. **Always check connection first**
   ```bash
   print_product_label.exe --check
   ```

2. **Validate input data**
   - Barcode: alphanumeric, max 20 chars
   - Date: YYYY/MM/DD format
   - UID: unique for traceability

3. **Handle errors gracefully**
   ```javascript
   try {
       const result = await window.api.printLabel(data);
       if (!result.success) {
           // Retry or log error
       }
   } catch (error) {
       console.error('Print failed:', error);
   }
   ```

4. **Monitor printer status**
   - Check tape level regularly
   - Clean print head periodically
   - Use genuine Brother TZe tape

## Advanced Usage

### Custom Barcode Types

Modify barcode generation:

```python
# In create_label_image()
from barcode import Code39, EAN13

# Use Code39 instead of Code128
Code39 = barcode.get_barcode_class('code39')
code39 = Code39(barcode_text, writer=ImageWriter())
```

### Multi-line Text

Add more information to labels:

```python
# Add extra fields
draw.text((text_x, text_y), f"MN: {mn}", fill='black')
text_y += line_height
draw.text((text_x, text_y), f"SN: {serial_number}", fill='black')
text_y += line_height
draw.text((text_x, text_y), f"MAC: {mac_address}", fill='black')
```

### Different Tape Sizes

Support for different tape widths:

```python
# 9mm tape
LABEL_WIDTH_MM = 9
LABEL_HEIGHT_MM = 50

# 18mm tape
LABEL_WIDTH_MM = 18
LABEL_HEIGHT_MM = 70
```

## Appendix

### Supported Printers

Currently tested:
- Brother PT-P900W (USB)

Potentially compatible:
- Brother PT-P950NW
- Brother PT-P750W
- Other Brother P-touch P-series models

### Dependencies

| Library | Version | Purpose |
|---------|---------|---------|
| PIL (Pillow) | 10.0+ | Image generation |
| python-barcode | 0.15+ | Barcode generation |
| brother_ql | 0.9.4+ | Brother QL-series support |
| pyusb | 1.2.1+ | USB communication |
| brotherlabel | custom | PT-P900W support |
| libusb-1.0 | 1.0.26 | USB driver |

### Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-08 | Initial standalone executable |
| 0.9.0 | 2025-12-07 | USB driver integration |
| 0.5.0 | 2025-12-06 | Basic printing functionality |
