# FGA AC Simulator - User Guide

## How to Save UDP Logs

The FGA AC Simulator Electron app allows you to save UDP logs from ESP32 devices to your computer in multiple formats.

### Step-by-Step Instructions

#### 1. Navigate to UDP Logger

1. Open the FGA AC Simulator Electron app
2. Click on **"📡 UDP Logs"** in the top navigation bar
3. You'll see the UDP Logger page with real-time logs from connected ESP32 devices

![UDP Logger Page](https://via.placeholder.com/800x400?text=UDP+Logger+Page)

#### 2. Wait for Logs to Accumulate

- The logger automatically captures UDP messages from ESP32 devices
- Logs appear in real-time in the black console area
- The log count is displayed at the top: "X logs"

#### 3. Save Logs to File

You have two options:

**Option A: Save Logs (Overwrite)**
1. Click the **"💾 Save Logs"** button (blue button)
2. A file save dialog will appear
3. Choose where to save the file
4. Select the file format by changing the extension:
   - **`.txt`** - Plain text format (human-readable)
   - **`.json`** - JSON format (for programmatic processing)
   - **`.csv`** - CSV format (for Excel/Google Sheets)
5. Click **"Save"**
6. The file will be created or **overwritten** if it exists
7. You'll see a success message showing how many logs were saved

**Option B: Append Logs (Add to Existing File)**
1. Click the **"➕ Append Logs"** button (green button)
2. A file save dialog will appear
3. Select an **existing file** or create a new one
4. The new logs will be **added to the end** of the file
5. Perfect for continuous logging sessions
6. You'll see a success message showing how many logs were appended

**Append Mode Behavior:**
- **TXT files**: New logs are appended to the end
- **CSV files**: New rows are added (no duplicate header)
- **JSON files**: Arrays are merged together

#### 4. Clear Logs (Optional)

- Click the **"🗑️ Clear Logs"** button to remove all logs
- This frees up memory and starts fresh
- Cleared logs cannot be recovered

### File Format Examples

#### TXT Format (Plain Text)
```
[2025-10-07T10:30:45.123Z] [192.168.1.100:12345] I (1234567) App_Main: Device initialized
[2025-10-07T10:30:46.456Z] [192.168.1.100:12345] I (1234568) App_MQTT: Connected to broker
```

**Best for:** Reading logs manually, troubleshooting

#### JSON Format
```json
[
  {
    "timestamp": "2025-10-07T10:30:45.123Z",
    "from": "192.168.1.100:12345",
    "size": 64,
    "message": "I (1234567) App_Main: Device initialized"
  }
]
```

**Best for:** Processing logs with scripts, data analysis

#### CSV Format
```csv
Timestamp,Source,Size,Message
"2025-10-07T10:30:45.123Z","192.168.1.100:12345",64,"I (1234567) App_Main: Device initialized"
```

**Best for:** Opening in Excel, creating reports, data visualization

### Tips & Tricks

1. **Save Regularly**
   - The logger keeps only the last 1000 logs
   - Save important logs before they're automatically removed

2. **Use Append for Continuous Logging**
   - Use **"Append Logs"** to add new logs to the same file
   - Perfect for long-running sessions
   - Example: Append logs every hour to `daily-log.txt`

3. **Choose the Right Format**
   - Use TXT for quick viewing
   - Use JSON for automation
   - Use CSV for spreadsheets

4. **File Naming**
   - Default filename includes the date: `udp-logs-2025-10-07.txt`
   - You can rename it to anything you want

5. **No Logs Available**
   - If the buttons are disabled, there are no logs to save
   - Wait for ESP32 devices to send UDP messages

6. **Large Log Files**
   - JSON and CSV files may be larger than TXT
   - Saving many logs may take a few seconds

7. **Append vs Save**
   - **Save (Blue)**: Overwrites the file - use for new log sessions
   - **Append (Green)**: Adds to existing file - use for continuous logging

### Troubleshooting

**Problem:** "No logs to save" message
- **Solution:** Wait for ESP32 devices to connect and send UDP messages

**Problem:** Save dialog doesn't appear
- **Solution:** Check if the app has file system permissions

**Problem:** Saved file is empty
- **Solution:** Ensure logs were captured before saving

**Problem:** Can't find saved file
- **Solution:** Check the location you selected in the save dialog

### Advanced Usage

#### Filtering Logs Before Saving

Currently, the app saves all logs. To filter logs:
1. Save as JSON format
2. Use a text editor or script to filter the JSON
3. Process only the logs you need

#### Automating Log Saves

For automated log saving, you can use the browser console:
```javascript
// Save logs every hour
setInterval(async () => {
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const result = await window.electronAPI.saveUDPLogs(
    `/path/to/logs/udp-${timestamp}.txt`, 
    'txt'
  );
  console.log(result.message);
}, 3600000); // 1 hour
```

### Keyboard Shortcuts

- **Ctrl+S** (planned) - Quick save logs
- **Ctrl+L** (planned) - Clear logs
- **Ctrl+1** - Switch to Devices page
- **Ctrl+2** - Switch to UDP Logs page

### FAQ

**Q: How many logs can be saved?**
A: Up to 1000 logs are stored in memory. Older logs are automatically removed.

**Q: Can I save logs while the app is running?**
A: Yes! Saving logs doesn't interrupt logging.

**Q: What happens if I close the app?**
A: Unsaved logs are lost. Save important logs before closing.

**Q: Can I save logs from multiple devices separately?**
A: Currently, all logs are saved together. Use the source IP address in the logs to identify devices.

**Q: Is there a log size limit?**
A: No hard limit, but performance may degrade with very large log files.

### Need Help?

- Check the console (F12) for error messages
- Review the `SAVE_LOGS_USAGE.md` file for API details
- Contact support or file an issue on GitHub

---

**Version:** 1.0.0  
**Last Updated:** October 7, 2025
