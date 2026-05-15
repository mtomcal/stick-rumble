package game

import (
	"strings"
	"unicode"
)

// SanitizeDisplayNameString cleans up a display name for storage:
// removes non-printable characters, trims whitespace, collapses multiple spaces,
// returns "Player" if empty, and truncates to MaxDisplayNameLen (16) characters.
func SanitizeDisplayNameString(raw string) string {
	cleaned := strings.Map(func(r rune) rune {
		if unicode.IsPrint(r) {
			return r
		}
		return -1
	}, raw)

	cleaned = strings.TrimSpace(cleaned)

	fields := strings.Fields(cleaned)
	cleaned = strings.Join(fields, " ")

	if cleaned == "" {
		return "Player"
	}

	runes := []rune(cleaned)
	if len(runes) > MaxDisplayNameLen {
		cleaned = string(runes[:MaxDisplayNameLen])
	}

	return cleaned
}
