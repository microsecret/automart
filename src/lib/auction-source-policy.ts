export class PublicListingPolicyExcludedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PublicListingPolicyExcludedError"
  }
}

export function isPublicListingPolicyExcludedError(error: unknown): error is PublicListingPolicyExcludedError {
  return error instanceof PublicListingPolicyExcludedError
}

export function isCarsensorPriceOnRequest(value: number | null) {
  return value !== null && Number.isFinite(value) && value >= 999_999_999
}
