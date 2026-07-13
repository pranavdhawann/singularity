import type { SourceReference, TimelineEventDto } from "@future/core";
import { AssistantResponse } from "../assistant/AssistantResponse";

interface TimelineViewProps {
  events?: TimelineEventDto[];
  streamedText?: string;
  onContextSelected?: ((contextPackId: string) => void) | undefined;
}

export function TimelineView({ events = [], streamedText = "", onContextSelected }: TimelineViewProps) {
  return (
    <section className="timeline-panel assistant-workspace" aria-labelledby="timeline-heading">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Activity</p>
          <h2 id="timeline-heading">Timeline</h2>
        </div>
        <span className="status-pill">Live from SQLite</span>
      </div>
      <div className="timeline-list timeline-scroll">
        {events.length === 0 && !streamedText ? <p className="empty-state">No activity recorded yet.</p> : null}
        {events.map((event) => (
          <TimelineEvent event={event} key={event.id} onContextSelected={onContextSelected} />
        ))}
        {streamedText ? (
          <article className="timeline-event streaming-response" aria-label="Streaming assistant response">
            <span className="event-type">assistant.streaming</span>
            <h3>Future is responding</h3>
            <p>{streamedText}</p>
          </article>
        ) : null}
      </div>
    </section>
  );
}

function TimelineEvent({
  event,
  onContextSelected,
}: {
  event: TimelineEventDto;
  onContextSelected?: ((contextPackId: string) => void) | undefined;
}) {
  if (event.type === "assistant.response.created") {
    const responseText = typeof event.payload.responseText === "string" ? event.payload.responseText : "";
    const contextPackId = typeof event.payload.contextPackId === "string" ? event.payload.contextPackId : undefined;
    return (
      <article className="timeline-event assistant-event">
        <span className="event-type">Assistant</span>
        <h3>{event.title}</h3>
        <AssistantResponse
          responseText={responseText}
          sources={event.citations ?? []}
          onSourceClick={(_source: SourceReference) => {
            if (contextPackId) onContextSelected?.(contextPackId);
          }}
        />
      </article>
    );
  }

  const userText =
    event.type === "user.message.created" && typeof event.payload.text === "string" ? event.payload.text : undefined;
  return (
    <article className={`timeline-event ${userText ? "user-event" : "system-event"}`}>
      <span className="event-type">{userText ? "You" : event.type}</span>
      <h3>{event.title}</h3>
      {userText ? <p>{userText}</p> : null}
    </article>
  );
}
