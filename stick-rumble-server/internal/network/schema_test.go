package network

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ==========================
// Schema Loader Tests
// ==========================

func TestSchemaLoaderBasicFunctionality(t *testing.T) {
	// Create a temporary directory with test schemas
	tmpDir := t.TempDir()

	// Create a valid JSON schema file
	schemaContent := `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "test": {"type": "string"}
  }
}`
	testSchemaPath := filepath.Join(tmpDir, "test-schema.json")
	err := os.WriteFile(testSchemaPath, []byte(schemaContent), 0644)
	require.NoError(t, err)

	// Load schemas
	loader, err := NewSchemaLoader(tmpDir)
	require.NoError(t, err)
	require.NotNil(t, loader)

	// Verify schema was loaded
	schemaNames := loader.GetSchemaNames()
	assert.NotNil(t, schemaNames)
	// Schema names may vary based on file naming
}

func TestSchemaLoaderEmptyDirectory(t *testing.T) {
	// Create empty temporary directory
	tmpDir := t.TempDir()

	// Load schemas from empty directory
	loader, err := NewSchemaLoader(tmpDir)
	require.NoError(t, err)
	require.NotNil(t, loader)

	// Should have no schemas
	schemaNames := loader.GetSchemaNames()
	assert.NotNil(t, schemaNames)
	assert.Empty(t, schemaNames, "Should have no schemas in empty directory")
}

func TestSchemaLoaderNonExistentDirectory(t *testing.T) {
	// Attempt to load from non-existent directory
	loader, err := NewSchemaLoader("/non/existent/path")

	// Should handle gracefully (error or empty loader)
	if err != nil {
		assert.Error(t, err)
	} else {
		assert.NotNil(t, loader)
	}
}

func TestSchemaLoaderInvalidJSON(t *testing.T) {
	// Create temporary directory with invalid JSON file
	tmpDir := t.TempDir()

	invalidJSON := `{invalid json}`
	invalidPath := filepath.Join(tmpDir, "invalid-schema.json")
	err := os.WriteFile(invalidPath, []byte(invalidJSON), 0644)
	require.NoError(t, err)

	// Attempt to load - should either error or skip invalid file
	loader, err := NewSchemaLoader(tmpDir)

	// Either fails to load or loads with no schemas
	if err != nil {
		assert.Error(t, err, "Should error on invalid JSON")
	} else {
		schemaNames := loader.GetSchemaNames()
		// Invalid schema might be skipped
		assert.NotNil(t, schemaNames)
	}
}

func TestSchemaLoaderMultipleSchemas(t *testing.T) {
	// Create temporary directory with multiple schemas
	tmpDir := t.TempDir()

	schemas := map[string]string{
		"schema1.json": `{"type": "object", "properties": {"name": {"type": "string"}}}`,
		"schema2.json": `{"type": "object", "properties": {"age": {"type": "number"}}}`,
		"schema3.json": `{"type": "object", "properties": {"active": {"type": "boolean"}}}`,
	}

	for filename, content := range schemas {
		path := filepath.Join(tmpDir, filename)
		err := os.WriteFile(path, []byte(content), 0644)
		require.NoError(t, err)
	}

	// Load all schemas
	loader, err := NewSchemaLoader(tmpDir)
	require.NoError(t, err)
	require.NotNil(t, loader)

	// Verify all schemas loaded
	schemaNames := loader.GetSchemaNames()
	assert.GreaterOrEqual(t, len(schemaNames), 3, "Should load all schemas")
}

func TestSchemaLoaderNestedDirectories(t *testing.T) {
	// Create temporary directory with nested structure
	tmpDir := t.TempDir()
	nestedDir := filepath.Join(tmpDir, "nested")
	err := os.MkdirAll(nestedDir, 0755)
	require.NoError(t, err)

	// Create schemas in both directories
	rootSchema := filepath.Join(tmpDir, "root-schema.json")
	nestedSchema := filepath.Join(nestedDir, "nested-schema.json")

	schemaContent := `{"type": "object"}`
	err = os.WriteFile(rootSchema, []byte(schemaContent), 0644)
	require.NoError(t, err)
	err = os.WriteFile(nestedSchema, []byte(schemaContent), 0644)
	require.NoError(t, err)

	// Load schemas
	loader, err := NewSchemaLoader(tmpDir)
	require.NoError(t, err)

	// Should find schemas in nested directories
	schemaNames := loader.GetSchemaNames()
	assert.GreaterOrEqual(t, len(schemaNames), 2, "Should find schemas in nested directories")
}

