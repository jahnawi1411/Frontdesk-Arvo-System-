// Frontdesk Secure Response Serializer
// Solves Incident INC-0304: Guarantees that private internal notes can NEVER leak to customers
// Enforces defense-in-depth: Even if an internal note were fetched in memory, the customer serializer strips it.

/**
 * Serializes a ticket for customer consumption.
 * Strictly excludes:
 * - Internal notes
 * - Staff-only audit logs or notes
 */
export function serializeTicketForCustomer(ticket) {
  if (!ticket) return null;

  const serialized = {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    subject: ticket.subject,
    description: ticket.description,
    priority: ticket.priority,
    status: ticket.status,
    firstResponseDeadline: ticket.firstResponseDeadline,
    resolutionDeadline: ticket.resolutionDeadline,
    firstResponseAt: ticket.firstResponseAt,
    resolvedAt: ticket.resolvedAt,
    closedAt: ticket.closedAt,
    reopenedAt: ticket.reopenedAt,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    customer: ticket.customer ? {
      id: ticket.customer.id,
      name: ticket.customer.name,
      email: ticket.customer.email,
    } : undefined,
    assignedTo: ticket.assignedTo ? {
      id: ticket.assignedTo.id,
      name: ticket.assignedTo.name,
    } : null,
  };

  // If messages are attached, strictly filter out INTERNAL_NOTE
  if (Array.isArray(ticket.messages)) {
    serialized.messages = ticket.messages
      .filter(m => m.type === 'PUBLIC_REPLY')
      .map(m => ({
        id: m.id,
        senderId: m.senderId,
        senderName: m.sender?.name || 'Support Agent',
        senderRole: m.sender?.role || 'AGENT',
        type: 'PUBLIC_REPLY',
        content: m.content,
        createdAt: m.createdAt,
      }));
  }

  return serialized;
}

/**
 * Serializes messages specifically for customer API endpoints.
 * Explicitly rejects and filters out any message that is not 'PUBLIC_REPLY'.
 */
export function serializeMessagesForCustomer(messages = []) {
  return messages
    .filter(m => m.type === 'PUBLIC_REPLY')
    .map(m => ({
      id: m.id,
      ticketId: m.ticketId,
      senderId: m.senderId,
      senderName: m.sender?.name || 'Support Agent',
      senderRole: m.sender?.role || 'AGENT',
      type: 'PUBLIC_REPLY',
      content: m.content,
      createdAt: m.createdAt,
    }));
}
