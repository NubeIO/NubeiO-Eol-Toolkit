package main

import (
	"encoding/hex"
	"fmt"
)

// Simple test function to verify protocol response format
func testOfficeModelProtocol() {
	// Create app instance with Office Model
	app := NewApp()
	app.model = 1 // Office Model

	// Test data from your example
	// Input: 0300000018000101010110011701120113011401150117011a011d0120fefa
	testCommand := []byte{0x03, 0x00, 0x00, 0x00}
	testLength := uint8(0x18) // 24 bytes
	testData := []byte{
		0x01, 0x01, // cls=01, num=01
		0x01, 0x10, // cls=01, num=10
		0x01, 0x17, // cls=01, num=17
		0x01, 0x12, // cls=01, num=12
		0x01, 0x13, // cls=01, num=13
		0x01, 0x14, // cls=01, num=14
		0x01, 0x15, // cls=01, num=15
		0x01, 0x17, // cls=01, num=17 (duplicate)
		0x01, 0x1a, // cls=01, num=1a
		0x01, 0x1d, // cls=01, num=1d
		0x01, 0x20, // cls=01, num=20
		// Note: Original has 24 bytes, this is 22. Need to check actual input
	}

	// Generate response
	response := app.ConstructResponse(testCommand[0], 0x000000, testLength, testData)

	fmt.Printf("Generated response: %s\n", hex.EncodeToString(response))
	fmt.Printf("Expected response:  03000000310100010001001100010112000101130001011400010115000101170001011a00010110000101200001fed6\n")
}