#!/usr/bin/env python3
"""
Python-based NVS Partition Generator
Compatible replacement for the GLIBC 2.38 binary
"""

import sys
import os
import struct
import csv
import argparse
from typing import Dict, Any, List, Tuple

class NVSGenerator:
    """Generate NVS (Non-Volatile Storage) partition binary from CSV"""
    
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
        # Simple string encoding - null terminated
        return value.encode('utf-8') + b'\x00'
    
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
    
    def create_entry(self, key: str, value: str, encoding: str = 'string', namespace: str = '') -> bytes:
        """Create a single NVS entry"""
        # NVS entry structure (simplified)
        # [4 bytes: namespace] [4 bytes: key] [4 bytes: type] [4 bytes: length] [data...]
        
        # Handle namespace entries differently
        if key == 'namespace' and value == '':
            # This is a namespace declaration, skip for now
            return b'\x00' * self.entry_size
        
        # Encode the data
        data = self.encode_data(value, encoding)
        data_len = len(data)
        
        # Pad data to 4-byte boundary
        while len(data) % 4 != 0:
            data += b'\x00'
        
        # Create entry header
        namespace_str = namespace or 'zc'
        if namespace_str is None:
            namespace_str = 'zc'
        namespace_bytes = namespace_str.encode('utf-8')[:4].ljust(4, b'\x00')
        key_bytes = key.encode('utf-8')[:4].ljust(4, b'\x00')
        
        # Entry type (1 = string, 2 = blob, etc.)
        entry_type = 1 if encoding == 'string' else 2
        
        # Create entry
        entry = struct.pack('<4s4sII', namespace_bytes, key_bytes, entry_type, data_len)
        entry += data
        
        # Pad entry to entry_size
        while len(entry) < self.entry_size:
            entry += b'\x00'
        
        return entry[:self.entry_size]
    
    def generate_partition(self, csv_path: str, output_path: str) -> bool:
        """Generate NVS partition binary from CSV"""
        try:
            # Parse CSV
            entries = self.parse_csv(csv_path)
            print(f"Parsed {len(entries)} entries from CSV")
            
            # Create partition data
            partition_data = bytearray(self.size)
            
            # Write entries
            offset = 0
            for entry in entries:
                if offset + self.entry_size > self.size:
                    print(f"Warning: Partition full, skipping remaining entries")
                    break
                
                # Skip namespace entries
                if entry['key'] == 'namespace' and entry['value'] == '':
                    print(f"Skipping namespace entry: {entry['key']}")
                    continue
                
                # Create entry bytes
                print(f"Creating entry: key='{entry['key']}', value='{entry['value']}', encoding='{entry['encoding']}', namespace='{entry['namespace']}'")
                entry_bytes = self.create_entry(
                    entry['key'],
                    entry['value'],
                    entry['encoding'],
                    entry['namespace']
                )
                
                # Write to partition
                partition_data[offset:offset + self.entry_size] = entry_bytes
                offset += self.entry_size
                
                print(f"Added entry: {entry['key']} = {entry['value']}")
            
            # Write partition to file
            with open(output_path, 'wb') as f:
                f.write(partition_data)
            
            print(f"Generated NVS partition: {output_path} ({len(partition_data)} bytes)")
            return True
            
        except Exception as e:
            print(f"Error generating partition: {e}")
            return False

def main():
    parser = argparse.ArgumentParser(description='Generate NVS partition from CSV')
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
    generator = NVSGenerator(size)
    
    # Generate partition
    success = generator.generate_partition(args.csv_file, args.output_file)
    
    if success:
        print("NVS partition generation completed successfully")
        sys.exit(0)
    else:
        print("NVS partition generation failed")
        sys.exit(1)

if __name__ == '__main__':
    main()
