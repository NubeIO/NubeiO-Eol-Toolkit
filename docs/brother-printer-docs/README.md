# Brother PT-P900W Printer Integration Documentation

## Overview

This documentation covers the Brother PT-P900W label printer integration for the Nube iO Toolkit. The system allows printing product labels with barcodes during factory testing without requiring Python installation on end-user machines.

## Table of Contents

1. [Architecture Overview](./ARCHITECTURE.md)
2. [Software Manual](./SOFTWARE_MANUAL.md)
3. [Class & Method Reference](./CLASS_REFERENCE.md)
4. [Sequence Diagrams](./SEQUENCE_DIAGRAMS.md)
5. [State Diagrams](./STATE_DIAGRAMS.md)
6. [Deployment Guide](./DEPLOYMENT.md)

## Quick Start

### For Developers

1. **Development Mode** (with Python installed):
   ```bash
   cd embedded/printer-scripts
   python print_product_label.py --check
   ```

2. **Production Build**:
   ```bash
   # Build standalone executable
   python build_exe.py
   
   # Build Electron app
   npm run build:win
   ```

### For End Users

The printer functionality is fully integrated into the application. No Python installation required.

1. Connect Brother PT-P900W via USB
2. Load 12mm TZe tape
3. Use the Factory Testing module to print labels

## System Requirements

- **Printer**: Brother PT-P900W
- **Tape**: 12mm TZe laminated tape
- **Connection**: USB 2.0 or higher
- **OS**: Windows 10/11 (64-bit)

## Key Features

- ✅ Barcode generation (Code128)
- ✅ Product information labels
- ✅ Standalone executable (no Python required)
- ✅ USB communication via libusb
- ✅ Automatic printer detection
- ✅ Preview label generation

## Documentation Files

- **ARCHITECTURE.md** - System architecture and component diagrams
- **SOFTWARE_MANUAL.md** - User guide and operation manual
- **CLASS_REFERENCE.md** - API reference for all classes and methods
- **SEQUENCE_DIAGRAMS.md** - Detailed workflow diagrams
- **STATE_DIAGRAMS.md** - State machine documentation
- **DEPLOYMENT.md** - Build and deployment instructions
