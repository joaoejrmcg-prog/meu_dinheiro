-- ============================================
-- RECURRING APPOINTMENTS MIGRATION
-- Adds support for recurring appointments and exceptions
-- ============================================

-- Add recurrence fields to appointments table
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS recurrence_type TEXT CHECK (recurrence_type IS NULL OR recurrence_type IN ('weekly', 'monthly'));
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS recurrence_day_of_week INTEGER CHECK (recurrence_day_of_week IS NULL OR (recurrence_day_of_week >= 0 AND recurrence_day_of_week <= 6)); -- 0=Sunday, 6=Saturday
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS recurrence_day_of_month INTEGER CHECK (recurrence_day_of_month IS NULL OR (recurrence_day_of_month >= 1 AND recurrence_day_of_month <= 31));
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS recurrence_time TIME; -- Time of the recurring appointment
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS recurrence_end_date TIMESTAMPTZ; -- NULL = infinite

-- Create index for recurring appointments
CREATE INDEX IF NOT EXISTS idx_appointments_is_recurring ON appointments(is_recurring) WHERE is_recurring = TRUE;

-- ============================================
-- RECURRING EXCEPTIONS TABLE
-- Stores cancelled or rescheduled instances
-- ============================================
CREATE TABLE IF NOT EXISTS recurring_exceptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recurring_appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    exception_date DATE NOT NULL,
    exception_type TEXT NOT NULL CHECK (exception_type IN ('cancelled', 'rescheduled')),
    rescheduled_to TIMESTAMPTZ, -- Only used when exception_type = 'rescheduled'
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(recurring_appointment_id, exception_date)
);

-- Enable RLS for recurring_exceptions
ALTER TABLE recurring_exceptions ENABLE ROW LEVEL SECURITY;

-- Policies for recurring_exceptions
DROP POLICY IF EXISTS "Users can view their own recurring exceptions" ON recurring_exceptions;
CREATE POLICY "Users can view their own recurring exceptions"
    ON recurring_exceptions FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own recurring exceptions" ON recurring_exceptions;
CREATE POLICY "Users can insert their own recurring exceptions"
    ON recurring_exceptions FOR INSERT
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own recurring exceptions" ON recurring_exceptions;
CREATE POLICY "Users can update their own recurring exceptions"
    ON recurring_exceptions FOR UPDATE
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own recurring exceptions" ON recurring_exceptions;
CREATE POLICY "Users can delete their own recurring exceptions"
    ON recurring_exceptions FOR DELETE
    USING (user_id = auth.uid());

-- Indexes for recurring_exceptions
CREATE INDEX IF NOT EXISTS idx_recurring_exceptions_appointment ON recurring_exceptions(recurring_appointment_id);
CREATE INDEX IF NOT EXISTS idx_recurring_exceptions_date ON recurring_exceptions(exception_date);
CREATE INDEX IF NOT EXISTS idx_recurring_exceptions_user ON recurring_exceptions(user_id);
