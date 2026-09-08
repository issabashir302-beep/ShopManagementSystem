import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ean13CheckDigit, generateInternalBarcode } from './barcode.js'

describe('internal product barcodes', () => {
  it('calculates an EAN-13 check digit', () => {
    assert.equal(ean13CheckDigit('400638133393'), '1')
  })

  it('generates a restricted-use EAN-13 value', () => {
    const barcode = generateInternalBarcode()
    assert.match(barcode, /^20\d{11}$/)
    assert.equal(barcode.at(-1), ean13CheckDigit(barcode.slice(0, 12)))
  })
})
