-- Migration: Harden Storage RLS Policies
-- Description: Drops old policies and creates hardened policies checking format and workspace membership.

-- 1. Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "Allow workspace members to read client assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow workspace members to insert client assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow workspace members to update client assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow workspace members to delete client assets" ON storage.objects;

-- 2. Re-create SELECT policy with safety checks
CREATE POLICY "Allow workspace members to read client assets"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'client-assets'
  AND array_length(storage.foldername(name), 1) >= 1
  AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.is_workspace_member(((storage.foldername(name))[1])::uuid)
);

-- 3. Re-create INSERT policy with safety checks
CREATE POLICY "Allow workspace members to insert client assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'client-assets'
  AND array_length(storage.foldername(name), 1) >= 1
  AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.is_workspace_member(((storage.foldername(name))[1])::uuid)
);

-- 4. Re-create UPDATE policy with safety checks
CREATE POLICY "Allow workspace members to update client assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'client-assets'
  AND array_length(storage.foldername(name), 1) >= 1
  AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.is_workspace_member(((storage.foldername(name))[1])::uuid)
);

-- 5. Re-create DELETE policy with safety checks
CREATE POLICY "Allow workspace members to delete client assets"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'client-assets'
  AND array_length(storage.foldername(name), 1) >= 1
  AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.is_workspace_member(((storage.foldername(name))[1])::uuid)
);
