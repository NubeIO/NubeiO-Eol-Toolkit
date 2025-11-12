# Real-Time Auto-Save Guide

## Overview

The **Real-Time Auto-Save** feature automatically saves every UDP log to a file **as soon as it arrives**. No need to click save buttons - logs are written instantly and continuously!

## How It Works

```
UDP Message Arrives → Instantly Written to File → Continue Logging
```

Perfect for:
- 24/7 monitoring
- Long-running sessions
- Ensuring no logs are lost
- Continuous data collection

## Quick Start

### 1. Start Auto-Save

1. Open the **UDP Logger** page
2. Look for the **"Real-Time Auto-Save"** section (purple/blue gradient box)
3. Click **"🚀 Start Auto-Save"** button
4. Choose a file location and name
5. Select format by file extension (`.txt`, `.json`, or `.csv`)
6. Click "Save"
7. ✅ Auto-save is now active!

### 2. Monitor Status

When auto-save is active, you'll see:
- 🟢 **Green pulsing dot** - Auto-save is running
- 📁 **File name** - Where logs are being saved
- **Format** - TXT, JSON, or CSV

### 3. Stop Auto-Save

1. Click **"⏸️ Stop Auto-Save"** button
2. Auto-save stops and file is finalized
3. You'll see a confirmation with the file location

## File Formats

### TXT Format (Recommended for Humans)
```
[2025-10-07T10:30:45.123Z] [192.168.1.100:12345] I (1234567) App_Main: Device initialized
[2025-10-07T10:30:46.456Z] [192.168.1.100:12345] I (1234568) App_MQTT: Connected to broker
[2025-10-07T10:30:47.789Z] [192.168.1.100:12345] I (1234569) App_Modbus: Reading registers
```

**Best for:**
- Reading logs manually
- Quick troubleshooting
- Smallest file size

### JSON Format (Recommended for Processing)
```json
[
  {
    "timestamp": "2025-10-07T10:30:45.123Z",
    "from": "192.168.1.100:12345",
    "size": 64,
    "message": "I (1234567) App_Main: Device initialized"
  },
  {
    "timestamp": "2025-10-07T10:30:46.456Z",
    "from": "192.168.1.100:12345",
    "size": 68,
    "message": "I (1234568) App_MQTT: Connected to broker"
  }
]
```

**Best for:**
- Programmatic processing
- Data analysis
- Automation scripts

**Note:** JSON array is properly closed when you stop auto-save

### CSV Format (Recommended for Excel)
```csv
Timestamp,Source,Size,Message
"2025-10-07T10:30:45.123Z","192.168.1.100:12345",64,"I (1234567) App_Main: Device initialized"
"2025-10-07T10:30:46.456Z","192.168.1.100:12345",68,"I (1234568) App_MQTT: Connected to broker"
"2025-10-07T10:30:47.789Z","192.168.1.100:12345",72,"I (1234569) App_Modbus: Reading registers"
```

**Best for:**
- Opening in Excel/Google Sheets
- Creating reports
- Data visualization

**Note:** Header is written only once at the start

## Visual Guide

```
┌─────────────────────────────────────────────────────────┐
│  UDP Logger  ●  Port 56789  |  125 logs                │
│  ┌──────────┐ ┌────────────┐ ┌──────┐                  │
│  │💾 Save   │ │➕ Append   │ │🗑️Clear│                  │
│  └──────────┘ └────────────┘ └──────┘                  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐│
│  │ 🟢 Real-Time Auto-Save                             ││
│  │ 📁 device-logs.txt (TXT)      🚀 Start Auto-Save  ││
│  └────────────────────────────────────────────────────┘│
│                                                          │
│  [Logs appear here in real-time]                       │
└─────────────────────────────────────────────────────────┘
```

## Features

### ✅ Instant Logging
- Each log is written **immediately** when received
- No buffering or delays
- No data loss if app crashes

### ✅ Continuous Operation
- Runs in the background
- Doesn't interrupt logging
- Can run for hours/days

### ✅ Smart File Handling
- **TXT**: Appends each line
- **JSON**: Builds valid JSON array
- **CSV**: Adds rows (header only once)

### ✅ Visual Feedback
- Animated green dot when active
- Shows current file name
- Displays format type

### ✅ Safe Stopping
- JSON arrays are properly closed
- Files are finalized correctly
- No corruption

## Use Cases

### 1. 24/7 Monitoring
```
Start auto-save → Leave running overnight → Stop in the morning
Result: Complete log file with all overnight activity
```

### 2. Debugging Sessions
```
Start auto-save → Reproduce issue → Stop auto-save
Result: Full log of the issue for analysis
```

