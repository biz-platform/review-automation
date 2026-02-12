export const ERROR_CODES = {
  UNAUTHORIZED: { code: "UNAUTHORIZED", message: "Authentication required" },
  STORE_NOT_FOUND: { code: "STORE_NOT_FOUND", message: "Store not found" },
  REVIEW_NOT_FOUND: { code: "REVIEW_NOT_FOUND", message: "Review not found" },
  REPLY_DRAFT_NOT_FOUND: { code: "REPLY_DRAFT_NOT_FOUND", message: "Reply draft not found" },
  VALIDATION_ERROR: { code: "VALIDATION_ERROR", message: "Validation failed" },
  INTERNAL_SERVER_ERROR: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" },
} as const;
