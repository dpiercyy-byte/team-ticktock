/** Formats merchant names for consistent presentation in external exports. */
export function formatReceiptMerchantForExport(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en-CA")
    .replace(/(^|[\s-])([\p{L}\p{N}])/gu, (_match, boundary: string, character: string) =>
      `${boundary}${character.toLocaleUpperCase("en-CA")}`,
    );
}