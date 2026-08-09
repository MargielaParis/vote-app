export const LIMITS = {
  TITLE_MAX: 100,
  DESC_MAX: 1000,

  OPTIONS_MIN: 2,
  OPTIONS_MAX: 30,
  OPTION_LABEL_MAX: 80,

  NAME_MAX: 20,
  PASSWORD_MIN: 4,
  PASSWORD_MAX: 72,

  MAX_BALLOTS: 300,
  BODY_BYTES_MAX: 32 * 1024,

  APPT_DAYS_MAX: 31,
  APPT_SLOTS_MAX: 1488,

  DEADLINE_MAX_AHEAD_MS: 365 * 24 * 60 * 60 * 1000,

  POLL_ID_LEN: 12,
  POLL_ID_ALPHABET: '23456789abcdefghjkmnpqrstuvwxyz',

  // KV metadata hard limit is 1024 bytes; stay under it and fall back to get() past this.
  METADATA_SOFT_MAX: 900,

  // Every write refreshes this, so anything actively used never expires.
  KEY_TTL_SECONDS: 400 * 24 * 60 * 60,
  ADMIN_TOKEN_TTL_SECONDS: 2 * 60 * 60,
  LOCK_TTL_SECONDS: 300,
  PW_FAILS_BEFORE_LOCK: 5,

  RESULT_MEMO_MS: 10_000,
  RESULT_MEMO_ENTRIES: 200,
}

export const POLL_ID_RE = /^[23456789abcdefghjkmnpqrstuvwxyz]{12}$/
