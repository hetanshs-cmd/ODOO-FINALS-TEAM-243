/**
 * DealFlow360 Audit & Event Logging Infrastructure
 * Central mechanism for recording immutable governance events and dispatching audit notices.
 */

import { TimelineEvent } from '../types';
import { dealStore } from '../store/dealStore';

class EventBusService {
  /**
   * Record a governance or operational event to the authoritative store
   */
  public recordEvent(eventInput: {
    quotationId: string;
    type?: string;
    eventType?: string;
    description?: string;
    note?: string;
    user?: string;
    actorName?: string;
    metadata?: Record<string, unknown>;
  }): TimelineEvent {
    const actor = dealStore.getState().currentUser;
    const newEvent: TimelineEvent = {
      id: `EVT-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      quotationId: eventInput.quotationId,
      actorId: actor.id,
      actorName: eventInput.user || eventInput.actorName || actor.name,
      actorRole: actor.role,
      eventType: eventInput.type || eventInput.eventType || 'SYSTEM_EVENT',
      timestamp: new Date().toISOString(),
      note: eventInput.description || eventInput.note || 'Event recorded',
      metadata: eventInput.metadata,
    };

    dealStore.setState((prev) => ({
      timelineEvents: [newEvent, ...prev.timelineEvents],
    }));

    return newEvent;
  }

  /**
   * Retrieve all audit events for a specific quotation or entity ID
   */
  public getEvents(quotationId?: string): TimelineEvent[] {
    const allEvents = dealStore.getState().timelineEvents;
    if (!quotationId) {
      return allEvents;
    }
    return allEvents.filter((evt) => evt.quotationId === quotationId);
  }
}

export const eventBus = new EventBusService();
