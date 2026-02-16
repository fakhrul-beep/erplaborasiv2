-- Add created_by column to payments for audit trail
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- Update RLS policies if necessary (optional, but good practice)
-- Existing policies might rely on order ownership, but created_by helps.
