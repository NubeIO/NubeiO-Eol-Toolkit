#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Product Label Printer for Brother PT-P900W (Windows Driver Version)
Prints labels via Windows printer driver with barcode, device info, and date
"""

import sys
import os
import tempfile
from PIL import Image, ImageDraw, ImageFont
import barcode
from barcode.writer import ImageWriter
from io import BytesIO
import win32print
import win32ui
from PIL import ImageWin

# Constants
PRINTER_NAME = "Brother PT-P900W"  # Update this to match your printer name in Windows
LABEL_WIDTH_MM = 12  # 12mm tape width
LABEL_HEIGHT_MM = 60  # Label length
DPI = 300  # Print resolution

# Convert mm to pixels
def mm_to_pixels(mm, dpi=DPI):
    return int((mm / 25.4) * dpi)

def find_printer():
    """Find the Brother PT-P900W printer in Windows"""
    printers = [printer[2] for printer in win32print.EnumPrinters(2)]
    
    # Try exact match first
    if PRINTER_NAME in printers:
        print(f"Found printer: {PRINTER_NAME}")
        return PRINTER_NAME
    
    # Try partial match
    for printer in printers:
        if "PT-P900W" in printer or "PT-P900" in printer:
            print(f"Found printer: {printer}")
            return printer
    
    # List available printers
    print("Available printers:")
    for printer in printers:
        print(f"  - {printer}")
    
    raise Exception(f"Printer not found. Looking for: {PRINTER_NAME}")

def create_label_image(barcode_text, mn, firmware, batch_id, uid, date):
    """Create label image with barcode and text"""
    # Calculate dimensions in pixels
    width_px = mm_to_pixels(LABEL_HEIGHT_MM)  # Width is the length direction
    height_px = mm_to_pixels(LABEL_WIDTH_MM)  # Height is the tape width
    
    print(f"Creating label: {width_px}x{height_px} pixels")
    
    # Create white background
    img = Image.new('RGB', (width_px, height_px), 'white')
    draw = ImageDraw.Draw(img)
    
    # Generate barcode
    try:
        Code128 = barcode.get_barcode_class('code128')
        code128 = Code128(barcode_text, writer=ImageWriter())
        
        # Render barcode to BytesIO
        barcode_io = BytesIO()
        code128.write(barcode_io, options={
            'module_height': 6.0,  # Reduced height for small tape
            'module_width': 0.15,  # Narrow bars
            'quiet_zone': 2.0,
            'font_size': 0,  # No text under barcode
            'text_distance': 1.0,
            'write_text': False  # Don't write text under barcode
        })
        barcode_io.seek(0)
        barcode_img = Image.open(barcode_io)
        
        # Resize barcode to fit
        barcode_width = int(width_px * 0.4)  # 40% of width
        barcode_height = int(height_px * 0.7)  # 70% of height
        barcode_img = barcode_img.resize((barcode_width, barcode_height), Image.Resampling.LANCZOS)
        
        # Paste barcode on left side
        barcode_x = 10
        barcode_y = (height_px - barcode_height) // 2
        img.paste(barcode_img, (barcode_x, barcode_y))
        
    except Exception as e:
        print(f"Barcode generation error: {e}")
    
    # Add text labels on the right
    try:
        # Try to use a system font
        try:
            font_small = ImageFont.truetype("arial.ttf", 24)
            font_tiny = ImageFont.truetype("arial.ttf", 20)
        except:
            font_small = ImageFont.load_default()
            font_tiny = ImageFont.load_default()
        
        text_x = barcode_x + barcode_width + 20
        text_y = 10
        line_height = 30
        
        # Draw text fields
        draw.text((text_x, text_y), f"MN: {mn}", fill='black', font=font_small)
        text_y += line_height
        draw.text((text_x, text_y), f"FW: {firmware}", fill='black', font=font_small)
        text_y += line_height
        draw.text((text_x, text_y), f"BA: {batch_id}", fill='black', font=font_small)
        text_y += line_height
        draw.text((text_x, text_y), f"UID: {uid}", fill='black', font=font_tiny)
        text_y += line_height
        draw.text((text_x, text_y), f"{date}", fill='black', font=font_tiny)
        
    except Exception as e:
        print(f"Text rendering error: {e}")
    
    return img

def print_label_windows(label_img, printer_name):
    """Print label image using Windows printer driver"""
    print(f"Printing to: {printer_name}")
    
    # Create a device context
    hDC = win32ui.CreateDC()
    hDC.CreatePrinterDC(printer_name)
    
    # Start print job
    hDC.StartDoc("Product Label")
    hDC.StartPage()
    
    # Get printer resolution
    printer_size_x = hDC.GetDeviceCaps(8)  # HORZRES
    printer_size_y = hDC.GetDeviceCaps(10)  # VERTRES
    
    print(f"Printer resolution: {printer_size_x}x{printer_size_y}")
    
    # Convert PIL image to Windows DIB
    dib = ImageWin.Dib(label_img)
    
    # Calculate scaling to fit printer
    scale_x = printer_size_x / label_img.width
    scale_y = printer_size_y / label_img.height
    scale = min(scale_x, scale_y)
    
    dest_width = int(label_img.width * scale)
    dest_height = int(label_img.height * scale)
    
    # Center the image
    x = (printer_size_x - dest_width) // 2
    y = (printer_size_y - dest_height) // 2
    
    # Draw image
    dib.draw(hDC.GetHandleOutput(), (x, y, x + dest_width, y + dest_height))
    
    # End print job
    hDC.EndPage()
    hDC.EndDoc()
    hDC.DeleteDC()
    
    print("Print job sent successfully!")

def check_printer_connection():
    """Check if printer is available"""
    try:
        printer_name = find_printer()
        print(f"CHECK_STATUS_OK")
        return True
    except Exception as e:
        print(f"CHECK_FAILED: {e}")
        return False

def main():
    """Main function"""
    if len(sys.argv) > 1 and sys.argv[1] == '--check':
        # Check printer connection
        sys.exit(0 if check_printer_connection() else 1)
    
    if len(sys.argv) < 7:
        print("Usage: print_product_label.py <barcode> <mn> <firmware> <batchId> <uid> <date>")
        print("   or: print_product_label.py --check")
        sys.exit(1)
    
    # Parse arguments
    barcode_text = sys.argv[1]
    mn = sys.argv[2]
    firmware = sys.argv[3]
    batch_id = sys.argv[4]
    uid = sys.argv[5]
    date = sys.argv[6]
    
    print(f"Label data:")
    print(f"  Barcode: {barcode_text}")
    print(f"  MN: {mn}")
    print(f"  FW: {firmware}")
    print(f"  BA: {batch_id}")
    print(f"  UID: {uid}")
    print(f"  Date: {date}")
    
    try:
        # Find printer
        printer_name = find_printer()
        
        # Create label image
        print("Creating label image...")
        label_img = create_label_image(barcode_text, mn, firmware, batch_id, uid, date)
        
        # Save preview
        preview_path = os.path.join(tempfile.gettempdir(), 'preview_label.png')
        label_img.save(preview_path)
        print(f"Preview saved: {preview_path}")
        
        # Print label
        print_label_windows(label_img, printer_name)
        
        print("SUCCESS")
        sys.exit(0)
        
    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()
