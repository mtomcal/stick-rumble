.PHONY: install build generate validate test test-coverage clean help

# Default target
help:
	@echo "Events Schema - Build Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make install          Install npm dependencies"
	@echo ""
	@echo "Build:"
	@echo "  make build            Build TypeScript and generate schemas"
	@echo "  make generate         Generate JSON Schema files from TypeBox"
	@echo "  make validate         Validate all JSON Schema files"
	@echo ""
	@echo "Testing:"
	@echo "  make test             Run all tests"
	@echo "  make test-coverage    Run tests with coverage (90% threshold)"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean            Remove generated files"

# Install dependencies
install:
	npm install

# Full build: TypeScript compile + schema generation
build: generate validate
	@echo "Build complete"

# Generate JSON Schema files from TypeBox definitions
generate:
	@echo "Generating JSON Schema files..."
	node --import tsx src/build-schemas.ts

# Validate all JSON Schema files
validate:
	@echo "Validating JSON Schema files..."
	node --import tsx src/validate-schemas.ts

# Run tests
test:
	npm test

# Run tests with coverage
test-coverage:
	npm run test:coverage

# Clean generated files
clean:
	rm -rf dist
	rm -rf schemas/common
	rm -rf schemas/client-to-server/*.json
	rm -rf schemas/server-to-client/*.json
	rm -rf generated/typescript/*.ts
	rm -rf generated/go/*.go
	@echo "Clean complete"