### 3. Data Collection
```
Start auto-save → Collect data for hours → Stop and analyze
Result: Complete dataset in chosen format
```

### 4. Multiple Sessions
```
Session 1: auto-save to monday-logs.txt
Session 2: auto-save to tuesday-logs.txt
Session 3: auto-save to wednesday-logs.txt
Result: Organized daily log files
```

## Tips & Best Practices

### 1. Choose the Right Format
- **TXT** for manual reading (smallest files)
- **JSON** for scripts and automation
- **CSV** for Excel and reports

### 2. Use Descriptive Names
```
Good: device-debug-2025-10-07.txt
Good: mqtt-session-morning.json
Good: production-logs.csv

Bad: log.txt
Bad: test.json
```

### 3. Stop Auto-Save When Done
- Always stop auto-save when finished
- This properly closes JSON arrays
- Ensures file is finalized

### 4. Check Disk Space
- Long sessions can create large files
- Monitor disk space for 24/7 logging
- Consider rotating log files

### 5. Combine with Manual Save
- Use auto-save for real-time logging
- Use manual save for specific log snapshots
- Both can work together

## Comparison: Auto-Save vs Manual Save

| Feature | Auto-Save | Manual Save |
|---------|-----------|-------------|
| **When** | Real-time, automatic | On-demand, manual |
| **Use Case** | Continuous logging | Specific snapshots |
| **File Growth** | Grows continuously | Fixed size |
| **Data Loss Risk** | Very low | Medium (if forget to save) |
| **Best For** | 24/7 monitoring | Quick exports |

## Troubleshooting

### Problem: Auto-save button doesn't work
**Solution:** Check if you have write permissions to the selected directory

### Problem: File is empty
**Solution:** Wait for logs to arrive. File is created but needs data.

### Problem: JSON file is invalid
**Solution:** Always click "Stop Auto-Save" to properly close the JSON array

### Problem: File is too large
**Solution:** Stop auto-save and start a new file. Consider shorter sessions.

### Problem: Can't find the file
**Solution:** Check the file path shown in the auto-save status bar

### Problem: Logs not appearing in file
**Solution:** 
1. Check if auto-save is enabled (green dot)
2. Verify UDP messages are being received
3. Check file permissions

## Advanced Usage

### Rotating Log Files

For long-running sessions, you can manually rotate files:

1. Stop auto-save (file1.txt is complete)
2. Start auto-save with new file (file2.txt)
3. Repeat as needed

### Filtering Logs

Auto-save writes ALL logs. To filter:
1. Save as JSON format
2. Stop auto-save
3. Use a script to filter the JSON
4. Process only what you need

### Monitoring File Size

Check the file size periodically:
```bash
# Linux/Mac
ls -lh /path/to/logfile.txt

# Windows
dir /path/to/logfile.txt
```

## FAQ

**Q: Can I have auto-save and manual save at the same time?**
A: Yes! Auto-save runs continuously while you can still use manual save buttons.

**Q: What happens if the app crashes?**
A: All logs written before the crash are safe. Only unwritten logs (in memory) are lost.

**Q: Can I change the file while auto-save is running?**
A: No, stop auto-save first, then start with a new file.

**Q: Does auto-save slow down the logger?**
A: No, file writes are very fast and don't impact performance.

**Q: Can I pause auto-save?**
A: Yes, click "Stop Auto-Save" to pause, then "Start Auto-Save" with the same file to resume.

**Q: What's the maximum file size?**
A: No hard limit, but very large files (>1GB) may be slow to open.

**Q: Can I auto-save to a network drive?**
A: Yes, as long as you have write permissions.

**Q: Does auto-save work with multiple devices?**
A: Yes, all UDP logs from all devices are saved to the same file.

## Examples

### Example 1: Debug Session
```
1. Click "Start Auto-Save"
2. Choose: debug-session.txt
3. Reproduce the bug
4. Click "Stop Auto-Save"
5. Open debug-session.txt to analyze
```

### Example 2: Daily Monitoring
```
Monday:
  - Start: monday-logs.txt (9 AM)
  - Stop: monday-logs.txt (5 PM)

Tuesday:
  - Start: tuesday-logs.txt (9 AM)
  - Stop: tuesday-logs.txt (5 PM)
```

### Example 3: JSON Processing
```
1. Start auto-save: data.json
2. Collect logs for 1 hour
3. Stop auto-save
4. Run script: python analyze.py data.json
5. Generate report
```

---

**Version:** 1.0.0  
**Last Updated:** October 7, 2025
