#!/usr/bin/env node
/**
 * Node.js-based NVS Partition Generator (Windows)
 * Completely self-contained, no external dependencies
 * Compatible with any Windows system that has Node.js
 */

const fs = require('fs');
const path = require('path');

class NVSGenerator {
    constructor(size = 0x10000) {
        this.size = size;
        this.pageSize = 4096;
        this.entrySize = 32;
        this.namespaceId = 0;
        this.entries = [];
    }

    parseCSV(csvPath) {
        const entries = [];
        const content = fs.readFileSync(csvPath, 'utf8');
        const lines = content.split('\r\n'); // Windows line endings
        
        if (lines.length < 2) {
            throw new Error('CSV file is empty or invalid');
        }

        // Parse header
        const headers = lines[0].split(',').map(h => h.trim());
        console.log('CSV Headers:', headers);

        // Parse data rows
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const values = this.parseCSVLine(line);
            if (values.length < 2) continue;

            const entry = {
                key: values[0] || '',
                type: values[1] || '',
                encoding: values[2] || 'string',
                value: values[3] || '',
                namespace: values[4] || ''
            };

            if (entry.key && entry.type) {
                entries.push(entry);
            }
        }

        return entries;
    }

    parseCSVLine(line) {
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        values.push(current.trim());
        return values;
    }

    encodeString(value) {
        // Simple string encoding - null terminated
        return Buffer.from(value, 'utf8');
    }

    encodeData(value, encoding = 'string') {
        if (encoding === 'string') {
            return this.encodeString(value);
        } else if (encoding === 'hex') {
            // Remove spaces and convert hex string to bytes
            const hexStr = value.replace(/[\s-]/g, '');
            return Buffer.from(hexStr, 'hex');
        } else {
            return this.encodeString(value);
        }
    }

    createEntry(key, value, encoding = 'string', namespace = '') {
        // Handle namespace entries differently
        if (key === 'namespace' && value === '') {
            // This is a namespace declaration, skip for now
            return Buffer.alloc(this.entrySize, 0);
        }

        // Encode the data
        const data = this.encodeData(value, encoding);
        const dataLen = data.length;

        // Pad data to 4-byte boundary
        const paddedData = Buffer.alloc(Math.ceil(dataLen / 4) * 4);
        data.copy(paddedData);

        // Create entry header
        const namespaceStr = namespace || 'zc';
        const namespaceBytes = Buffer.from(namespaceStr, 'utf8').slice(0, 4);
        const keyBytes = Buffer.from(key, 'utf8').slice(0, 4);

        // Pad to 4 bytes
        const namespacePadded = Buffer.alloc(4);
        const keyPadded = Buffer.alloc(4);
        namespaceBytes.copy(namespacePadded);
        keyBytes.copy(keyPadded);

        // Entry type (1 = string, 2 = blob, etc.)
        const entryType = encoding === 'string' ? 1 : 2;

        // Create entry
        const entry = Buffer.alloc(this.entrySize);
        let offset = 0;

        // Write header
        namespacePadded.copy(entry, offset);
        offset += 4;
        keyPadded.copy(entry, offset);
        offset += 4;
        entry.writeUInt32LE(entryType, offset);
        offset += 4;
        entry.writeUInt32LE(dataLen, offset);
        offset += 4;

        // Write data
        paddedData.copy(entry, offset);

        return entry;
    }

    generatePartition(csvPath, outputPath) {
        try {
            // Parse CSV
            const entries = this.parseCSV(csvPath);
            console.log(`Parsed ${entries.length} entries from CSV`);

            // Create partition data
            const partitionData = Buffer.alloc(this.size);

            // Write entries
            let offset = 0;
            for (const entry of entries) {
                if (offset + this.entrySize > this.size) {
                    console.log('Warning: Partition full, skipping remaining entries');
                    break;
                }

                // Skip namespace entries
                if (entry.key === 'namespace' && entry.value === '') {
                    console.log(`Skipping namespace entry: ${entry.key}`);
                    continue;
                }

                // Create entry bytes
                console.log(`Creating entry: key='${entry.key}', value='${entry.value}', encoding='${entry.encoding}', namespace='${entry.namespace}'`);
                const entryBytes = this.createEntry(
                    entry.key,
                    entry.value,
                    entry.encoding,
                    entry.namespace
                );

                // Write to partition
                entryBytes.copy(partitionData, offset);
                offset += this.entrySize;

                console.log(`Added entry: ${entry.key} = ${entry.value}`);
            }

            // Write partition to file
            fs.writeFileSync(outputPath, partitionData);

            console.log(`Generated NVS partition: ${outputPath} (${partitionData.length} bytes)`);
            return true;

        } catch (error) {
            console.error(`Error generating partition: ${error.message}`);
            return false;
        }
    }
}

function main() {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
        console.error('Usage: node nvs_partition_gen_node.js <csv_file> <output_file> [size]');
        console.error('Example: node nvs_partition_gen_node.js input.csv output.bin 0x10000');
        process.exit(1);
    }

    const csvFile = args[0];
    const outputFile = args[1];
    const size = args[2] || '0x10000';

    // Parse size
    let partitionSize;
    if (size.startsWith('0x')) {
        partitionSize = parseInt(size, 16);
    } else {
        partitionSize = parseInt(size);
    }

    if (!fs.existsSync(csvFile)) {
        console.error(`CSV file not found: ${csvFile}`);
        process.exit(1);
    }

    // Create generator
    const generator = new NVSGenerator(partitionSize);

    // Generate partition
    const success = generator.generatePartition(csvFile, outputFile);

    if (success) {
        console.log('NVS partition generation completed successfully');
        process.exit(0);
    } else {
        console.log('NVS partition generation failed');
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = NVSGenerator;

