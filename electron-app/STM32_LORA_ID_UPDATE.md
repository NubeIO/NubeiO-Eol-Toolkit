# STM32 Flasher - LoRa ID Update

## 🎉 Tính Năng Mới

### 1. ✅ Đổi Tên MAC → LoRa Device Address
- **Trước:** `MAC4 Address`
- **Sau:** `LoRa Device Address`
- **Lý do:** Địa chỉ này dùng để giao tiếp LoRa, không phải MAC của Ethernet/WiFi

### 2. ✅ QR Code Tự Động
- Khi flash thành công, QR code được tạo tự động
- QR chứa: `LORA:{addressHex}` (ví dụ: `LORA:47001547`)
- Hiển thị ngay bên cạnh thông tin LoRa ID
- Kích thước: 200x200px, có border

### 3. ✅ Nút Disconnect ST-Link
- Thêm nút **Disconnect** bên cạnh nút **Detect ST-Link**
- Cho phép ngắt kết nối ST-Link một cách an toàn
- Reset MCU trước khi ngắt kết nối

---

## 📋 Cách Sử Dụng

### Workflow Mới:

#### Bước 1: Detect ST-Link
```
[Detect ST-Link] [Disconnect]
```
- Click **"Detect ST-Link"** để phát hiện ST-Link và MCU
- Sau khi detect thành công, nút **"Disconnect"** sẽ hiển thị

#### Bước 2: Set Version
```
Version: [1] → Hex: 0x01
```
- Nhập version từ 0-255
- Version này sẽ được dùng làm byte thứ 2 của LoRa ID

#### Bước 3: Chọn Firmware
```
[Browse...] → Select .bin file
```

#### Bước 4: Flash
```
[Flash Firmware]
```
- Flash firmware vào STM32
- Tự động đọc UID
- Tính toán LoRa Device Address
- Hiển thị QR Code

#### Bước 5: Xem Kết Quả

**Unique ID (UID):**
```
UID0: 0x00150047
UID1: 0x3232500E
UID2: 0x20343542
```

**LoRa Device Address:**
```
┌─────────────────────────────────┬─────────────────┐
│ Address (Hex): 0x47001547       │                 │
│ Formatted: 47:00:15:47          │    [QR CODE]    │
│ Decimal: 1191494983             │    200x200px    │
│ Version: 0x01                   │                 │
│ UID XOR: 0x370014A9             │                 │
│ [Copy Address]                  │                 │
└─────────────────────────────────┴─────────────────┘
```

#### Bước 6: Disconnect (Optional)
```
[Disconnect]
```
- Click để ngắt kết nối ST-Link
- MCU sẽ được reset và chạy firmware mới

---

## 🔧 Chi Tiết Kỹ Thuật

### LoRa ID Calculation Algorithm:
```javascript
uid_temp = uid0 XOR uid1 XOR uid2

byte1 = (uid_temp >> 24) & 0xFF
byte2 = VERSION & 0xFF
byte3 = (uid_temp >> 8) & 0xFF
byte4 = uid_temp & 0xFF

LoRa_ID = (byte1 << 24) | (byte2 << 16) | (byte3 << 8) | byte4
```

### QR Code Format:
```
Data: LORA:{addressHex}
Example: LORA:47001547
API: https://api.qrserver.com/v1/create-qr-code/
Size: 200x200
```

### Disconnect ST-Link:
```bash
openocd -f interface/stlink.cfg -f target/stm32wlx.cfg \
  -c "init" \
  -c "reset run" \
  -c "exit"
```

---

## 📝 Thay Đổi Code

### Files Modified:

#### 1. `services/openocd-stm32.js`
```javascript
// Changed function name
generateMAC4() → generateLoRaID()

// Added QR code generation
generateQRCode(addressHex)

// Added disconnect function
disconnectSTLink()
```

#### 2. `main.js`
```javascript
// Added IPC handler
ipcMain.handle('stm32:disconnect', ...)
```

#### 3. `preload.js`
```javascript
// Added API
disconnectSTM32: () => ipcRenderer.invoke('stm32:disconnect')
```

#### 4. `renderer/modules/STM32FlasherModule.js`
```javascript
// Added disconnect method
async disconnectSTLink()

// Updated UI rendering
- MAC → LoRa Device Address
- Added QR code display
- Added disconnect button
```

---

## 🎨 UI Changes

### Before:
```
[Detect ST-Link]

Droplet Address (MAC4)
MAC (Hex): 0x47001547
MAC (Formatted): 47:00:15:47
[Copy MAC Address]
```

### After:
```
[Detect ST-Link] [Disconnect]

LoRa Device Address
├─ Address Info          ├─ QR Code
│  Address: 0x47001547   │  [QR IMAGE]
│  Formatted: 47:00:15:47│  200x200
│  [Copy Address]        │  "Scan to copy"
```

---

## ✅ Testing Checklist

- [x] Detect ST-Link hoạt động
- [x] Flash firmware thành công
- [x] Đọc UID đúng
- [x] Tính LoRa ID chính xác
- [x] QR code hiển thị đúng
- [x] Copy address hoạt động
- [x] Disconnect ST-Link an toàn
- [x] UI responsive trên nhiều kích thước màn hình

---

## 🐛 Known Issues

### QR Code Online API
- Hiện tại dùng `api.qrserver.com` (cần internet)
- **Future:** Sử dụng thư viện `qrcode` local để tạo QR offline

### Suggested Improvement:
```bash
npm install qrcode --save
```

```javascript
const QRCode = require('qrcode');

async generateQRCode(addressHex) {
  const qrText = `LORA:${addressHex}`;
  const qrDataUrl = await QRCode.toDataURL(qrText, {
    width: 200,
    margin: 2
  });
  return qrDataUrl;
}
```

---

## 📚 API Reference

### OpenOCDSTM32Service

#### `generateLoRaID(uid0, uid1, uid2)`
- **Returns:** `{ address, addressHex, addressFormatted, qrCode, uid_temp, version }`
- **Description:** Calculate LoRa Device Address from STM32 UID

#### `generateQRCode(addressHex)`
- **Returns:** `string` (QR code URL or Data URL)
- **Description:** Generate QR code for LoRa address

#### `disconnectSTLink()`
- **Returns:** `Promise<{ success, message }>`
- **Description:** Safely disconnect ST-Link from target

---

## 🔐 Security Notes

- QR code sử dụng external API → có thể bị theo dõi
- Khuyến nghị: Chuyển sang QR generation local
- LoRa ID không được mã hóa trong QR code

---

## 📞 Support

Nếu gặp vấn đề:
1. Kiểm tra kết nối ST-Link
2. Xem console log (F12)
3. Đọc `STM32_TROUBLESHOOTING.md`
4. Contact: support@nube-io.com

---

**Version:** 1.0.0  
**Last Updated:** October 18, 2025  
**Author:** Nube iO Team
