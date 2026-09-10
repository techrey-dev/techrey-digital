export function buildWhatsAppLink(message: string, customNumber?: string): string {
  const digits = (customNumber || "6285198262541").replace(/\D/g, "")
  const number = digits.startsWith("0") ? `62${digits.slice(1)}` : digits
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}
