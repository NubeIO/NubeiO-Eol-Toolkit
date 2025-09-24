.PHONY: dev build clean install deps

# Development
dev:
	wails dev

# Build the application
build:
	cd frontend && npm run build
	wails build

# Build for production
build-prod:
	cd frontend && npm run build
	wails build -clean -s -trimpath

# Clean build artifacts
clean:
	rm -rf build/
	rm -rf frontend/dist/*
	rm -rf frontend/build/
	rm -rf frontend/node_modules/

# Install dependencies
deps:
	go mod tidy
	cd frontend && npm install

# Install Wails CLI
install-wails:
	go install github.com/wailsapp/wails/v2/cmd/wails@latest

# Generate bindings
generate:
	wails generate module

# Setup development environment
setup: install-wails deps
	@echo "Development environment setup complete!"
	@echo "Run 'make dev' to start development server"

# Help
help:
	@echo "Available commands:"
	@echo "  dev         - Start development server"
	@echo "  build       - Build the application"
	@echo "  build-prod  - Build for production (optimized)"
	@echo "  clean       - Clean build artifacts"
	@echo "  deps        - Install dependencies"
	@echo "  setup       - Setup development environment"
	@echo "  help        - Show this help message"
