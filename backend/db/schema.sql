-- SWMS database schema (PostgreSQL 13+; the live database runs PostgreSQL 18).
-- Generated from the live database schema (pg_dump --schema-only) and rewritten for readability;
-- applying this file to an empty database gives the same tables, constraints, indexes and triggers.
--
-- Apply to a NEW, EMPTY database (it does not drop or change existing tables):
--   psql "<connection string>" -v ON_ERROR_STOP=1 -f db/schema.sql
-- Everything runs in one transaction: if any statement fails, nothing is created.

BEGIN;

-- ─── updated_at trigger function ─────────────────────────────────────────────

CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- ─── users ───────────────────────────────────────────────────────────────────

CREATE TABLE users (
    id             uuid                     PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name      varchar(100)             NOT NULL,
    email          varchar(255)             NOT NULL,
    password_hash  text                     NOT NULL,
    role           varchar(10)              NOT NULL DEFAULT 'user',
    is_active      boolean                  NOT NULL DEFAULT true,
    created_at     timestamp with time zone NOT NULL DEFAULT now(),
    updated_at     timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT users_role_check CHECK (role IN ('admin', 'user'))
);

-- Email is unique regardless of letter case.
CREATE UNIQUE INDEX users_email_lower_uq ON users (lower(email));

CREATE TRIGGER users_set_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── waste_reports ───────────────────────────────────────────────────────────

CREATE TABLE waste_reports (
    id                     uuid                     PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                uuid                     NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    description            text                     NOT NULL,
    category               varchar(10)              NOT NULL,
    status                 varchar(15)              NOT NULL DEFAULT 'pending',
    image_url              text                     NOT NULL,
    latitude               numeric(9,6)             NOT NULL,
    longitude              numeric(9,6)             NOT NULL,
    address                text,
    ai_predicted_category  varchar(10),
    ai_confidence          numeric(5,4),
    ai_model_version       varchar(50),
    admin_note             text,
    created_at             timestamp with time zone NOT NULL DEFAULT now(),
    updated_at             timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT waste_reports_ai_confidence_check
        CHECK (ai_confidence >= 0 AND ai_confidence <= 1),
    CONSTRAINT waste_reports_ai_predicted_category_check
        CHECK (ai_predicted_category IN ('organic', 'plastic', 'paper')),
    -- The AI category and confidence are either both set or both NULL.
    CONSTRAINT waste_reports_ai_result_complete
        CHECK ((ai_predicted_category IS NULL) = (ai_confidence IS NULL)),
    CONSTRAINT waste_reports_category_check
        CHECK (category IN ('organic', 'plastic', 'paper')),
    CONSTRAINT waste_reports_description_check
        CHECK (char_length(trim(description)) >= 1 AND char_length(trim(description)) <= 1000),
    CONSTRAINT waste_reports_latitude_check
        CHECK (latitude >= -90 AND latitude <= 90),
    CONSTRAINT waste_reports_longitude_check
        CHECK (longitude >= -180 AND longitude <= 180),
    CONSTRAINT waste_reports_status_check
        CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected'))
);

CREATE INDEX waste_reports_user_created_idx   ON waste_reports (user_id, created_at DESC);
CREATE INDEX waste_reports_status_created_idx ON waste_reports (status, created_at DESC);
CREATE INDEX waste_reports_category_idx       ON waste_reports (category);

CREATE TRIGGER waste_reports_set_updated_at
    BEFORE UPDATE ON waste_reports
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── report_status_history ───────────────────────────────────────────────────
-- Status transitions (pending -> in_progress | rejected, in_progress -> completed | rejected)
-- are enforced by the backend, not by the database.

CREATE TABLE report_status_history (
    id          bigint                   GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    report_id   uuid                     NOT NULL REFERENCES waste_reports (id) ON DELETE CASCADE,
    old_status  varchar(15),
    new_status  varchar(15)              NOT NULL,
    changed_by  uuid                     NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    note        text,
    created_at  timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT report_status_history_new_status_check
        CHECK (new_status IN ('pending', 'in_progress', 'completed', 'rejected')),
    CONSTRAINT report_status_history_old_status_check
        CHECK (old_status IS NULL OR old_status IN ('pending', 'in_progress', 'completed', 'rejected'))
);

CREATE INDEX report_status_history_report_idx ON report_status_history (report_id, created_at);

COMMIT;
