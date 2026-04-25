package network

import (
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/mtomcal/stick-rumble-server/internal/config"
)

type outgoingMessageBuilder struct {
	validator *SchemaValidator
	now       func() time.Time
}

func newOutgoingMessageBuilder(validator *SchemaValidator, now func() time.Time) *outgoingMessageBuilder {
	if now == nil {
		now = time.Now
	}

	return &outgoingMessageBuilder{
		validator: validator,
		now:       now,
	}
}

func (b *outgoingMessageBuilder) Build(messageType string, data any) ([]byte, error) {
	if err := b.Validate(messageType, data); err != nil {
		return nil, err
	}

	message := Message{
		Type:      messageType,
		Timestamp: b.now().UnixMilli(),
		Data:      data,
	}

	msgBytes, err := json.Marshal(message)
	if err != nil {
		return nil, fmt.Errorf("marshal %s: %w", messageType, err)
	}

	return msgBytes, nil
}

func (b *outgoingMessageBuilder) Validate(messageType string, data any) (err error) {
	if !config.Load().EnableSchemaValidation {
		return nil
	}

	if b.validator == nil {
		return fmt.Errorf("outgoing validator is not configured")
	}

	defer func() {
		if r := recover(); r != nil {
			log.Printf("Schema validator panicked for %s: %v", messageType, r)
			err = fmt.Errorf("validator panic: %v", r)
		}
	}()

	schemaName := outgoingSchemaName(messageType)
	err = b.validator.Validate(schemaName, data)
	if err != nil {
		log.Printf("Outgoing message validation failed for %s: %v", messageType, err)
		return err
	}

	return nil
}

func outgoingSchemaName(messageType string) string {
	schemaName := strings.ReplaceAll(messageType, ":", "-")
	schemaName = strings.ReplaceAll(schemaName, "_", "-")
	return schemaName + "-data"
}