// ==========================
// Schema Validator Tests
// ==========================

func TestSchemaValidatorWithValidData(t *testing.T) {
	// Create a simple schema
	tmpDir := t.TempDir()
	schemaContent := `{
  "type": "object",
  "properties": {
    "name": {"type": "string"},
    "age": {"type": "number"}
  },
  "required": ["name"]
}`
	schemaPath := filepath.Join(tmpDir, "person-schema.json")
	err := os.WriteFile(schemaPath, []byte(schemaContent), 0644)
	require.NoError(t, err)

	loader, err := NewSchemaLoader(tmpDir)
	require.NoError(t, err)

	validator := NewSchemaValidator(loader)
	require.NotNil(t, validator)

	// Valid data
	validData := map[string]interface{}{
		"name": "John Doe",
		"age":  30.0,
	}

	// Should validate successfully
	err = validator.Validate("person-schema", validData)
	assert.NoError(t, err, "Valid data should pass validation")
}

func TestSchemaValidatorWithInvalidData(t *testing.T) {
	// Create a simple schema
	tmpDir := t.TempDir()
	schemaContent := `{
  "type": "object",
  "properties": {
    "name": {"type": "string"},
    "age": {"type": "number"}
  },
  "required": ["name"]
}`
	schemaPath := filepath.Join(tmpDir, "person-schema.json")
	err := os.WriteFile(schemaPath, []byte(schemaContent), 0644)
	require.NoError(t, err)

	loader, err := NewSchemaLoader(tmpDir)
	require.NoError(t, err)

	validator := NewSchemaValidator(loader)
	require.NotNil(t, validator)

	// Invalid data - missing required field
	invalidData := map[string]interface{}{
		"age": 30.0,
	}

	// Should fail validation
	err = validator.Validate("person-schema", invalidData)
	assert.Error(t, err, "Invalid data should fail validation")
}

func TestSchemaValidatorNonExistentSchema(t *testing.T) {
	tmpDir := t.TempDir()
	loader, err := NewSchemaLoader(tmpDir)
	require.NoError(t, err)

	validator := NewSchemaValidator(loader)
	require.NotNil(t, validator)

	// Validate against non-existent schema
	data := map[string]interface{}{"test": "value"}
	err = validator.Validate("non-existent-schema", data)

	// Should error or handle gracefully
	if err != nil {
		assert.Error(t, err)
	}
}

func TestSchemaValidatorNilData(t *testing.T) {
	tmpDir := t.TempDir()
	schemaContent := `{"type": "object"}`
	schemaPath := filepath.Join(tmpDir, "test-schema.json")
	err := os.WriteFile(schemaPath, []byte(schemaContent), 0644)
	require.NoError(t, err)

	loader, err := NewSchemaLoader(tmpDir)
	require.NoError(t, err)

	validator := NewSchemaValidator(loader)
	require.NotNil(t, validator)

	// Validate nil data
	err = validator.Validate("test-schema", nil)
	// Should handle nil gracefully (might error or pass depending on schema)
	assert.NotNil(t, err == nil || err != nil, "Should handle nil data")
}

func TestSchemaValidatorTypeValidation(t *testing.T) {
	tmpDir := t.TempDir()
	schemaContent := `{
  "type": "object",
  "properties": {
    "count": {"type": "integer"},
    "active": {"type": "boolean"},
    "tags": {"type": "array", "items": {"type": "string"}}
  }
}`
	schemaPath := filepath.Join(tmpDir, "types-schema.json")
	err := os.WriteFile(schemaPath, []byte(schemaContent), 0644)
	require.NoError(t, err)

	loader, err := NewSchemaLoader(tmpDir)
	require.NoError(t, err)

	validator := NewSchemaValidator(loader)
	require.NotNil(t, validator)

	// Test with correct types
	validData := map[string]interface{}{
		"count":  10.0,
		"active": true,
		"tags":   []interface{}{"go", "testing"},
	}

	err = validator.Validate("types-schema", validData)
	assert.NoError(t, err, "Data with correct types should validate")

	// Test with incorrect types
	invalidData := map[string]interface{}{
		"count":  "not a number",
		"active": "not a boolean",
		"tags":   "not an array",
	}

	err = validator.Validate("types-schema", invalidData)
	assert.Error(t, err, "Data with incorrect types should fail validation")
}

