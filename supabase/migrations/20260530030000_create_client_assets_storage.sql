-- Migration: Create Client Assets Storage Bucket
-- Description: Creates the private bucket 'client-assets' and configures workspace-based RLS policies on storage.objects.

-- 1. Insert bucket definition
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'client-assets',
  'client-assets',
  false, -- private bucket
  2097152, -- 2MB limit in bytes
  ARRAY['image/png', 'image/jpeg', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET 
  public = false,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp']::text[];

-- 2. Create RLS Policies for client-assets objects based on workspace path segment
-- Path structure: workspaceId/clientId/technical-sheet/logo/filename
-- path_tokens[1] represents the first folder in the path, which is the workspaceId uuid.

CREATE POLICY "Allow workspace members to read client assets"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'client-assets'
  AND public.is_workspace_member((path_tokens[1])::uuid)
);

CREATE POLICY "Allow workspace members to insert client assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'client-assets'
  AND public.is_workspace_member((path_tokens[1])::uuid)
);

CREATE POLICY "Allow workspace members to update client assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'client-assets'
  AND public.is_workspace_member((path_tokens[1])::uuid)
);

CREATE POLICY "Allow workspace members to delete client assets"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'client-assets'
  AND public.is_workspace_member((path_tokens[1])::uuid)
);
