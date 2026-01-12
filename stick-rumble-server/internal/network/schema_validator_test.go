package network

import (
	"testing"
	"time"
)

func TestSchemaValidatorValidate(t *testing.T) {
	loader, err := NewSchemaLoader("../../../events-schema/schemas/client-to-server")
	if err != nil {
		t.Fatalf("Failed to create schema loader: %v", err)
	}

	validator := NewSchemaValidator(loader)

	tests := []struct {
		name       string
		schemaName string
		data       map[string]interface{}
		wantValid  bool
	}{
		{
			name:       "valid input-state data",
			schemaName: "input-state-data",
			data: map[string]interface{}{
				"up":       true,
				"down":     false,
				"left":     true,
				"right":    false,
				"aimAngle": 1.5,
			},
			wantValid: true,
		},
		{
			name:       "input-state with missing required field",
			schemaName: "input-state-data",
			data: map[string]interface{}{
				"up":       true,
				"down":     false,
				"left":     true,
				"aimAngle": 1.5,
				// missing "right"
			},
			wantValid: false,
		},
		{
			name:       "input-state with wrong type",
			schemaName: "input-state-data",
			data: map[string]interface{}{
				"up":       "true", // should be bool
				"down":     false,
				"left":     true,
				"right":    false,
				"aimAngle": 1.5,
			},
			wantValid: false,
		},
		{
			name:       "valid player-shoot data",
			schemaName: "player-shoot-data",
			data: map[string]interface{}{
				"aimAngle": 3.14,
			},
			wantValid: true,
		},
		{
			name:       "player-shoot with missing aimAngle",
			schemaName: "player-shoot-data",
			data:       map[string]interface{}{},
			wantValid:  false,
		},
		{
			name:       "valid weapon-pickup-attempt data",
			schemaName: "weapon-pickup-attempt-data",
			data: map[string]interface{}{
				"crateId": "crate-123",
			},
			wantValid: true,
		},
		{
			name:       "weapon-pickup-attempt with empty crateId",
			schemaName: "weapon-pickup-attempt-data",
			data: map[string]interface{}{
				"crateId": "",
			},
			wantValid: false, // Empty string fails minLength: 1 validation
		},
		{
			name:       "validation with non-existent schema",
			schemaName: "nonexistent-schema",
			data: map[string]interface{}{
				"test": "data",
			},
			wantValid: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validator.Validate(tt.schemaName, tt.data)

			if tt.wantValid && err != nil {
				t.Errorf("Validate() expected valid, got error: %v", err)
			}

			if !tt.wantValid && err == nil {
				t.Errorf("Validate() expected invalid, got nil error")
			}
		})
	}
}

func TestSchemaValidatorValidateWithDetails(t *testing.T) {
	loader, err := NewSchemaLoader("../../../events-schema/schemas/client-to-server")
	if err != nil {
		t.Fatalf("Failed to create schema loader: %v", err)
	}

	validator := NewSchemaValidator(loader)

	// Test with invalid data to get detailed error
	data := map[string]interface{}{
		"up":    "not-a-bool", // wrong type
		"down":  false,
		"left":  true,
		"right": false,
		// missing aimAngle
	}

	err = validator.Validate("input-state-data", data)
	if err == nil {
		t.Fatal("Expected validation error, got nil")
	}

	// Error should contain useful information
	errMsg := err.Error()
	if errMsg == "" {
		t.Error("Expected non-empty error message")
	}
}

func TestSchemaValidatorWithNilData(t *testing.T) {
	loader, err := NewSchemaLoader("../../../events-schema/schemas/client-to-server")
	if err != nil {
		t.Fatalf("Failed to create schema loader: %v", err)
	}

	validator := NewSchemaValidator(loader)

	err = validator.Validate("input-state-data", nil)
	if err == nil {
		t.Error("Validate() with nil data expected error, got nil")
	}
}

func TestSchemaValidatorEdgeCases(t *testing.T) {
	loader, err := NewSchemaLoader("../../../events-schema/schemas/client-to-server")
	if err != nil {
		t.Fatalf("Failed to create schema loader: %v", err)
	}

	validator := NewSchemaValidator(loader)

	tests := []struct {
		name       string
		schemaName string
		data       interface{}
		wantValid  bool
	}{
		{
			name:       "aimAngle with NaN (will fail schema validation)",
			schemaName: "player-shoot-data",
			data: map[string]interface{}{
				"aimAngle": "NaN", // JSON can't have NaN, it becomes string
			},
			wantValid: false,
		},
		{
			name:       "extra fields in data (should be allowed)",
			schemaName: "input-state-data",
			data: map[string]interface{}{
				"up":         true,
				"down":       false,
				"left":       true,
				"right":      false,
				"aimAngle":   1.5,
				"extraField": "extra", // additional property
			},
			wantValid: true, // Schema doesn't specify additionalProperties: false
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validator.Validate(tt.schemaName, tt.data)

			if tt.wantValid && err != nil {
				t.Errorf("Validate() expected valid, got error: %v", err)
			}

			if !tt.wantValid && err == nil {
				t.Errorf("Validate() expected invalid, got nil error")
			}
		})
	}
}

func TestSchemaValidatorPerformance(t *testing.T) {
	loader, err := NewSchemaLoader("../../../events-schema/schemas/client-to-server")
	if err != nil {
		t.Fatalf("Failed to create schema loader: %v", err)
	}

	validator := NewSchemaValidator(loader)

	data := map[string]interface{}{
		"up":       true,
		"down":     false,
		"left":     true,
		"right":    false,
		"aimAngle": 1.5,
	}

	// Validate multiple times to ensure caching works and measure performance
	start := time.Now()
	iterations := 1000
	for i := 0; i < iterations; i++ {
		err := validator.Validate("input-state-data", data)
		if err != nil {
			t.Fatalf("Validation failed on iteration %d: %v", i, err)
		}
	}
	elapsed := time.Since(start)

	// Calculate average time per validation
	avgPerValidation := elapsed / time.Duration(iterations)

	// For 20Hz game tick (50ms budget), validation should be fast (<100µs per call)
	maxAllowedTime := 100 * time.Microsecond
	if avgPerValidation > maxAllowedTime {
		t.Errorf("Validation too slow: avg %v per call (want <%v)", avgPerValidation, maxAllowedTime)
	}

	t.Logf("Performance: %d validations in %v (avg %v per validation)", iterations, elapsed, avgPerValidation)
}

func TestSchemaValidatorValidateAndLog(t *testing.T) {
	loader, err := NewSchemaLoader("../../../events-schema/schemas/client-to-server")
	if err != nil {
		t.Fatalf("Failed to create schema loader: %v", err)
	}

	validator := NewSchemaValidator(loader)

	tests := []struct {
		name       string
		schemaName string
		data       map[string]interface{}
		playerID   string
		wantValid  bool
	}{
		{
			name:       "valid data returns true",
			schemaName: "input-state-data",
			data: map[string]interface{}{
				"up":       true,
				"down":     false,
				"left":     true,
				"right":    false,
				"aimAngle": 1.5,
			},
			playerID:  "test-player-1",
			wantValid: true,
		},
		{
			name:       "invalid data returns false",
			schemaName: "input-state-data",
			data: map[string]interface{}{
				"up":   true,
				"down": false,
				// missing required fields
			},
			playerID:  "test-player-2",
			wantValid: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := validator.ValidateAndLog(tt.schemaName, tt.data, tt.playerID)
			if result != tt.wantValid {
				t.Errorf("ValidateAndLog() = %v, want %v", result, tt.wantValid)
			}
		})
	}
}

