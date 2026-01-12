package network

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadSchemas(t *testing.T) {
	tests := []struct {
		name          string
		schemaDir     string
		expectedCount int
		wantErr       bool
	}{
		{
			name:          "valid schema directory",
			schemaDir:     "../../../events-schema/schemas/client-to-server",
			expectedCount: 4, // input-state-data, player-shoot-data, player-reload, weapon-pickup-attempt-data
			wantErr:       false,
		},
		{
			name:          "non-existent directory",
			schemaDir:     "nonexistent-directory",
			expectedCount: 0,
			wantErr:       true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			loader, err := NewSchemaLoader(tt.schemaDir)

			if tt.wantErr {
				if err == nil {
					t.Errorf("LoadSchemas() expected error, got nil")
				}
				return
			}

			if err != nil {
				t.Errorf("LoadSchemas() unexpected error: %v", err)
				return
			}

			if loader == nil {
				t.Errorf("LoadSchemas() returned nil loader")
				return
			}

			// Verify schemas are loaded
			if len(loader.schemas) < tt.expectedCount {
				t.Errorf("LoadSchemas() loaded %d schemas, expected at least %d", len(loader.schemas), tt.expectedCount)
			}
		})
	}
}

func TestSchemaLoaderGetSchema(t *testing.T) {
	loader, err := NewSchemaLoader("../../../events-schema/schemas/client-to-server")
	if err != nil {
		t.Fatalf("Failed to create schema loader: %v", err)
	}

	tests := []struct {
		name       string
		schemaName string
		wantNil    bool
	}{
		{
			name:       "get existing schema input-state",
			schemaName: "input-state-data",
			wantNil:    false,
		},
		{
			name:       "get existing schema player-shoot",
			schemaName: "player-shoot-data",
			wantNil:    false,
		},
		{
			name:       "get non-existent schema",
			schemaName: "nonexistent-schema",
			wantNil:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			schema := loader.GetSchema(tt.schemaName)

			if tt.wantNil && schema != nil {
				t.Errorf("GetSchema(%s) expected nil, got schema", tt.schemaName)
			}

			if !tt.wantNil && schema == nil {
				t.Errorf("GetSchema(%s) expected schema, got nil", tt.schemaName)
			}
		})
	}
}

func TestSchemaLoaderCaching(t *testing.T) {
	loader, err := NewSchemaLoader("../../../events-schema/schemas/client-to-server")
	if err != nil {
		t.Fatalf("Failed to create schema loader: %v", err)
	}

	// Get schema twice
	schema1 := loader.GetSchema("input-state-data")
	schema2 := loader.GetSchema("input-state-data")

	if schema1 == nil || schema2 == nil {
		t.Fatal("Expected schemas to be non-nil")
	}

	// Verify same instance is returned (caching works)
	if schema1 != schema2 {
		t.Error("GetSchema() returned different instances, expected cached instance")
	}
}

func TestLoadSchemaFile(t *testing.T) {
	// Create temporary directory for test schemas
	tmpDir := t.TempDir()

	// Create a valid JSON schema file
	validSchema := `{
		"$id": "TestSchema",
		"type": "object",
		"properties": {
			"test": {"type": "string"}
		}
	}`
	validFile := filepath.Join(tmpDir, "valid.json")
	if err := os.WriteFile(validFile, []byte(validSchema), 0644); err != nil {
		t.Fatalf("Failed to write valid schema file: %v", err)
	}

	// Create an invalid JSON file
	invalidSchema := `{invalid json`
	invalidFile := filepath.Join(tmpDir, "invalid.json")
	if err := os.WriteFile(invalidFile, []byte(invalidSchema), 0644); err != nil {
		t.Fatalf("Failed to write invalid schema file: %v", err)
	}

	tests := []struct {
		name     string
		filePath string
		wantErr  bool
	}{
		{
			name:     "valid schema file",
			filePath: validFile,
			wantErr:  false,
		},
		{
			name:     "invalid json file",
			filePath: invalidFile,
			wantErr:  true,
		},
		{
			name:     "non-existent file",
			filePath: filepath.Join(tmpDir, "nonexistent.json"),
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			loader := &SchemaLoader{
				schemas: make(map[string]*CompiledSchema),
			}

			err := loader.loadSchemaFile(tt.filePath)

			if tt.wantErr && err == nil {
				t.Errorf("loadSchemaFile() expected error, got nil")
			}

			if !tt.wantErr && err != nil {
				t.Errorf("loadSchemaFile() unexpected error: %v", err)
			}
		})
	}
}

func TestSchemaLoaderConcurrentAccess(t *testing.T) {
	loader, err := NewSchemaLoader("../../../events-schema/schemas/client-to-server")
	if err != nil {
		t.Fatalf("Failed to create schema loader: %v", err)
	}

	// Test concurrent reads
	done := make(chan bool)
	for i := 0; i < 10; i++ {
		go func() {
			schema := loader.GetSchema("input-state-data")
			if schema == nil {
				t.Error("GetSchema() returned nil during concurrent access")
			}
			done <- true
		}()
	}

	// Wait for all goroutines
	for i := 0; i < 10; i++ {
		<-done
	}
}

func TestSchemaLoaderGetSchemaNames(t *testing.T) {
	loader, err := NewSchemaLoader("../../../events-schema/schemas/client-to-server")
	if err != nil {
		t.Fatalf("Failed to create schema loader: %v", err)
	}

	names := loader.GetSchemaNames()

	// Should have at least the schemas we know about
	if len(names) < 4 {
		t.Errorf("Expected at least 4 schema names, got %d", len(names))
	}

	// Check that we have some expected schemas
	expectedSchemas := map[string]bool{
		"input-state-data":           false,
		"player-shoot-data":          false,
		"weapon-pickup-attempt-data": false,
	}

	for _, name := range names {
		if _, ok := expectedSchemas[name]; ok {
			expectedSchemas[name] = true
		}
	}

	for schema, found := range expectedSchemas {
		if !found {
			t.Errorf("Expected schema %s not found in names list", schema)
		}
	}
}
