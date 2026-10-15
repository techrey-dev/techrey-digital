const witaOffset = 8 * 60 * 60 * 1000

/** Value for a datetime-local input whose label explicitly specifies WITA. */
export function toWitaInput(value?: string) {
  const timestamp = Date.parse(value ?? "")
  return Number.isFinite(timestamp) ? new Date(timestamp + witaOffset).toISOString().slice(0, 16) : ""
}

export function orderDeadline(choice: string, customValue: string, now = Date.now()) {
  if (choice === "custom") return customValue ? `${customValue}:00+08:00` : ""
  const days = choice === "1-2-days" ? 2 : choice === "1-week" ? 7 : 4
  // Shift epoch by WITA offset so toISOString() yields the WITA calendar date
  const date = new Date(now + days * 86400000 + witaOffset).toISOString().slice(0, 10)
  return `${date}T18:00:00+08:00`
}
