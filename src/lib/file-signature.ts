const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

function startsWith(bytes: Buffer, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value)
}

/**
 * Browser supplied MIME types and file names are not trustworthy. This small
 * allow-list verifies the binary header before a file can enter storage.
 */
export function hasExpectedFileSignature(mimeType: string, bytes: Buffer) {
  if (mimeType === "application/pdf") return bytes.subarray(0, 5).toString("ascii") === "%PDF-"
  if (mimeType === "image/jpeg") return startsWith(bytes, [0xff, 0xd8, 0xff])
  if (mimeType === "image/png") return startsWith(bytes, PNG_SIGNATURE)
  if (mimeType === "image/webp") {
    return bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP"
  }
  return false
}
