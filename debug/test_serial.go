package main

import (
	"log"
	"os"

	"go.bug.st/serial"
)

func main() {
	portName := "/dev/ttyUSB0"

	// Check if port exists
	if _, err := os.Stat(portName); os.IsNotExist(err) {
		log.Fatalf("Serial port %s does not exist", portName)
	}

	// Try to list available ports first
	ports, err := serial.GetPortsList()
	if err != nil {
		log.Printf("Error getting ports list: %v", err)
	} else {
		log.Printf("Available ports: %v", ports)
	}

	// Configure serial port
	mode := &serial.Mode{
		BaudRate: 9600,
		DataBits: 8,
		Parity:   serial.NoParity,
		StopBits: serial.OneStopBit,
	}

	log.Printf("Attempting to connect to %s...", portName)

	// Try to open the port
	port, err := serial.Open(portName, mode)
	if err != nil {
		log.Fatalf("Failed to open serial port %s: %v", portName, err)
	}
	defer port.Close()

	log.Printf("Successfully connected to %s!", portName)

	// Try to write something
	_, err = port.Write([]byte("test"))
	if err != nil {
		log.Printf("Failed to write to port: %v", err)
	} else {
		log.Printf("Successfully wrote test data to port")
	}
}
