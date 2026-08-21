import assert from "node:assert/strict";
import test from "node:test";
import { filterBlipTicketMessages } from "../lib/blip-ticket-filter.ts";

test("separates one Blip attendance by ticket window and human ticket metadata", () => {
  const ticketId = "bef8e33a-6e33-4e15-b385-019fcdcba5b0";
  const ticket = {
    id: ticketId,
    openDate: "2026-08-04T17:21:43.940Z",
    closeDate: "2026-08-04T18:30:53.660Z",
  };
  const items = [
    { id: "after", direction: "received", type: "text/plain", date: "2026-08-04T18:31:00.000Z" },
    { id: "other-ticket", direction: "sent", type: "text/plain", date: "2026-08-04T17:31:00.000Z", metadata: { "#messageEmitter": "Human", "#message.ticketId": "another-ticket" } },
    { id: "client", direction: "received", type: "text/plain", date: "2026-08-04T17:25:00.000Z" },
    { id: "desk-event", direction: "received", type: "application/vnd.iris.ticket+json", date: "2026-08-04T17:26:00.000Z" },
    { id: "human", direction: "sent", type: "text/plain", date: "2026-08-04T17:29:40.282Z", metadata: { "#messageEmitter": "Human", "#message.ticketId": ticketId } },
    { id: "bot", direction: "sent", type: "text/plain", date: "2026-08-04T17:28:00.000Z", metadata: { "#messageEmitter": "Bot", "#message.ticketId": ticketId } },
    { id: "before", direction: "received", type: "text/plain", date: "2026-08-04T17:20:00.000Z" },
  ];

  const result = filterBlipTicketMessages(ticket, items, ticketId);

  assert.equal(result.total, 2);
  assert.deepEqual(result.items.map((item) => item.id), ["client", "human"]);
  assert.equal(result.startDate, ticket.openDate);
  assert.equal(result.endDate, ticket.closeDate);
});

test("fails closed when the ticket window is invalid", () => {
  assert.throws(
    () => filterBlipTicketMessages({ id: "ticket" }, [], "ticket"),
    /janela de atendimento invalida/,
  );
});