func TestSchemaValidatorBoundaryValues(t *testing.T) {
	loader, err := NewSchemaLoader("../../../events-schema/schemas/client-to-server")
	if err != nil {
		t.Fatalf("Failed to create schema loader: %v", err)
	}

	validator := NewSchemaValidator(loader)

	tests := []struct {
		name       string
		schemaName string
		data       map[string]interface{}
		wantValid  bool
	}{
		{
			name:       "aimAngle at zero",
			schemaName: "input-state-data",
			data: map[string]interface{}{
				"up":       false,
				"down":     false,
				"left":     false,
				"right":    false,
				"aimAngle": 0.0,
			},
			wantValid: true,
		},
		{
			name:       "aimAngle negative (valid)",
			schemaName: "player-shoot-data",
			data: map[string]interface{}{
				"aimAngle": -3.14159, // -π radians
			},
			wantValid: true,
		},
		{
			name:       "aimAngle large value",
			schemaName: "player-shoot-data",
			data: map[string]interface{}{
				"aimAngle": 314.159, // 100π radians
			},
			wantValid: true,
		},
		{
			name:       "aimAngle very small",
			schemaName: "player-shoot-data",
			data: map[string]interface{}{
				"aimAngle": 0.0001,
			},
			wantValid: true,
		},
		{
			name:       "aimAngle at 2π",
			schemaName: "player-shoot-data",
			data: map[string]interface{}{
				"aimAngle": 6.28318, // 2π radians (full circle)
			},
			wantValid: true,
		},
		{
			name:       "aimAngle as string should fail",
			schemaName: "player-shoot-data",
			data: map[string]interface{}{
				"aimAngle": "1.5", // string instead of number
			},
			wantValid: false,
		},
		{
			name:       "aimAngle as integer (valid - JSON numbers include integers)",
			schemaName: "player-shoot-data",
			data: map[string]interface{}{
				"aimAngle": 1, // integer, not float
			},
			wantValid: true,
		},
		{
			name:       "boolean as array should fail",
			schemaName: "input-state-data",
			data: map[string]interface{}{
				"up":       []bool{true}, // array instead of bool
				"down":     false,
				"left":     false,
				"right":    false,
				"aimAngle": 0.0,
			},
			wantValid: false,
		},
		{
			name:       "boolean as object should fail",
			schemaName: "input-state-data",
			data: map[string]interface{}{
				"up":       map[string]bool{"value": true}, // object instead of bool
				"down":     false,
				"left":     false,
				"right":    false,
				"aimAngle": 0.0,
			},
			wantValid: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validator.Validate(tt.schemaName, tt.data)

			if tt.wantValid && err != nil {
				t.Errorf("Validate() expected valid, got error: %v", err)
			}

			if !tt.wantValid && err == nil {
				t.Errorf("Validate() expected invalid, got nil error")
			}
		})
	}
}

// BenchmarkSchemaValidation benchmarks schema validation performance
func BenchmarkSchemaValidation(b *testing.B) {
	loader, err := NewSchemaLoader("../../../events-schema/schemas/client-to-server")
	if err != nil {
		b.Fatalf("Failed to create schema loader: %v", err)
	}

	validator := NewSchemaValidator(loader)

	data := map[string]interface{}{
		"up":       true,
		"down":     false,
		"left":     true,
		"right":    false,
		"aimAngle": 1.5,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = validator.Validate("input-state-data", data)
	}
}

// BenchmarkSchemaValidationVaryingData benchmarks with varying data values
func BenchmarkSchemaValidationVaryingData(b *testing.B) {
	loader, err := NewSchemaLoader("../../../events-schema/schemas/client-to-server")
	if err != nil {
		b.Fatalf("Failed to create schema loader: %v", err)
	}

	validator := NewSchemaValidator(loader)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		data := map[string]interface{}{
			"up":       i%2 == 0,
			"down":     i%3 == 0,
			"left":     i%5 == 0,
			"right":    i%7 == 0,
			"aimAngle": float64(i%360) * 0.0174533, // Convert degrees to radians
		}
		_ = validator.Validate("input-state-data", data)
	}
}

func TestSchemaValidatorConcurrentValidation(t *testing.T) {
	loader, err := NewSchemaLoader("../../../events-schema/schemas/client-to-server")
	if err != nil {
		t.Fatalf("Failed to create schema loader: %v", err)
	}

	validator := NewSchemaValidator(loader)

	// Simulate concurrent validation calls as would happen in 20Hz game loop
	// with multiple players
	numGoroutines := 50
	iterationsPerGoroutine := 100
	done := make(chan error, numGoroutines)

	for g := 0; g < numGoroutines; g++ {
		go func(goroutineID int) {
			for i := 0; i < iterationsPerGoroutine; i++ {
				data := map[string]interface{}{
					"up":       i%2 == 0,
					"down":     i%3 == 0,
					"left":     i%5 == 0,
					"right":    i%7 == 0,
					"aimAngle": float64(goroutineID+i) * 0.1,
				}

				err := validator.Validate("input-state-data", data)
				if err != nil {
					done <- err
					return
				}
			}
			done <- nil
		}(g)
	}

	// Wait for all goroutines to complete
	for i := 0; i < numGoroutines; i++ {
		err := <-done
		if err != nil {
			t.Errorf("Concurrent validation failed: %v", err)
		}
	}

	t.Logf("Successfully completed %d concurrent validations (%d goroutines × %d iterations)",
		numGoroutines*iterationsPerGoroutine, numGoroutines, iterationsPerGoroutine)
}
