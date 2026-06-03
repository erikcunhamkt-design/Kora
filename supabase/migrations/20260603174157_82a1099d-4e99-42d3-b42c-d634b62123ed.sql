DROP POLICY IF EXISTS "Workspace members can receive workspace realtime" ON realtime.messages;
DROP POLICY IF EXISTS "Workspace members can send workspace realtime" ON realtime.messages;
ALTER TABLE realtime.messages DISABLE ROW LEVEL SECURITY;