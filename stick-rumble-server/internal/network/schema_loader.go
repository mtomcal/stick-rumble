package network

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/kaptinlin/jsonschema"
)

// CompiledSchema wraps a compiled JSON schema
type CompiledSchema struct {
	Name   string
	Schema *jsonschema.Schema
}

// SchemaLoader manages loading and caching of JSON schemas
type SchemaLoader struct {
	schemas map[string]*CompiledSchema
	mu      sync.RWMutex
}

// NewSchemaLoader creates a new schema loader and loads all schemas from the directory
func NewSchemaLoader(schemaDir string) (*SchemaLoader, error) {
	loader := &SchemaLoader{
		schemas: make(map[string]*CompiledSchema),
	}

	// Check if directory exists
	if _, err := os.Stat(schemaDir); os.IsNotExist(err) {
		return nil, fmt.Errorf("schema directory does not exist: %s", schemaDir)
	}

	// Walk the directory and load all JSON schema files
	err := filepath.Walk(schemaDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Skip directories and non-JSON files
		if info.IsDir() || !strings.HasSuffix(path, ".json") {
			return nil
		}

		// Load the schema file
		if err := loader.loadSchemaFile(path); err != nil {
			return fmt.Errorf("failed to load schema %s: %w", path, err)
		}

		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to load schemas: %w", err)
	}

	log.Printf("Loaded %d JSON schemas from %s", len(loader.schemas), schemaDir)
	return loader, nil
}

// loadSchemaFile loads a single JSON schema file
func (l *SchemaLoader) loadSchemaFile(filePath string) error {
	// Read schema file
	schemaBytes, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("failed to read schema file: %w", err)
	}

	// Create JSON schema compiler
	compiler := jsonschema.NewCompiler()

	// Compile the schema
	schema, err := compiler.Compile(schemaBytes)
	if err != nil {
		return fmt.Errorf("failed to compile schema: %w", err)
	}

	// Extract schema name from filename (without extension)
	fileName := filepath.Base(filePath)
	schemaName := strings.TrimSuffix(fileName, ".json")

	// Store compiled schema
	l.mu.Lock()
	defer l.mu.Unlock()

	l.schemas[schemaName] = &CompiledSchema{
		Name:   schemaName,
		Schema: schema,
	}

	log.Printf("Loaded schema: %s", schemaName)
	return nil
}

// GetSchema retrieves a compiled schema by name (returns nil if not found)
func (l *SchemaLoader) GetSchema(name string) *CompiledSchema {
	l.mu.RLock()
	defer l.mu.RUnlock()
	return l.schemas[name]
}

// GetSchemaNames returns all loaded schema names
func (l *SchemaLoader) GetSchemaNames() []string {
	l.mu.RLock()
	defer l.mu.RUnlock()

	names := make([]string, 0, len(l.schemas))
	for name := range l.schemas {
		names = append(names, name)
	}
	return names
}
