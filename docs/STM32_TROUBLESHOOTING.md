# STM32 Flasher - Troubleshooting Guide

## Common Errors and Solutions

### ❌ "init mode failed (unable to connect to the target)"

**Nguyên nhân:**
- MCU đang chạy firmware tắt SWD debug
- Read Protection Level (RDP) được bật
- Kết nối dây SWDIO/SWCLK không ổn định
- Nguồn không đủ

**Giải pháp:**

#### 1. Đưa MCU vào BOOT Mode
```
Cách 1: Hardware Reset
1. Ngắt nguồn STM32
2. Kết nối BOOT0 lên VCC (3.3V)  
3. Cấp nguồn lại
4. Nhấn nút Flash trong tool
5. Ngắt nguồn và tháo BOOT0 khỏi VCC

Cách 2: NRST Pin
1. Giữ nút RESET (hoặc pull NRST xuống GND)
2. Nhấn nút "Detect ST-Link" trong tool
3. Thả nút RESET ngay sau khi nhấn Detect
```

#### 2. Kiểm tra Read Protection
Nếu thấy log: **"RDP level 1"** hoặc **"RDP level 2"**

```bash
# RDP Level 1: Flash bị khóa, có thể mở nhưng sẽ XÓA toàn bộ flash
# RDP Level 2: Khóa vĩnh viễn, KHÔNG THỂ mở!

# Để mở RDP Level 1 (sẽ xóa toàn bộ flash):
openocd.exe -f interface/stlink.cfg -f target/stm32wlx.cfg \
  -c "init" \
  -c "halt" \
  -c "stm32l4x unlock 0" \
  -c "reset" \
  -c "shutdown"
```

⚠️ **CẢNH BÁO:** Mở RDP Level 1 sẽ **XÓA TOÀN BỘ** firmware và data trong flash!

#### 3. Kiểm tra kết nối dây
```
ST-Link          STM32WLE5
--------         ----------
VDD (3.3V)  -->  VDD
GND         -->  GND  
SWDIO       -->  PA13 (SWDIO)
SWCLK       -->  PA14 (SWCLK)
NRST        -->  NRST (optional, nhưng khuyên dùng)
```

#### 4. Kiểm tra nguồn
- Target voltage phải: **3.0V - 3.6V**
- Nếu dưới 3.0V: Nguồn yếu, không flash được
- Nếu trên 3.6V: Nguy cơ hỏng chip!

---

### ❌ "Fail reading CTRL/STAT register. Force reconnect"

**Nguyên nhân:**
- Mất kết nối SWD trong lúc giao tiếp
- MCU bị reset bất ngờ
- Firmware đang chạy can thiệp vào debug interface

**Giải pháp:**
1. **Hard reset trước khi flash:**
   - Ngắt nguồn STM32 hoàn toàn
   - Đợi 3 giây
   - Cấp nguồn lại
   - Flash ngay lập tức

2. **Sử dụng NRST:**
   - Kết nối dây NRST từ ST-Link sang STM32
   - Tool sẽ tự động reset MCU trước khi flash

3. **Kiểm tra dây cáp:**
   - Dây SWDIO/SWCLK có thể bị lỏng
   - Thử dây khác hoặc rút cắm lại

---

### ❌ "Failed to write memory"

**Nguyên nhân:**
- Flash bị write-protected
- RDP level 1/2
- Firmware đang chạy làm flash busy

**Giải pháp:**
1. Đưa MCU vào BOOT mode (xem hướng dẫn trên)
2. Nếu có RDP: Mở khóa bằng lệnh `stm32l4x unlock 0`
3. Thử flash lại

---

### ❌ "Error closing APs"

**Nguyên nhân:**
- Xảy ra sau khi flash/read bị lỗi
- OpenOCD không đóng được Access Points

**Giải pháp:**
- Ngắt nguồn STM32 hoàn toàn
- Rút ST-Link khỏi USB
- Cắm lại và thử lại

---

## Workflow Flash Thành Công

### Bước 1: Kiểm tra phần cứng
```
✅ ST-Link cắm USB
✅ Dây nối: VDD, GND, SWDIO, SWCLK, NRST
✅ Target voltage: 3.2V - 3.3V
✅ Không có short circuit
```

### Bước 2: Detect MCU
```
1. Click "Detect ST-Link"
2. Xem thông tin MCU hiển thị
3. Nếu lỗi "init mode failed":
   - Đưa MCU vào BOOT mode
   - Thử lại
```

### Bước 3: Flash Firmware
```
1. Set Droplet Version (0-255)
2. Click "Select Firmware" (.bin file)
3. Click "Flash Firmware"
4. Đợi 30-60 giây
5. Kiểm tra MAC address hiển thị
```

### Bước 4: Xác nhận
```
✅ Flash success
✅ UID đọc được (12 bytes)
✅ MAC address tính toán đúng
✅ Device chạy firmware mới
```

---

## Lệnh OpenOCD Hữu Ích

### Detect MCU
```bash
openocd -f interface/stlink.cfg -f target/stm32wlx.cfg \
  -c "init" \
  -c "shutdown"
```

### Flash Firmware
```bash
openocd -f interface/stlink.cfg -f target/stm32wlx.cfg \
  -c "init" \
  -c "reset halt" \
  -c "flash write_image erase firmware.bin 0x08000000" \
  -c "verify_image firmware.bin 0x08000000" \
  -c "reset run" \
  -c "shutdown"
```

### Read UID
```bash
openocd -f interface/stlink.cfg -f target/stm32wlx.cfg \
  -c "init" \
  -c "reset halt" \
  -c "mdw 0x1FFF7590 3" \
  -c "shutdown"
```

### Unlock RDP Level 1 (XÓA FLASH!)
```bash
openocd -f interface/stlink.cfg -f target/stm32wlx.cfg \
  -c "init" \
  -c "halt" \
  -c "stm32l4x unlock 0" \
  -c "reset" \
  -c "shutdown"
```

### Erase Full Flash
```bash
openocd -f interface/stlink.cfg -f target/stm32wlx.cfg \
  -c "init" \
  -c "reset halt" \
  -c "stm32l4x mass_erase 0" \
  -c "shutdown"
```

---

## Tips & Tricks

### 🔧 Nếu không connect được:
1. **Thử giảm tốc độ SWD:**
   ```
   adapter speed 100  # Thay vì 480 kHz
   ```

2. **Thử connect_assert_srst:**
   ```
   reset_config connect_assert_srst
   ```

3. **Thử JTAG thay vì SWD:**
   ```
   transport select jtag
   ```

### 🔋 Kiểm tra nguồn:
```bash
openocd -f interface/stlink.cfg -f target/stm32wlx.cfg \
  -c "init" -c "shutdown"
  
# Xem dòng: Info : Target voltage: X.XXXXXX
```

### 🐛 Debug OpenOCD:
Thêm `-d3` để xem chi tiết:
```bash
openocd -d3 -f interface/stlink.cfg -f target/stm32wlx.cfg \
  -c "init" -c "shutdown"
```

---

## Liên Hệ Hỗ Trợ

Nếu vẫn gặp vấn đề:
1. Chụp ảnh kết nối dây
2. Copy toàn bộ log OpenOCD
3. Ghi rõ: Loại board, firmware version, các bước đã thử

**Email:** support@nube-io.com
