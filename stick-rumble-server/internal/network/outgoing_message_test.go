package network

import (
	"encoding/json"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOutgoingMessageBuilderBuildsEnvelopeWithClockTimestamp(t *testing.T) {
	t.Setenv("ENABLE_SCHEMA_VALIDATION", "false")

	builder := newOutgoingMessageBuilder(nil, func() time.Time {
		return time.UnixMilli(1234567890)
	})

	msgBytes, err := builder.Build("match:timer", map[string]any{
		"remainingSeconds": 120,
	})
	require.NoError(t, err)

	var message Message
	require.NoError(t, json.Unmarshal(msgBytes, &message))

	assert.Equal(t, "match:timer", message.Type)
	assert.Equal(t, int64(1234567890), message.Timestamp)

	data, ok := message.Data.(map[string]any)
	require.True(t, ok)
	assert.Equal(t, float64(120), data["remainingSeconds"])
}

func TestOutgoingMessageBuilderRejectsUnmarshalablePayload(t *testing.T) {
	t.Setenv("ENABLE_SCHEMA_VALIDATION", "false")

	builder := newOutgoingMessageBuilder(nil, func() time.Time {
		return time.UnixMilli(1)
	})

	_, err := builder.Build("test:bad", map[string]any{
		"unsupported": make(chan int),
	})

	assert.Error(t, err)
}

func TestOutgoingMessageCallSitesUseBuilder(t *testing.T) {
	for _, fileName := range []string{"broadcast_helper.go", "message_processor.go"} {
		source, err := os.ReadFile(fileName)
		require.NoError(t, err)

		assert.NotContains(t, string(source), "validateOutgoingMessage(")
	}
}
