# Hướng Dẫn Chạy Thử py-brotherlabel

Repo `py-brotherlabel` là thư viện Python điều khiển máy in PT-P900W/PT-P950NW, hỗ trợ USB và TCP.

## Cài Đặt

1. Cài package từ folder local:
```powershell
cd c:\Users\nhthinh\Desktop\Nube-iO\NubeiO-print-bar-code\py-brotherlabel
pip install -e .
```
(Hoặc cài dependencies riêng: `pip install Pillow pyusb`)

2. Kiểm tra cài đặt:
```powershell
python -c "import brotherlabel; print('OK')"
```

## Chạy Ví Dụ USB

File `example_usb.py` minh họa in qua USB. Cần sửa device ID cho đúng:

**Bước 1: Tìm Device ID**
- Sau khi đổi driver bằng Zadig (WinUSB), chạy:
```powershell
python -c "import usb.core; devs=list(usb.core.find(find_all=True,idVendor=0x04f9)); print([(hex(d.idVendor),hex(d.idProduct)) for d in devs])"
```
- VD kết quả: `[('0x4f9', '0x2086')]` → PID = 0x2086.

**Bước 2: Sửa example_usb.py**
Mở file `example_usb.py`, sửa dòng:
```python
backend = brotherlabel.USBBackend("usb://0x04f9:0x2086")
```
Thay `0x2086` bằng PID thực tế (PT-P900W thường 0x2085 hoặc 0x2086).

**Bước 3: Chạy**
```powershell
cd c:\Users\nhthinh\Desktop\Nube-iO\NubeiO-print-bar-code\py-brotherlabel
python example_usb.py
```
- Nếu thành công: máy in phun nhãn từ file `label_12mm_high.png`.
- Nếu lỗi "No backend available": làm theo hướng dẫn Zadig (như đã nói ở trên).

## Chạy Ví Dụ Network (TCP)

Nếu máy in đã kết nối Wi-Fi/LAN:

**Bước 1: Tìm IP máy in**
- Xem LCD của máy in (Settings > Network > IP Address).
- Hoặc kiểm tra router để tìm thiết bị Brother.

**Bước 2: Sửa example_tcp.py**
Mở `example_tcp.py`, sửa:
```python
backend = brotherlabel.NetworkBackend("tcp://192.168.0.10")
```
→ Thay `192.168.0.10` bằng IP thực tế.

**Bước 3: Chạy**
```powershell
python example_tcp.py
```
Máy in sẽ in nhãn qua mạng.

## Tự Tạo Ảnh Nhãn Để In

Thư viện yêu cầu ảnh đầu vào có chiều ngang khớp với băng:
- TZe 12mm: chiều ngang ~128 dots (ảnh example: `label_12mm_high.png`).
- TZe 18mm: ~192 dots.
- TZe 24mm: ~256 dots.

Tạo ảnh bằng PIL:
```python
from PIL import Image, ImageDraw, ImageFont

img = Image.new('L', (128, 300), 255)  # 12mm tape, chiều dài 300 dots
draw = ImageDraw.Draw(img)
font = ImageFont.load_default()
draw.text((10, 140), "Test Label", font=font, fill=0)
img.save("test_label.png")

# In:
import brotherlabel
backend = brotherlabel.USBBackend("usb://0x04f9:0x2086")  # hoặc NetworkBackend
printer = brotherlabel.PTPrinter(backend)
printer.tape = brotherlabel.Tape.TZe12mm
printer.quality = brotherlabel.Quality.high_resolution
printer.margin = 0
print(printer.print([img]).to_string())
```

## Ghi Chú Quan Trọng

- **USB**: Yêu cầu driver WinUSB/libusbK (Zadig). Sau khi đổi, thiết bị không còn in bình thường qua Windows print queue được nữa (chỉ qua code).
- **Network**: Không cần đổi driver, dễ dùng hơn.
- Thư viện này khác với `brother-label` (package bạn dùng ở script trước). `py-brotherlabel` đơn giản hơn, chỉ hỗ trợ PT series.
- File ảnh mẫu (`label_12mm_high.png`) có sẵn trong repo để test nhanh.

## Kiểm Tra Trạng Thái Máy In

```python
import brotherlabel
backend = brotherlabel.USBBackend("usb://0x04f9:0x2086")  # hoặc NetworkBackend
printer = brotherlabel.PTPrinter(backend)
status = printer.get_status()
print(status.to_string())
```
Hiển thị trạng thái máy in (giấy, lỗi, v.v.).

## Xử Lý Lỗi Thường Gặp

- **"No backend available"**: Chưa đổi driver WinUSB hoặc thiếu `libusb-1.0.dll`.
- **"Access denied"**: Quyền truy cập USB (Windows thường không gặp nếu đã đổi driver đúng).
- **Không tìm thấy thiết bị**: Kiểm tra VID:PID, rút/cắm lại, khởi động lại.
- **Ảnh không in đúng**: Sai chiều ngang (phải khớp băng nhãn).

Nếu cần thêm giúp đỡ (tạo script in barcode, in nhiều nhãn), báo tôi. Bây giờ bạn hãy thử:
```powershell
cd c:\Users\nhthinh\Desktop\Nube-iO\NubeiO-print-bar-code\py-brotherlabel
pip install -e .
python example_usb.py
```
(Hoặc dùng `example_tcp.py` nếu có IP). Cho tôi biết kết quả!
