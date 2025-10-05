# FGA Simulator Makefile

.PHONY: help install build dev test clean frontend backend

# Default target
help:
	@echo "FGA Simulator - Available Commands:"
	@echo ""
	@echo "  install    - Install all dependencies"
	@echo "  build      - Build the application"
	@echo "  dev        - Run in development mode"
	@echo "  test       - Run MQTT tests"
	@echo "  clean      - Clean build artifacts"
	@echo "  frontend   - Build frontend only"
	@echo "  backend    - Build backend only"
	@echo ""

# Install dependencies
install:
	@echo "Installing Go dependencies..."
	go mod tidy
	@echo "Installing frontend dependencies..."
	cd frontend && npm install
	@echo "✅ Dependencies installed"

# Build the application
build: frontend
	@echo "Building Wails application..."
	wails build
	@echo "✅ Application built"

# Run in development mode
dev: frontend
	@echo "Starting development server..."
	wails dev

# Build frontend
frontend:
	@echo "Building frontend..."
	cd frontend && npm run build
	@echo "✅ Frontend built"

# Build backend only
backend:
	@echo "Building backend..."
	go build -o build/bin/FGA_Simulator
	@echo "✅ Backend built"

# Run MQTT tests
test:
	@echo "Running MQTT tests..."
	@if command -v python3 >/dev/null 2>&1; then \
		python3 test_mqtt.py; \
	else \
		echo "❌ Python3 not found. Please install Python3 to run tests."; \
		echo "   You can also test manually using mosquitto_pub/mosquitto_sub"; \
	fi

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -rf build/
	rm -rf frontend/build/
	rm -rf frontend/dist/
	rm -rf frontend/node_modules/
	@echo "✅ Cleaned"

# Install MQTT broker (Ubuntu/Debian)
install-mqtt:
	@echo "Installing Mosquitto MQTT broker..."
	sudo apt-get update
	sudo apt-get install -y mosquitto mosquitto-clients
	sudo systemctl start mosquitto
	sudo systemctl enable mosquitto
	@echo "✅ Mosquitto installed and started"

# Start MQTT broker
start-mqtt:
	@echo "Starting MQTT broker..."
	sudo systemctl start mosquitto
	@echo "✅ MQTT broker started"

# Stop MQTT broker
stop-mqtt:
	@echo "Stopping MQTT broker..."
	sudo systemctl stop mosquitto
	@echo "✅ MQTT broker stopped"

# Check MQTT broker status
status-mqtt:
	@echo "MQTT broker status:"
	sudo systemctl status mosquitto

# Test MQTT connection
test-mqtt-connection:
	@echo "Testing MQTT connection..."
	@if command -v mosquitto_pub >/dev/null 2>&1; then \
		mosquitto_pub -h localhost -t "test/connection" -m "Hello MQTT"; \
		echo "✅ MQTT connection test successful"; \
	else \
		echo "❌ mosquitto_pub not found. Please install Mosquitto."; \
	fi
