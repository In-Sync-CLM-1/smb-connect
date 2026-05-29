-- ==================== PROFILES POLICIES ====================

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- ==================== ASSOCIATIONS POLICIES ====================

-- Users in any company can view all associations
CREATE POLICY "Members can view associations"
  ON associations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM members
      WHERE members.user_id = auth.uid()
      AND members.is_active = true
    )
  );

-- ==================== COMPANIES POLICIES ====================

-- Users can view companies in their association
CREATE POLICY "Users can view companies in their association"
  ON companies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM members m
      JOIN companies c ON m.company_id = c.id
      WHERE m.user_id = auth.uid()
      AND c.association_id = companies.association_id
    )
  );

-- Company owners/admins can update their company
CREATE POLICY "Company owners can update company"
  ON companies FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM members
      WHERE members.company_id = companies.id
      AND members.user_id = auth.uid()
      AND members.role IN ('owner', 'admin')
    )
  );

-- Company owners can insert their company
CREATE POLICY "Users can create companies"
  ON companies FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ==================== MEMBERS POLICIES ====================

-- Users can view members in their association
CREATE POLICY "Users can view members in association"
  ON members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM members m
      JOIN companies c1 ON m.company_id = c1.id
      JOIN companies c2 ON members.company_id = c2.id
      WHERE m.user_id = auth.uid()
      AND c1.association_id = c2.association_id
    )
  );

-- Company owners/admins can manage members
CREATE POLICY "Company admins can manage members"
  ON members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.company_id = members.company_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin')
    )
  );

-- Users can insert themselves as members
CREATE POLICY "Users can create member records"
  ON members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ==================== CHAT POLICIES ====================

-- Users can view chats they're part of
CREATE POLICY "Users can view their chats"
  ON chats FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_participants cp
      JOIN members m ON cp.company_id = m.company_id
      WHERE cp.chat_id = chats.id
      AND m.user_id = auth.uid()
    )
  );

-- Users can create chats
CREATE POLICY "Users can create chats"
  ON chats FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Users can update their own chats
CREATE POLICY "Users can update their chats"
  ON chats FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM chat_participants cp
      JOIN members m ON cp.company_id = m.company_id
      WHERE cp.chat_id = chats.id
      AND m.user_id = auth.uid()
    )
  );

-- ==================== CHAT PARTICIPANTS POLICIES ====================

-- Users can view participants in their chats
CREATE POLICY "Users can view chat participants"
  ON chat_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_participants cp
      JOIN members m ON cp.company_id = m.company_id
      WHERE cp.chat_id = chat_participants.chat_id
      AND m.user_id = auth.uid()
    )
  );

-- Users can add participants to chats they're in
CREATE POLICY "Users can add chat participants"
  ON chat_participants FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_participants cp
      JOIN members m ON cp.company_id = m.company_id
      WHERE cp.chat_id = chat_participants.chat_id
      AND m.user_id = auth.uid()
    )
  );

-- ==================== MESSAGES POLICIES ====================

-- Users can view messages in their chats
CREATE POLICY "Users can view messages in their chats"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_participants cp
      JOIN members m ON cp.company_id = m.company_id
      WHERE cp.chat_id = messages.chat_id
      AND m.user_id = auth.uid()
    )
  );

-- Users can send messages in their chats
CREATE POLICY "Users can send messages"
  ON messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM members
      WHERE members.id = messages.sender_id
      AND members.user_id = auth.uid()
    )
  );

-- Users can update their own messages
CREATE POLICY "Users can update own messages"
  ON messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM members
      WHERE members.id = messages.sender_id
      AND members.user_id = auth.uid()
    )
  );

-- ==================== NOTIFICATIONS POLICIES ====================

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own notifications
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- System can create notifications
CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- ==================== ANALYTICS POLICIES ====================

-- Users can insert their own analytics events
CREATE POLICY "Users can track analytics"
  ON analytics_events FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Users can view their own analytics
CREATE POLICY "Users can view own analytics"
  ON analytics_events FOR SELECT
  USING (auth.uid() = user_id);

-- ==================== AUDIT LOGS POLICIES ====================

-- Users can view their own audit logs
CREATE POLICY "Users can view own audit logs"
  ON audit_logs FOR SELECT
  USING (auth.uid() = user_id);

-- System can create audit logs
CREATE POLICY "System can create audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (true);

-- ==================== SEED DATA ====================

-- Insert demo association
INSERT INTO associations (
  name,
  description,
  contact_email,
  contact_phone,
  city,
  state,
  country
) VALUES (
  'SMB Connect Demo Association',
  'A demo association for connecting small and medium businesses',
  'admin@smbconnect.com',
  '+91-9876543210',
  'Mumbai',
  'Maharashtra',
  'India'
);