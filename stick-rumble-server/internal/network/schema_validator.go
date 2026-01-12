package network

import (
	"fmt"
	"log"
)

// SchemaValidator provides validation using pre-loaded JSON schemas
type SchemaValidator struct {
	loader *SchemaLoader
}

// NewSchemaValidator creates a new schema validator
func NewSchemaValidator(loader *SchemaLoader) *SchemaValidator {
	return &SchemaValidator{
		loader: loader,
	}
}

// Validate validates data against a named schema
// Returns nil if validation succeeds, error if validation fails
func (v *SchemaValidator) Validate(schemaName string, data interface{}) error {
	// Check if data is nil
	if data == nil {
		return fmt.Errorf("validation failed: data is nil")
	}

	// Get the schema
	compiledSchema := v.loader.GetSchema(schemaName)
	if compiledSchema == nil {
		return fmt.Errorf("schema not found: %s", schemaName)
	}

	// Validate the data using zero-copy validation (direct on interface{})
	result := compiledSchema.Schema.Validate(data)

	// Check if validation passed
	if !result.IsValid() {
		// Get all validation errors as a flat list
		errorList := result.ToList()
		if errorList != nil && len(errorList.Errors) > 0 {
			// Log detailed errors server-side (don't expose to clients)
			log.Printf("Schema validation failed for %s: %v", schemaName, errorList.Errors)
			return fmt.Errorf("validation failed for %s: %d errors", schemaName, len(errorList.Errors))
		}
		return fmt.Errorf("validation failed for %s", schemaName)
	}

	return nil
}

// ValidateAndLog validates data and logs detailed errors
// Returns true if valid, false if invalid
func (v *SchemaValidator) ValidateAndLog(schemaName string, data interface{}, playerID string) bool {
	err := v.Validate(schemaName, data)
	if err != nil {
		log.Printf("Validation error for player %s: %v", playerID, err)
		return false
	}
	return true
}
