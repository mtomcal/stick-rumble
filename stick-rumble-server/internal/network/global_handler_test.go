package network

import (
	"testing"
)

func TestGlobalHandlerLazyInitialization(t *testing.T) {
	// Reset global handler before test
	resetGlobalHandler()
	resetSchemaLoaderSingletons()

	// Get handler multiple times
	handler1 := getGlobalHandler()
	handler2 := getGlobalHandler()

	if handler1 == nil || handler2 == nil {
		t.Fatal("Expected non-nil global handler")
	}

	// Verify same instance is returned (singleton pattern)
	if handler1 != handler2 {
		t.Error("getGlobalHandler() returned different instances, expected singleton")
	}
}

func TestGlobalHandlerConcurrentAccess(t *testing.T) {
	// Reset global handler before test
	resetGlobalHandler()
	resetSchemaLoaderSingletons()

	// Test concurrent access to global handler
	done := make(chan bool)
	handlers := make([]*WebSocketHandler, 20)

	for i := 0; i < 20; i++ {
		go func(index int) {
			handlers[index] = getGlobalHandler()
			done <- true
		}(i)
	}

	// Wait for all goroutines
	for i := 0; i < 20; i++ {
		<-done
	}

	// Verify all goroutines got the same instance
	firstHandler := handlers[0]
	if firstHandler == nil {
		t.Fatal("Expected non-nil handler")
	}

	for i := 1; i < 20; i++ {
		if handlers[i] != firstHandler {
			t.Errorf("Handler at index %d is different from first handler (concurrent access failed)", i)
		}
	}
}

func TestResetGlobalHandler(t *testing.T) {
	// Reset and get handler
	resetGlobalHandler()
	resetSchemaLoaderSingletons()

	handler1 := getGlobalHandler()
	if handler1 == nil {
		t.Fatal("Expected non-nil handler")
	}

	// Reset again
	resetGlobalHandler()
	resetSchemaLoaderSingletons()

	handler2 := getGlobalHandler()
	if handler2 == nil {
		t.Fatal("Expected non-nil handler after reset")
	}

	// Verify we got a new instance after reset
	if handler1 == handler2 {
		t.Error("Expected different handler instance after reset")
	}
}

func TestGlobalHandlerSchemaLoadersInitialized(t *testing.T) {
	// Reset before test
	resetGlobalHandler()
	resetSchemaLoaderSingletons()

	// Get global handler (should initialize schema loaders)
	handler := getGlobalHandler()
	if handler == nil {
		t.Fatal("Expected non-nil handler")
	}

	// Verify schema loaders are initialized
	if handler.validator == nil {
		t.Error("Expected non-nil validator")
	}

	if handler.outgoingValidator == nil {
		t.Error("Expected non-nil outgoingValidator")
	}

	// Verify schema loaders are singletons (same instances as direct access)
	clientLoader := GetClientToServerSchemaLoader()
	serverLoader := GetServerToClientSchemaLoader()

	if clientLoader == nil || serverLoader == nil {
		t.Fatal("Expected non-nil schema loaders")
	}

	// Note: We can't directly compare the loaders since they're wrapped in validators,
	// but we can verify they're not nil and contain schemas
	clientNames := clientLoader.GetSchemaNames()
	serverNames := serverLoader.GetSchemaNames()

	if len(clientNames) == 0 {
		t.Error("Expected client-to-server schemas to be loaded")
	}

	if len(serverNames) == 0 {
		t.Error("Expected server-to-client schemas to be loaded")
	}
}
