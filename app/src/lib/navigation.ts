export function safeNextPath(value: string | null, fallback: string) {
  if (!value?.startsWith("/") || value.startsWith("//") || [...value].some((character) => character === "\\" || character.charCodeAt(0) <= 32)) return fallback
  return value
}
