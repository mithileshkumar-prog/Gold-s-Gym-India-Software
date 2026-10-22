import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp, today, shiftDays } from "../server/index.js";

async function workspace(t, options = {}) {
  const instance = createApp({ dbPath: ":memory:", ...options });
  const server = instance.app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    instance.db.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    ...instance,
    request: async (path, method = "GET", body) => {
      const res = await fetch(base + path, {
        method,
        headers: { "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: res.status, data: await res.json() };
    },
  };
}

test("demo has 48 real members, consistent dashboard counts and useful filters", async (t) => {
  const { request } = await workspace(t);
  const { data: overview, status } = await request("/api/overview");
  assert.equal(status, 200);
  assert.equal(overview.stats.totalMembers, 48);
  assert.equal(
    overview.stats.activeMembers + overview.stats.expiredMembers,
    48,
  );
  assert.equal(overview.stats.expiringMembers, 7);
  assert.equal(overview.trend.length, 6);
  assert.ok(overview.trend.every((row) => Number.isFinite(row.revenue)));
  const {
    data: { members },
  } = await request("/api/members?search=priya&status=expiring");
  assert.equal(members.length, 1);
  assert.equal(members[0].name, "Priya Mehta");
  assert.equal(members[0].daysLeft, 3);
});

test("member enrolment persists details and payment; invalid inputs and duplicates are rejected", async (t) => {
  const { request } = await workspace(t);
  const input = {
    name: "Demo Member",
    email: "demo.member@example.com",
    phone: "+91 98765 43210",
    planId: 2,
    startDate: today(),
  };
  const before = (await request("/api/overview")).data.stats;
  const { data: member, status } = await request("/api/members", "POST", input);
  assert.equal(status, 201);
  assert.equal(member.name, input.name);
  assert.equal(member.planName, "Quarterly");
  assert.ok(member.daysLeft >= 89);
  const after = (await request("/api/overview")).data.stats;
  assert.equal(after.totalMembers, before.totalMembers + 1);
  assert.equal(after.monthlyRevenue, before.monthlyRevenue + 7500);
  assert.equal((await request("/api/members", "POST", input)).status, 409);
  assert.equal(
    (await request("/api/members", "POST", { ...input, email: "bad" })).status,
    400,
  );
  assert.equal(
    (
      await request("/api/members", "POST", {
        ...input,
        email: "another@example.com",
        phone: "1",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/api/members", "POST", {
        ...input,
        email: "another@example.com",
        startDate: "2026-02-31",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/api/members", "POST", {
        ...input,
        email: "future@example.com",
        startDate: shiftDays(today(), 30),
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(`/api/members/${member.id}`, "PATCH", {
        phone: "+91 98765 43211",
      })
    ).data.phone,
    "+91 98765 43211",
  );
});

test("renewals preserve remaining membership time, record revenue, and remove stale queued reminders", async (t) => {
  const { request } = await workspace(t);
  const member = (await request("/api/members?search=priya")).data.members[0];
  const revenue = (await request("/api/overview")).data.stats.monthlyRevenue;
  assert.ok(
    (await request("/api/renewals")).data.reminders.some(
      (r) => r.memberId === member.id,
    ),
  );
  const renewed = (
    await request(`/api/members/${member.id}/renew`, "POST", { planId: 1 })
  ).data;
  assert.equal(renewed.startDate, member.expiryDate);
  assert.ok(renewed.daysLeft >= 31);
  assert.equal(
    (await request("/api/overview")).data.stats.monthlyRevenue,
    revenue + 3000,
  );
  assert.ok(
    !(await request("/api/renewals")).data.reminders.some(
      (r) => r.memberId === member.id,
    ),
  );
  const expired = (await request("/api/members?status=expired")).data
    .members[0];
  const reactivated = (
    await request(`/api/members/${expired.id}/renew`, "POST", { planId: 3 })
  ).data;
  assert.equal(reactivated.startDate, today());
  assert.equal(reactivated.status, "active");
});

test("calendar month renewal clamps month-end dates correctly", async (t) => {
  const { request } = await workspace(t);
  // Use a future January to exercise a 31-day boundary without clock assumptions.
  const expiryDate = `${Number(today().slice(0, 4)) + 1}-01-31`;
  const result = await request("/api/members", "POST", {
    name: "Calendar Check",
    email: "calendar@example.com",
    phone: "9876543210",
    planId: 1,
    startDate: today(),
    expiryDate,
  });
  assert.equal(result.status, 201);
  const renewed = await request(
    `/api/members/${result.data.id}/renew`,
    "POST",
    { planId: 1 },
  );
  assert.match(renewed.data.expiryDate, /-02-(28|29)$/);
});

test("reminder scans deduplicate, respect pause and simulate without claiming delivery", async (t) => {
  const { request } = await workspace(t);
  const initial = (await request("/api/renewals")).data;
  assert.equal(initial.summary.queued, 3);
  assert.equal(
    (await request("/api/renewals/scan", "POST", {})).data.created,
    0,
  );
  await request("/api/settings", "PATCH", {
    automationEnabled: false,
    channel: "email",
  });
  assert.equal(
    (await request("/api/renewals/scan", "POST", {})).data.skipped,
    true,
  );
  const dispatched = (await request("/api/renewals/dispatch", "POST", {})).data;
  assert.equal(dispatched.simulated, 3);
  assert.equal(
    (await request("/api/renewals/dispatch", "POST", {})).data.simulated,
    0,
  );
  const outbox = (await request("/api/renewals")).data;
  assert.ok(
    outbox.reminders.every((r) => r.status === "simulated" && r.sentAt),
  );
  assert.equal(outbox.summary.queued, 0);
  await request("/api/settings", "PATCH", { automationEnabled: true });
  const result = await request("/api/members", "POST", {
    name: "New Expiring",
    email: "expiring@example.com",
    phone: "9876543210",
    planId: 1,
    startDate: shiftDays(today(), -24),
    expiryDate: shiftDays(today(), 7),
  });
  assert.equal(result.status, 201);
  const newReminder = (await request("/api/renewals")).data.reminders.find(
    (r) => r.memberId === result.data.id,
  );
  assert.equal(newReminder.channel, "email");
  assert.equal(newReminder.status, "queued");
});

test("queries receive a stable IT reference and can move through triage to resolution", async (t) => {
  const { request } = await workspace(t);
  const input = {
    memberName: "Demo Member",
    email: "member@example.com",
    category: "Technical",
    priority: "high",
    subject: "Membership QR is blank",
    description: "My member QR card is not loading. Please investigate.",
  };
  const { data: ticket, status } = await request("/api/tickets", "POST", input);
  assert.equal(status, 201);
  assert.match(ticket.reference, /^GGIT-\d{4}$/);
  assert.equal(ticket.assignedTo, "Gold’s Gym IT");
  assert.equal(ticket.status, "open");
  assert.equal(
    (
      await request(`/api/tickets/${ticket.id}`, "PATCH", {
        status: "in_progress",
      })
    ).data.status,
    "in_progress",
  );
  assert.equal(
    (
      await request(`/api/tickets/${ticket.id}`, "PATCH", {
        status: "resolved",
      })
    ).data.status,
    "resolved",
  );
  assert.equal(
    (await request("/api/tickets", "POST", { ...input, description: "" }))
      .status,
    400,
  );
  assert.equal(
    (await request(`/api/tickets/${ticket.id}`, "PATCH", { status: "deleted" }))
      .status,
    400,
  );
});

test("FAQ answers known questions and escalates unknown queries without pretending to be live AI", async (t) => {
  const { request } = await workspace(t);
  assert.match(
    (await request("/api/chat", "POST", { message: "What are the prices?" }))
      .data.reply,
    /₹3,000/,
  );
  assert.match(
    (await request("/api/chat", "POST", { message: "How do renewals work?" }))
      .data.reply,
    /simulated/,
  );
  assert.equal(
    (await request("/api/chat", "POST", { message: "freeze my membership" }))
      .data.suggestTicket,
    true,
  );
  assert.equal(
    (
      await request("/api/chat", "POST", {
        message: "membership payment failed",
      })
    ).data.suggestTicket,
    true,
  );
  const unknown = (
    await request("/api/chat", "POST", {
      message: "Please explain quantum physics",
    })
  ).data;
  assert.equal(unknown.suggestTicket, true);
  assert.match(unknown.reply, /IT support queue/);
  assert.equal(
    (await request("/api/chat", "POST", { message: "" })).status,
    400,
  );
  assert.equal((await request("/api/members/9999")).status, 404);
});

test("SQLite survives restart and demo seeding is idempotent", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "golds-gym-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const dbPath = join(dir, "gym.sqlite");
  const first = createApp({ dbPath });
  first.db.prepare("UPDATE settings SET automationEnabled=0 WHERE id=1").run();
  first.db.prepare("UPDATE members SET name='Persisted name' WHERE id=1").run();
  first.db.close();
  const second = createApp({ dbPath });
  assert.equal(
    second.db.prepare("SELECT COUNT(*) AS n FROM members").get().n,
    48,
  );
  assert.equal(
    second.db.prepare("SELECT name FROM members WHERE id=1").get().name,
    "Persisted name",
  );
  assert.equal(
    second.db.prepare("SELECT automationEnabled FROM settings WHERE id=1").get()
      .automationEnabled,
    0,
  );
  second.db.close();
});
