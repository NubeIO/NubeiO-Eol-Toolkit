# Hướng dẫn sử dụng STM32 Flasher

## Các bước sử dụng:

### Bước 1: Detect ST-Link
1. Kết nối ST-Link V2/V3 với máy tính qua USB
2. Kết nối ST-Link với STM32WLE5:
   - VCC → 3.3V
   - GND → GND  
   - SWDIO → PA13
   - SWCLK → PA14
   - NRST → NRST (optional)
3. Nhấn nút **"Detect ST-Link"**
4. Nếu thành công, sẽ hiển thị thông tin MCU

### Bước 2: Cài đặt Version
- Nhập version cho Droplet (0-255)
- Version này được dùng trong byte 2 của MAC address
- Mặc định: 1 (0x01)

### Bước 3: Chọn Firmware
- Nhấn **"Browse"** để chọn file firmware
- Hỗ trợ: `.bin` và `.hex`
- File sẽ hiển thị sau khi chọn

### Bước 4: Flash & Read
- **Flash & Read Info**: Flash firmware + đọc UID + tính MAC
- **Read Info Only**: Chỉ đọc UID và tính MAC (không flash)

## Kết quả hiển thị:
- **UID0, UID1, UID2**: Unique ID từ chip
- **MAC (Hex)**: Địa chỉ 32-bit (ví dụ: 0xABCDEF01)
- **MAC (Formatted)**: Định dạng AA:BB:CC:DD
- **MAC (Decimal)**: Giá trị thập phân
- **Version**: Phiên bản Droplet
- **UID XOR**: Kết quả XOR của 3 UID

## Xử lý lỗi:
- **ST-Link not detected**: Kiểm tra kết nối USB và driver
- **Flash failed**: Kiểm tra nguồn điện target và kết nối SWD
- **OpenOCD not found**: Kiểm tra file trong embedded/openocd-binaries/

## Copy MAC Address:
Nhấn nút **"Copy MAC Address"** để copy vào clipboard
