export const MAX_CHAT_MESSAGE_CHARS = 8_000;

// Single enforcement point for the composer character cap. The textarea's
// maxLength attribute stays as a defensive duplicate for plain typing, but
// programmatic writes (example append, error restore) must go through here.
export function clampChatMessage(value: string): string {
  return value.slice(0, MAX_CHAT_MESSAGE_CHARS);
}