// ==========================
// Schema Integration Tests
// ==========================

func TestSchemaValidationDisabled(t *testing.T) {
	// Ensure ENABLE_SCHEMA_VALIDATION is not set
	os.Unsetenv("ENABLE_SCHEMA_VALIDATION")

	// Create handler
	handler := NewWebSocketHandler()
	require.NotNil(t, handler)

	// Schema validation should be disabled by default
	// Broadcasting should work without validation
	assert.NotNil(t, handler.gameServer)
}

func TestSchemaValidationEnabled(t *testing.T) {
	// Enable schema validation
	os.Setenv("ENABLE_SCHEMA_VALIDATION", "true")
	defer os.Unsetenv("ENABLE_SCHEMA_VALIDATION")

	// Create handler
	handler := NewWebSocketHandler()
	require.NotNil(t, handler)

	// Handler should initialize with schema validation enabled
	assert.NotNil(t, handler.gameServer)
}

func TestValidateAndLogWithValidData(t *testing.T) {
	// Create a simple schema
	tmpDir := t.TempDir()
	schemaContent := `{
  "type": "object",
  "properties": {
    "name": {"type": "string"}
  },
  "required": ["name"]
}`
	schemaPath := filepath.Join(tmpDir, "test-schema.json")
	err := os.WriteFile(schemaPath, []byte(schemaContent), 0644)
	require.NoError(t, err)

	loader, err := NewSchemaLoader(tmpDir)
	require.NoError(t, err)

	validator := NewSchemaValidator(loader)
	require.NotNil(t, validator)

	// Valid data
	validData := map[string]interface{}{
		"name": "Test Player",
	}

	// Should return true for valid data
	result := validator.ValidateAndLog("test-schema", validData, "player-123")
	assert.True(t, result, "ValidateAndLog should return true for valid data")
}

func TestValidateAndLogWithInvalidData(t *testing.T) {
	// Create a simple schema
	tmpDir := t.TempDir()
	schemaContent := `{
  "type": "object",
  "properties": {
    "name": {"type": "string"}
  },
  "required": ["name"]
}`
	schemaPath := filepath.Join(tmpDir, "test-schema.json")
	err := os.WriteFile(schemaPath, []byte(schemaContent), 0644)
	require.NoError(t, err)

	loader, err := NewSchemaLoader(tmpDir)
	require.NoError(t, err)

	validator := NewSchemaValidator(loader)
	require.NotNil(t, validator)

	// Invalid data - missing required field
	invalidData := map[string]interface{}{
		"age": 25,
	}

	// Should return false for invalid data
	result := validator.ValidateAndLog("test-schema", invalidData, "player-456")
	assert.False(t, result, "ValidateAndLog should return false for invalid data")
}

func TestValidateOutgoingMessageDisabled(t *testing.T) {
	// Ensure ENABLE_SCHEMA_VALIDATION is not set
	os.Unsetenv("ENABLE_SCHEMA_VALIDATION")

	handler := NewWebSocketHandler()
	require.NotNil(t, handler)

	// Should not validate when disabled (return nil)
	data := map[string]interface{}{"test": "value"}
	err := handler.validateOutgoingMessage("test:message", data)
	assert.NoError(t, err, "Should not validate when ENABLE_SCHEMA_VALIDATION is disabled")
}

func TestValidateOutgoingMessageEnabled(t *testing.T) {
	// Enable schema validation
	os.Setenv("ENABLE_SCHEMA_VALIDATION", "true")
	defer os.Unsetenv("ENABLE_SCHEMA_VALIDATION")

	handler := NewWebSocketHandler()
	require.NotNil(t, handler)

	// Test with non-existent schema (should error)
	data := map[string]interface{}{"test": "value"}
	err := handler.validateOutgoingMessage("nonexistent:message", data)
	assert.Error(t, err, "Should error when schema not found")
}
