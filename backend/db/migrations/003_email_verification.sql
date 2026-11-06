-- 003: email verification with a one-time code (only used when OTP_ENABLED=true).
-- Idempotent: safe to run more than once. Existing accounts (including the demo and admin accounts) count as
-- verified: the new column defaults to true. The backend explicitly creates new accounts as unverified only
-- while OTP_ENABLED=true, so running this (again) can never lock anyone out.
--
--   psql "<connection string>" -v ON_ERROR_STOP=1 -f db/migrations/003_email_verification.sql

BEGIN;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT true;

-- The current code for an unverified account: only a hash is stored, never the code itself.
CREATE TABLE IF NOT EXISTS email_verification_codes (
    user_id       uuid                     PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    code_hash     text                     NOT NULL,
    expires_at    timestamp with time zone NOT NULL,
    attempts      integer                  NOT NULL DEFAULT 0,
    last_sent_at  timestamp with time zone NOT NULL DEFAULT now()
);

COMMIT;
