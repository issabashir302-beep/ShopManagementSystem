import crypto from 'node:crypto'

export function ean13CheckDigit(firstTwelveDigits) {
  const digits = String(firstTwelveDigits)
  if (!/^\d{12}$/.test(digits)) throw new TypeError('EAN-13 payload must contain 12 digits')
  const sum = [...digits].reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0)
  return String((10 - (sum % 10)) % 10)
}

export function generateInternalBarcode() {
  // GS1 prefixes beginning with 20 are reserved for restricted/internal use.
  const payload = `20${crypto.randomInt(0, 10_000_000_000).toString().padStart(10, '0')}`
  return `${payload}${ean13CheckDigit(payload)}`
}
