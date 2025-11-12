# UDP Logger - Save Logs Usage Guide

This guide explains how to use the save logs functionality in the FGA AC Simulator Electron app.

## Overview

The UDP logger service can save logs to files in multiple formats:
- **TXT** - Plain text with timestamps
- **JSON** - Structured JSON format
- **CSV** - Comma-separated values for spreadsheet import

## Using Save Logs from Renderer Process

### 1. Show Save Dialog and Save Logs

```javascript
// Show native save dialog
const result = await window.electronAPI.showSaveDialog();

if (!result.canceled && result.filePath) {
  // Determine format from file extension
  const ext = result.filePath.split('.').pop().toLowerCase();
  const format = ext === 'json' ? 'json' : ext === 'csv' ? 'csv' : 'txt';
  
  // Save logs to selected file
  const saveResult = await window.electronAPI.saveUDPLogs(result.filePath, format);
  
  if (saveResult.success) {
    console.log(`Saved ${saveResult.logCount} logs to ${saveResult.filePath}`);
    alert(saveResult.message);
  } else {
    console.error('Failed to save logs:', saveResult.message);
    alert(`Error: ${saveResult.message}`);
  }
}
```

### 2. Save Logs Directly (Without Dialog)

```javascript
// Save to a specific path
const result = await window.electronAPI.saveUDPLogs('/path/to/logs.txt', 'txt');

if (result.success) {
  console.log('Logs saved successfully!');
} else {
  console.error('Failed to save:', result.message);
}
```

### 3. Export Logs as String

```javascript
// Get logs as a formatted string (without saving to file)
const txtLogs = await window.electronAPI.exportUDPLogsAsString('txt');
console.log(txtLogs);

const jsonLogs = await window.electronAPI.exportUDPLogsAsString('json');
console.log(JSON.parse(jsonLogs));

const csvLogs = await window.electronAPI.exportUDPLogsAsString('csv');
console.log(csvLogs);
```

## Example: Adding a Save Button to UI

```html
<button id="saveLogs" onclick="saveLogsToFile()">
  Save Logs
</button>
```

```javascript
async function saveLogsToFile() {
  try {
    // Show save dialog
    const dialogResult = await window.electronAPI.showSaveDialog();
    
    if (dialogResult.canceled) {
      console.log('Save canceled by user');
      return;
    }
    
    // Get file extension to determine format
    const filePath = dialogResult.filePath;
    const ext = filePath.split('.').pop().toLowerCase();
    let format = 'txt';
    
    if (ext === 'json') format = 'json';
    else if (ext === 'csv') format = 'csv';
    
    // Save logs
    const saveResult = await window.electronAPI.saveUDPLogs(filePath, format);
    
    if (saveResult.success) {
      alert(`Successfully saved ${saveResult.logCount} logs to:\n${saveResult.filePath}`);
    } else {
      alert(`Failed to save logs:\n${saveResult.message}`);
    }
  } catch (error) {
    console.error('Error saving logs:', error);
    alert(`Error: ${error.message}`);
  }
}
```

## Output Format Examples

### TXT Format
```
[2025-10-07T10:30:45.123Z] [192.168.1.100:12345] I (1234567) App_Main: Device initialized
[2025-10-07T10:30:46.456Z] [192.168.1.100:12345] I (1234568) App_MQTT: Connected to broker
[2025-10-07T10:30:47.789Z] [192.168.1.100:12345] I (1234569) App_Modbus: Reading registers
```

### JSON Format
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

### CSV Format
```csv
Timestamp,Source,Size,Message
"2025-10-07T10:30:45.123Z","192.168.1.100:12345",64,"I (1234567) App_Main: Device initialized"
"2025-10-07T10:30:46.456Z","192.168.1.100:12345",68,"I (1234568) App_MQTT: Connected to broker"
"2025-10-07T10:30:47.789Z","192.168.1.100:12345",72,"I (1234569) App_Modbus: Reading registers"
```

## API Reference

### `window.electronAPI.showSaveDialog()`
Shows a native save file dialog.

**Returns:** `Promise<{ canceled: boolean, filePath?: string }>`

### `window.electronAPI.saveUDPLogs(filePath, format)`
Saves logs to a file.

**Parameters:**
- `filePath` (string) - Path where to save the file
- `format` (string) - Format: 'txt', 'json', or 'csv'

**Returns:** `Promise<{ success: boolean, message: string, logCount?: number, filePath?: string, error?: string }>`

### `window.electronAPI.exportUDPLogsAsString(format)`
Exports logs as a formatted string without saving to file.

**Parameters:**
- `format` (string) - Format: 'txt', 'json', or 'csv'

**Returns:** `Promise<string>` - Formatted log content

## Error Handling

The save logs function returns a result object with error information:

```javascript
const result = await window.electronAPI.saveUDPLogs(filePath, format);

if (!result.success) {
  console.error('Error:', result.error);
  console.error('Message:', result.message);
  
  // Handle specific errors
  if (result.message === 'No logs to save') {
    alert('There are no logs to save yet.');
  } else {
    alert(`Failed to save logs: ${result.message}`);
  }
}
```

## Tips

1. **Choose the right format:**
   - Use **TXT** for human-readable logs
   - Use **JSON** for programmatic processing
   - Use **CSV** for importing into Excel/Google Sheets

2. **File naming:**
   - The default filename includes the current date
   - Example: `udp-logs-2025-10-07.txt`

3. **Log limits:**
   - The logger stores up to 1000 most recent logs
   - Older logs are automatically removed (FIFO)

4. **Performance:**
   - Saving is asynchronous and won't block the UI
   - Large log files (JSON/CSV) may take a moment to save
