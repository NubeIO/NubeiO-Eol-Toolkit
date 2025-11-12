#!/usr/bin/env python3
"""
ESP32 NVS Partition Generator
Based on ESP-IDF's nvs_partition_gen.py format
"""

import sys
import os
import struct
import csv
import argparse
import hashlib
from typing import Dict, Any, List, Tuple

class ESP32NVSGenerator:
    """Generate ESP32 NVS partition binary from CSV"""
    
    def __init__(self, size: int = 0x10000):
        self.size = size
        self.page_size = 4096
        self.entry_size = 32
        self.namespace_id = 0
        self.entries = []
        
    def parse_csv(self, csv_path: str) -> List[Dict[str, Any]]:
        """Parse CSV file and return list of entries"""
        entries = []
        
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if not row.get('key') or not row.get('type'):
                    continue
                    
                entry = {
                    'key': row['key'],
                    'type': row['type'],
                    'encoding': row.get('encoding', 'string') or 'string',
                    'value': row.get('value', '') or '',
                    'namespace': row.get('namespace', '') or ''
                }
                entries.append(entry)
                
        return entries
    
    def encode_string(self, value: str) -> bytes:
        """Encode string value for NVS storage"""
        return value.encode('utf-8')
    
    def encode_data(self, value: str, encoding: str = 'string') -> bytes:
        """Encode data based on encoding type"""
        if encoding == 'string':
            return self.encode_string(value)
        elif encoding == 'hex':
            # Remove spaces and convert hex string to bytes
            hex_str = value.replace(' ', '').replace('-', '')
            return bytes.fromhex(hex_str)
        else:
            return self.encode_string(value)
    
    def calculate_crc16(self, data: bytes) -> int:
        """Calculate CRC16 for NVS entry"""
        crc = 0xFFFF
        for byte in data:
            crc ^= byte
            for _ in range(8):
                if crc & 1:
                    crc = (crc >> 1) ^ 0xA001
                else:
                    crc >>= 1
        return crc & 0xFFFF
    
    def create_nvs_entry(self, key: str, value: str, encoding: str = 'string', namespace: str = '') -> bytes:
        """Create a proper ESP32 NVS entry"""
        if key == 'namespace' and value == '':
            # Skip namespace entries
            return b''
        
        # Encode the data
        data = self.encode_data(value, encoding)
        data_len = len(data)
        
        # Create key bytes
        key_bytes = key.encode('utf-8')
        key_len = len(key_bytes)
        
        # ESP32 NVS entry format:
        # [1 byte: namespace] [1 byte: type] [1 byte: span] [1 byte: chunk_index] 
        # [2 bytes: crc] [2 bytes: key_len] [key] [4 bytes: data_len] [data]
        
        namespace_id = ord(namespace[0]) if namespace else ord('z')
        entry_type = 0x02 if encoding == 'string' else 0x42  # 0x02 = string, 0x42 = blob
        span = 1
        chunk_index = 0
        
        # Create entry header
        header = struct.pack('<BBBB', namespace_id, entry_type, span, chunk_index)
        
        # Create key and data sections
        key_section = struct.pack('<H', key_len) + key_bytes
        data_section = struct.pack('<I', data_len) + data
        
        # Calculate CRC for the entry
        entry_data = header + key_section + data_section
        crc = self.calculate_crc16(entry_data)
        
        # Create final entry
        entry = struct.pack('<BBBBH', namespace_id, entry_type, span, chunk_index, crc)
        entry += key_section + data_section
        
        return entry
    
    def create_nvs_page_header(self, page_num: int, is_active: bool = True) -> bytes:
        """Create NVS page header"""
        # ESP32 NVS page header format
        magic = 0x4E56534B  # "NVSK"
        version = 0x01
        crc = 0x0000  # Will be calculated later
        seq_num = page_num
        crc32 = 0x00000000  # Will be calculated later
        
        header = struct.pack('<IIIIII', magic, version, crc, seq_num, crc32, 0)
        return header
    
    def generate_partition(self, csv_path: str, output_path: str) -> bool:
        """Generate ESP32 NVS partition binary from CSV"""
        try:
            # Parse CSV
            entries = self.parse_csv(csv_path)
            print(f"Parsed {len(entries)} entries from CSV")
            
            # Create partition data
            partition_data = bytearray(self.size)
            offset = 0
            
            # Create first page header
            page_header = self.create_nvs_page_header(0, True)
            partition_data[offset:offset + len(page_header)] = page_header
            offset += len(page_header)
            
            # Write entries
            for entry in entries:
                if entry['key'] == 'namespace' and entry['value'] == '':
                    print(f"Skipping namespace entry: {entry['key']}")
                    continue
                
                print(f"Creating entry: key='{entry['key']}', value='{entry['value']}', encoding='{entry['encoding']}', namespace='{entry['namespace']}'")
                
                # Create NVS entry
                nvs_entry = self.create_nvs_entry(
                    entry['key'],
                    entry['value'],
                    entry['encoding'],
                    entry['namespace']
                )
                
                # Check if entry fits in current page
                if offset + len(nvs_entry) > self.page_size:
                    # Move to next page
                    offset = ((offset // self.page_size) + 1) * self.page_size
                    if offset + len(page_header) + len(nvs_entry) > self.size:
                        print("Warning: Partition full, skipping remaining entries")
                        break
                    
                    # Create new page header
                    page_num = offset // self.page_size
                    page_header = self.create_nvs_page_header(page_num, True)
                    partition_data[offset:offset + len(page_header)] = page_header
                    offset += len(page_header)
                
                # Write entry
                partition_data[offset:offset + len(nvs_entry)] = nvs_entry
                offset += len(nvs_entry)
                
                print(f"Added entry: {entry['key']} = {entry['value']}")
            
            # Write partition to file
            with open(output_path, 'wb') as f:
                f.write(partition_data)
            
            print(f"Generated ESP32 NVS partition: {output_path} ({len(partition_data)} bytes)")
            return True
            
        except Exception as e:
            print(f"Error generating partition: {e}")
            return False

def main():
    parser = argparse.ArgumentParser(description='Generate ESP32 NVS partition from CSV')
    parser.add_argument('csv_file', help='Input CSV file')
    parser.add_argument('output_file', help='Output binary file')
    parser.add_argument('size', nargs='?', default='0x10000', help='Partition size (default: 0x10000)')
    
    args = parser.parse_args()
    
    # Parse size
    if args.size.startswith('0x'):
        size = int(args.size, 16)
    else:
        size = int(args.size)
    
    # Create generator
    generator = ESP32NVSGenerator(size)
    
    # Generate partition
    success = generator.generate_partition(args.csv_file, args.output_file)
    
    if success:
        print("ESP32 NVS partition generation completed successfully")
        sys.exit(0)
    else:
        print("ESP32 NVS partition generation failed")
        sys.exit(1)

if __name__ == '__main__':
    main()
