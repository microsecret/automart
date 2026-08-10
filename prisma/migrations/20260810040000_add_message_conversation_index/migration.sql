-- Conversation list selects the latest message and unread count per dialogue.
-- Keep the inbox responsive without changing message data or visibility rules.
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");
