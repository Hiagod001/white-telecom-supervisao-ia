import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Blip sync imports agents only while process setup is pending", async () => {
  const [syncRoute, webhookRoute, blip] = await Promise.all([
    readFile(new URL("../app/api/admin/integrations/blip/sync/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/integrations/blip/webhook/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/blip.ts", import.meta.url), "utf8"),
  ]);

  assert.match(syncRoute, /listSupervisionAttendants/);
  assert.doesNotMatch(syncRoute, /listBlipTickets|getBlipThread|upsertBlipTicket|upsertBlipMessage/);
  assert.match(syncRoute, /tickets:\s*0/);
  assert.match(syncRoute, /messages:\s*0/);
  assert.match(webhookRoute, /isBlipTicketImportEnabled/);
  assert.match(blip, /\["Suporte", "Comercial"\]/);
  assert.match(blip, /filterBlipTicketMessages/);
  assert.match(blip, /#message\.ticketId/);
});
