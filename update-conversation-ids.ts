import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function updateConversationIds() {
  console.log("Starting to update conversation IDs...")

  // Get all messages that don't have a conversationId set (or have an empty one)
  const messagesWithoutConversationId = await prisma.message.findMany({
    where: {
      OR: [
        { conversationId: null },
        { conversationId: "" }
      ]
    }
  })

  console.log(`Found ${messagesWithoutConversationId.length} messages without conversation ID`)

  // Update each message with the correct conversationId
  for (const message of messagesWithoutConversationId) {
    // Generate conversation ID
    // Format: "{userId1}-{userId2}-{listingId}" or "{userId1}-{userId2}-no-listing"
    // where userId1 < userId2 alphabetically
    const userIds = [message.senderId, message.receiverId].sort()
    const conversationId = `${userIds[0]}-${userIds[1]}-${message.listingId || 'no-listing'}`

    // Update the message
    await prisma.message.update({
      where: { id: message.id },
      data: {
        conversationId: conversationId
      }
    })

    console.log(`Updated message ${message.id} with conversation ID: ${conversationId}`)
  }

  console.log("Finished updating conversation IDs")
}

updateConversationIds()
  .catch((e) => {
    console.error("Error updating conversation IDs:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })