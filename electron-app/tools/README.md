# Bundled Tools

This directory contains pre-compiled binaries that are bundled with the application for offline use.

## ESP32 Flasher (esptool)

The ESP32 flasher uses esptool v4.7.0 from Espressif Systems.

### Included Binaries:

- **Linux**: `esptool-linux-amd64/esptool` (64-bit)
- **Windows**: `esptool-win64/esptool.exe` (64-bit)

### Why Bundle esptool?

Bundling esptool with the application provides several benefits:

1. **Offline Usage**: Users can flash ESP32 devices without internet connection
2. **No Installation Required**: No need to install Python or pip
3. **Consistent Version**: Everyone uses the same tested version
4. **Reliability**: Works out of the box on clean systems
5. **Corporate/Air-gapped**: Works in restricted network environments

### Platform Support:

| Platform | Binary | Notes |
|----------|--------|-------|
| Linux x64 | esptool-linux-amd64/esptool | Standalone executable |
| Windows x64 | esptool-win64/esptool.exe | Standalone executable |
| macOS | esptool-linux-amd64/esptool | Can use Linux binary with Rosetta |

### Version Information:

- **esptool version**: 4.7.0
- **Release date**: December 2023
- **Source**: https://github.com/espressif/esptool/releases/tag/v4.7.0

### Supported Chips:

- ESP32
- ESP32-S2
- ESP32-S3
- ESP32-C3
- ESP32-C6
- ESP32-H2

### License:

esptool is licensed under the GPL v2+ license.
See: https://github.com/espressif/esptool/blob/master/LICENSE

### Automatic Platform Detection:

The application automatically detects your operating system and uses the appropriate binary:

```javascript
// Windows
tools/esptool/esptool-win64/esptool.exe

// Linux
tools/esptool/esptool-linux-amd64/esptool
```

### Build Configuration:

The tools directory is automatically included in builds via `package.json`:

```json
{
  "build": {
    "files": ["tools/**/*"],
    "extraResources": [
      {
        "from": "tools/esptool",
        "to": "tools/esptool",
        "filter": ["**/*"]
      }
    ]
  }
}
```

### Updating esptool:

To update to a new version:

1. Download the latest release from https://github.com/espressif/esptool/releases
2. Extract Linux and Windows binaries
3. Replace the contents of `esptool-linux-amd64/` and `esptool-win64/`
4. Test flashing on both platforms
5. Update this README with the new version number

### Manual Testing:

To test the bundled esptool:

```bash
# Linux
./tools/esptool/esptool-linux-amd64/esptool --version

# Windows (in PowerShell)
.\tools\esptool\esptool-win64\esptool.exe --version
```

Expected output: `esptool.py v4.7.0`

### Troubleshooting:

**Linux: Permission Denied**
```bash
chmod +x tools/esptool/esptool-linux-amd64/esptool
```

**Windows: Antivirus False Positive**
- Some antivirus software may flag the binary
- Add exception for the application directory
- esptool is safe and from official Espressif repository

### Credits:

esptool is developed and maintained by Espressif Systems.
- GitHub: https://github.com/espressif/esptool
- Documentation: https://docs.espressif.com/projects/esptool/

