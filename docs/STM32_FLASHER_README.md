# STM32 Droplet Flasher

Tính năng flash firmware cho STM32WLE5 Droplet devices và đọc thông tin địa chỉ MAC.

## Tính năng

- ✅ Flash firmware (.bin hoặc .hex) cho STM32WLE5
- ✅ Đọc Unique ID (UID) từ chip
- ✅ Tính toán địa chỉ MAC4 theo thuật toán Droplet
- ✅ Hiển thị thông tin chi tiết về thiết bị
- ✅ Copy MAC address dễ dàng

## Yêu cầu

- ST-Link V2/V3 debugger
- OpenOCD binary (đã được tích hợp sẵn trong thư mục embedded)
- STM32WLE5 target device

## Cách sử dụng

### 1. Kết nối phần cứng

Kết nối ST-Link với STM32WLE5 qua SWD:
- VCC -> 3.3V
- GND -> GND
- SWDIO -> PA13
- SWCLK -> PA14
- NRST -> NRST (optional nhưng khuyên dùng)

### 2. Chọn Firmware

1. Nhấn nút **Browse** để chọn file firmware
2. Hỗ trợ các định dạng: `.bin`, `.hex`

### 3. Cài đặt Version

- Nhập version cho Droplet (0-255)
- Version này được sử dụng trong byte 2 của địa chỉ MAC4
- Mặc định: 0x01

### 4. Flash và Đọc Info

Nhấn nút **Flash & Read Info** để:
1. Flash firmware vào STM32WLE5
2. Verify firmware đã flash
3. Đọc Unique ID từ địa chỉ 0x1FFF7590
4. Tính toán địa chỉ MAC4

### 5. Chỉ Đọc Info

Nếu đã flash trước đó, có thể nhấn **Read Info Only** để chỉ đọc UID và tính MAC.

## Thuật toán MAC4

Địa chỉ MAC4 được tính theo công thức:

```c
uint32_t GenerateMAC4(void) {
  uint32_t uid0 = *(uint32_t *)0x1FFF7590;
  uint32_t uid1 = *(uint32_t *)0x1FFF7594;
  uint32_t uid2 = *(uint32_t *)0x1FFF7598;
  uint32_t uid_temp = uid0 ^ uid1 ^ uid2;

  uint32_t mac = ((uid_temp >> 24) & 0xFF) << 24 |  // byte 1
                 (VERSION << 16) |                  // byte 2
                 ((uid_temp >> 8) & 0xFF) << 8 |    // byte 3
                 (uid_temp & 0xFF);                 // byte 4

  return mac;
}
```

**Kết quả hiển thị:**
- MAC (Hex): `0xABCDEF01`
- MAC (Formatted): `AB:CD:EF:01`
- MAC (Decimal): `2882400001`

## Thông tin hiển thị

### Unique ID
- **UID0**: Register tại 0x1FFF7590
- **UID1**: Register tại 0x1FFF7594
- **UID2**: Register tại 0x1FFF7598

### MAC Address
- **MAC (Hex)**: Địa chỉ 32-bit dạng hex
- **MAC (Formatted)**: Định dạng AA:BB:CC:DD
- **MAC (Decimal)**: Giá trị thập phân
- **Version**: Phiên bản Droplet
- **UID XOR**: Kết quả XOR của 3 UID registers

## Xử lý lỗi

### "OpenOCD binary not found"
- Kiểm tra file `openocd.exe` có tồn tại trong `embedded/openocd-binaries/windows/bin/`

### "Flash operation failed"
- Kiểm tra kết nối ST-Link
- Kiểm tra nguồn điện cho target
- Đảm bảo không có chương trình khác đang sử dụng ST-Link

### "Failed to read UID"
- Kiểm tra target có được cấp nguồn
- Thử reset target
- Kiểm tra kết nối SWD

## OpenOCD Configuration

Cấu hình mặc định sử dụng:
- Interface: ST-Link (`interface/stlink.cfg`)
- Target: STM32WLx (`target/stm32wlx.cfg`)
- Reset config: `srst_only`

## API Reference

### Service Methods

```javascript
// Flash firmware and read device info
const result = await OpenOCDSTM32Service.flashAndReadInfo(firmwarePath, progressCallback);

// Read UID only
const uidResult = await OpenOCDSTM32Service.readUID();

// Generate MAC from UID
const macInfo = OpenOCDSTM32Service.generateMAC4(uid0, uid1, uid2);

// Set Droplet version
OpenOCDSTM32Service.setVersion(version);
```

### IPC Handlers

```javascript
// From renderer process
const result = await electronAPI.flashSTM32Droplet(firmwarePath, version);
const uidResult = await electronAPI.readSTM32UID();
const status = await electronAPI.getSTM32Status();
```

## Troubleshooting

### ST-Link không được nhận dạng
1. Cài đặt ST-Link driver từ trang ST
2. Kiểm tra Device Manager xem ST-Link có hiển thị không
3. Thử cắm lại USB

### Flash chậm
- Bình thường, flash mất 5-10 giây cho firmware ~100KB
- Verify thêm 3-5 giây

### MAC address không đúng
- Kiểm tra version có đúng không
- Đảm bảo đọc được đầy đủ 3 UID registers
- So sánh với firmware tính toán

## License

MIT License - Nube iO
