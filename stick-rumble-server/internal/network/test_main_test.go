package network

import (
	"os"
	"testing"
)

// TestMain provides setup and teardown for all tests in this package
func TestMain(m *testing.M) {
	// Reset singleton loaders before running tests to ensure clean state
	// This prevents race conditions when tests run in parallel
	resetSchemaLoaderSingletons()
	resetGlobalHandler()

	// Run all tests
	code := m.Run()

	// Exit with test result code
	os.Exit(code)
}
