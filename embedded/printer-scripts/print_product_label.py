#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Command-line wrapper for Brother PT-P900W label printing.
Called from Electron: python print_product_label.py <barcode> <mn> <firmware> <batchId> <uid> <date>
"""
import sys
import os
import time
from datetime import datetime

# Ensure local py-brotherlabel is importable
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BROTHERLABEL_PATH = os.path.join(CURRENT_DIR, 'py-brotherlabel')
sys.path.insert(0, BROTHERLABEL_PATH)

try:
    from PIL import Image, ImageDraw, ImageFont
    import barcode
    from barcode.writer import ImageWriter
except ImportError as e:
    print(f"ERROR: Missing dependency: {e}")
    print("Install with: pip install Pillow python-barcode")
    sys.exit(1)

try:
    import brotherlabel
    import usb.backend.libusb1
except ImportError:
    print("ERROR: brotherlabel not installed")
    sys.exit(1)

# Patch brotherlabel USB to use libusb-1.0.dll
DLL_PATH = os.path.join(os.path.dirname(sys.executable), 'libusb-1.0.dll')
if not os.path.exists(DLL_PATH):
    alt_paths = [
        os.path.join(CURRENT_DIR, 'libusb-1.0.dll'),
        os.path.join(os.path.dirname(CURRENT_DIR), 'libusb-1.0.dll'),
    ]
    for p in alt_paths:
        if os.path.exists(p):
            DLL_PATH = p
            break

print(f"Using libusb: {DLL_PATH}")
usb_backend = usb.backend.libusb1.get_backend(find_library=lambda x: DLL_PATH)
import brotherlabel.backends.usb as usb_module
_original_find = usb_module.usb.core.find

def _patched_find(*args, **kwargs):
    kwargs['backend'] = usb_backend
    return _original_find(*args, **kwargs)

usb_module.usb.core.find = _patched_find

def connect_printer():
    """Return configured Brother PT-P900W printer instance."""
    print("Connecting to printer via USB...")
    backend = brotherlabel.USBBackend("usb://0x04f9:0x2085")
    printer = brotherlabel.PTPrinter(backend)

    # Configure printer defaults
    printer.quality = brotherlabel.Quality.high_resolution
    printer.tape = brotherlabel.Tape.TZe12mm
    printer.margin = 3
    printer.auto_cut = True
    printer.half_cut = False

    if hasattr(printer, 'end_feed'):
        printer.end_feed = 64

    return printer

def _is_access_denied(exc):
    message = str(exc).lower()
    if 'access denied' in message or 'errno 13' in message:
        return True
    errno = getattr(exc, 'errno', None)
    return errno == 13


def _dispose_printer(printer):
    if not printer:
        return
    try:
        backend = getattr(printer, 'backend', None)
        if backend and hasattr(backend, 'dispose'):
            backend.dispose()
    except Exception as dispose_error:
        print(f"CHECK_DISPOSE_WARN: {dispose_error}")


def check_printer_connection(max_attempts: int = 3, retry_delay: float = 0.6):
    """Attempt to open the printer and fetch status; return True on success."""
    last_error = None

    for attempt in range(1, max_attempts + 1):
        printer = None
        try:
            printer = connect_printer()
            try:
                printer.get_status()
                print("CHECK_STATUS_OK")
            except Exception as status_error:
                print(f"CHECK_STATUS_WARN: {status_error}")
            return True
        except Exception as exc:
            last_error = exc
            print(f"CHECK_FAILED_ATTEMPT_{attempt}: {exc}")
            if attempt < max_attempts and _is_access_denied(exc):
                time.sleep(retry_delay)
                continue
            break
        finally:
            _dispose_printer(printer)

    if last_error is not None:
        print(f"CHECK_FAILED: {last_error}")
    return False

def create_product_label(barcode_data, mn_text, sw_text, ba_text, product_code, date_text):
    """
    Build a product label with a horizontal Code128 barcode and text fields.
    This is the exact format from the original working version.
    
    Args:
        barcode_data: Barcode data string (e.g., "ME051EACDADB")
        mn_text: Model number text (e.g., "ME-05-N1")
        sw_text: Software version text (e.g., "1.3.6")
        ba_text: BA code text (e.g., "01202434")
        product_code: Product code line (e.g., "ME-05-1EACDADB")
        date_text: Date text (e.g., "2024/11/08")
    """
    from io import BytesIO
    
    # Create barcode
    print("Creating barcode...")
    code128 = barcode.get_barcode_class('code128')
    barcode_img = code128(barcode_data, writer=ImageWriter())

    # Render barcode to memory buffer (PNG)
    buffer = BytesIO()
    barcode_img.write(buffer, {
        'module_height': 28,  # Barcode bar height
        'module_width': 0.5,  # Barcode bar width
        'quiet_zone': 3,
        'font_size': 25,  # Human-readable UID text under barcode (increased from 23 to 25)
        'text_distance': 10,  # Gap between bars and text (increased from 8 to 10 to lower text more)
        'write_text': True
    })
    buffer.seek(0)

    # Load barcode image and convert to grayscale ('L')
    barcode_pil = Image.open(buffer).convert('L')

    # Do not rotate - keep barcode horizontal
    # Resize barcode to fit 12mm tape height in dots
    barcode_display_height = 138
    aspect_ratio = barcode_pil.width / barcode_pil.height
    barcode_display_width = int(barcode_display_height * aspect_ratio * 1.96)  # Increased by 40% again (1.4 * 1.4)
    barcode_resized = barcode_pil.resize((barcode_display_width, barcode_display_height), Image.LANCZOS)

    # Create main label canvas
    print("Building label image...")
    label_width = barcode_display_width + 950  # Extra width for 50mm total length
    label_height = 160  # Overall label height (dots) - 12mm width at 180 dpi

    img = Image.new('L', (label_width, label_height), 255)
    draw = ImageDraw.Draw(img)

    # Fonts - choose Arial if available, fallback to PIL default
    try:
        font_medium = ImageFont.truetype("arial.ttf", 42)  # Increased from 38
        font_small = ImageFont.truetype("arial.ttf", 38)   # Increased from 33
        font_tiny = ImageFont.truetype("arial.ttf", 32)    # Increased from 27
    except:
        font_medium = ImageFont.load_default()
        font_small = ImageFont.load_default()
        font_tiny = ImageFont.load_default()

    # Paste barcode on the left (horizontal)
    barcode_x = 10
    barcode_y = (label_height - barcode_display_height) // 2
    img.paste(barcode_resized, (barcode_x, barcode_y))

    # Draw text to the right of the barcode (positioned near right edge)
    text_x = label_width - 480  # Position text
    y_pos = 0  # Start at top (moved up from 2 to 0)

    # MN
    draw.text((text_x, y_pos), f"MN:{mn_text}", font=font_small, fill=0)
    y_pos += 35  # Increased from 28 to 35 for more vertical spacing

    # SW
    draw.text((text_x, y_pos), f"SW:{sw_text}", font=font_small, fill=0)
    y_pos += 35  # Increased from 28 to 35

    # BA
    draw.text((text_x, y_pos), f"BA:{ba_text}", font=font_small, fill=0)
    y_pos += 32  # Increased from 28 to 32

    # Product code (smaller font)
    draw.text((text_x, y_pos), product_code, font=font_tiny, fill=0)
    y_pos += 30  # Increased from 24 to 30

    # Date + time (HH:MM)
    draw.text((text_x, y_pos), date_text, font=font_tiny, fill=0)

    # Border - fully flush with paper edges
    draw.rectangle([(8, 0), (label_width-9, label_height-1)], outline=0, width=4)

    # Keep mode 'L' (grayscale) – works with PT-P900W raster engine
    # No invert/convert needed

    return img

def print_label(barcode_data, mn_text, fw_text, ba_text, uid_text, date_text):
    """Create and print label via Brother PT-P900W USB."""
    
    # Create label with matching format (product_code = uid_text for display)
    label_img = create_product_label(barcode_data, mn_text, fw_text, ba_text, uid_text, date_text)
    
    # Save preview
    preview_path = os.path.join(CURRENT_DIR, 'preview_label.png')
    label_img.save(preview_path)
    print(f"Saved preview: {preview_path}")
    
    # Connect to printer
    try:
        printer = connect_printer()
        
        # Get status
        print("Fetching printer status...")
        try:
            status = printer.get_status()
            print("Status OK")
        except Exception as e:
            print(f"Status warning: {e}")
        
        # Print
        print("Sending print job...")
        result = printer.print([label_img])
        print("Print result OK")
        
        print("\nPrint succeeded!")
        
    except Exception as e:
        print(f"\nPrint error: {e}")
        import traceback
        traceback.print_exc()
        raise

def main():
    """Main entry point - parse command line arguments and print."""
    if len(sys.argv) >= 2 and sys.argv[1] == '--check':
        print("Checking printer connection...")
        if check_printer_connection():
            sys.exit(0)
        sys.exit(1)

    # Parse arguments: <script> <barcode> <mn> <firmware> <batchId> <uid> <date>
    if len(sys.argv) < 2:
        print("Usage: python print_product_label.py <barcode> <mn> <firmware> <batchId> <uid> <date>")
        print("Or:   python print_product_label.py --check")
        sys.exit(1)
    
    barcode_data = sys.argv[1] if len(sys.argv) > 1 else ""
    mn_text = sys.argv[2] if len(sys.argv) > 2 else ""
    fw_text = sys.argv[3] if len(sys.argv) > 3 else ""
    ba_text = sys.argv[4] if len(sys.argv) > 4 else ""
    uid_text = sys.argv[5] if len(sys.argv) > 5 else ""
    date_text = sys.argv[6] if len(sys.argv) > 6 else datetime.now().strftime("%Y/%m/%d")
    
    print(f"Label data:")
    print(f"  Barcode: {barcode_data}")
    print(f"  MN: {mn_text}")
    print(f"  FW: {fw_text}")
    print(f"  BA: {ba_text}")
    print(f"  UID: {uid_text}")
    print(f"  Date: {date_text}")
    
    try:
        print_label(barcode_data, mn_text, fw_text, ba_text, uid_text, date_text)
        sys.exit(0)
    except Exception as e:
        print(f"\nERROR: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
