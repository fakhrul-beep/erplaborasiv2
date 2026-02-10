
DO $$
DECLARE
    policy_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE tablename = 'orders'
    ) INTO policy_exists;

    IF NOT policy_exists THEN
        -- Create a default permissive policy if none exists (for debugging/dev)
        -- In production, you'd want stricter policies
        EXECUTE 'CREATE POLICY "Enable all access for authenticated users" ON "public"."orders" AS PERMISSIVE FOR ALL TO "authenticated" USING (true) WITH CHECK (true)';
    END IF;
END
$$;
