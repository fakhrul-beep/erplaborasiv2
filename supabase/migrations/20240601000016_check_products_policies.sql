
DO $$
DECLARE
    policy_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE tablename = 'products'
    ) INTO policy_exists;

    IF NOT policy_exists THEN
        -- Create a default permissive policy if none exists
        EXECUTE 'CREATE POLICY "Enable all access for authenticated users" ON "public"."products" AS PERMISSIVE FOR ALL TO "authenticated" USING (true) WITH CHECK (true)';
    END IF;
END
$$;
