import express from "express";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DAY = 86400000;
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const shiftDays = (date, days) =>
  new Date(Date.parse(date + "T00:00:00Z") + days * DAY)
    .toISOString()
    .slice(0, 10);
function addMonths(date, months) {
  const d = new Date(date + "T00:00:00Z");
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}
function bad(message) {
  const error = new Error(message);
  error.status = 400;
  throw error;
}
function required(value, name, max = 100) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    bad(`${name} is required (maximum ${max} characters).`);
  return value.trim();
}
function email(value) {
  const result = required(value, "Email", 180).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result))
    bad("Enter a valid email address.");
  return result;
}
function validDate(value, label) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value + "T00:00:00Z")) ||
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) !== value
  )
    bad(`${label} must be a valid date.`);
  if (value < "1900-01-01" || value > "2200-12-31")
    bad(`${label} is out of range.`);
  return value;
}
function choice(value, allowed, label) {
  if (!allowed.includes(value)) bad(`Choose a valid ${label}.`);
  return value;
}

export function createApp({
  dbPath = process.env.GYM_DB_PATH || resolve(ROOT, ".data/gym.sqlite"),
  seed = true,
} = {}) {
  if (dbPath !== ":memory:")
    mkdirSync(dirname(resolve(dbPath)), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS plans (id INTEGER PRIMARY KEY, name TEXT NOT NULL, months INTEGER NOT NULL, price INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS members (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE, phone TEXT NOT NULL, planId INTEGER NOT NULL REFERENCES plans(id), startDate TEXT NOT NULL, expiryDate TEXT NOT NULL, joinedAt TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS payments (id INTEGER PRIMARY KEY, memberId INTEGER NOT NULL REFERENCES members(id), amount INTEGER NOT NULL, paidAt TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS reminders (id INTEGER PRIMARY KEY AUTOINCREMENT, memberId INTEGER NOT NULL REFERENCES members(id), expiryDate TEXT NOT NULL, daysLeft INTEGER NOT NULL, channel TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued', message TEXT NOT NULL, createdAt TEXT NOT NULL, sentAt TEXT, UNIQUE(memberId, expiryDate, daysLeft));
    CREATE TABLE IF NOT EXISTS tickets (id INTEGER PRIMARY KEY AUTOINCREMENT, memberName TEXT NOT NULL, email TEXT NOT NULL, category TEXT NOT NULL, priority TEXT NOT NULL, subject TEXT NOT NULL, description TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', assignedTo TEXT NOT NULL DEFAULT 'Gold’s Gym IT', createdAt TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id=1), automationEnabled INTEGER NOT NULL DEFAULT 1, channel TEXT NOT NULL DEFAULT 'whatsapp');
    CREATE TABLE IF NOT EXISTS activity (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, message TEXT NOT NULL, createdAt TEXT NOT NULL);
    INSERT OR IGNORE INTO plans VALUES (1, 'Monthly', 1, 3000), (2, 'Quarterly', 3, 7500), (3, 'Annual', 12, 24000);
    INSERT OR IGNORE INTO settings (id) VALUES (1);`);
  const all = (query, ...args) => db.prepare(query).all(...args);
  const one = (query, ...args) => db.prepare(query).get(...args);
  const run = (query, ...args) => db.prepare(query).run(...args);
  const transaction = (fn) => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      db.exec("COMMIT");
      return result;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  };
  const activity = (type, message) =>
    run(
      "INSERT INTO activity(type,message,createdAt) VALUES(?,?,?)",
      type,
      message,
      new Date().toISOString(),
    );
  const plans = () => all("SELECT * FROM plans ORDER BY months");
  const settings = () => {
    const s = one("SELECT * FROM settings WHERE id=1");
    return {
      automationEnabled: Boolean(s.automationEnabled),
      channel: s.channel,
      days: [7, 3, 0],
    };
  };
  function serializeMember(m) {
    const daysLeft = Math.round(
      (Date.parse(m.expiryDate + "T00:00:00Z") -
        Date.parse(today() + "T00:00:00Z")) /
        DAY,
    );
    return {
      ...m,
      memberCode: `GG${String(m.id).padStart(4, "0")}`,
      daysLeft,
      status: daysLeft < 0 ? "expired" : daysLeft <= 7 ? "expiring" : "active",
    };
  }
  function members() {
    return all(
      "SELECT m.*,p.name AS planName,p.price AS planPrice FROM members m JOIN plans p ON p.id=m.planId ORDER BY m.id DESC",
    ).map(serializeMember);
  }
  function findMember(id) {
    const m = one(
      "SELECT m.*,p.name AS planName,p.price AS planPrice FROM members m JOIN plans p ON p.id=m.planId WHERE m.id=?",
      Number(id),
    );
    if (!m) {
      const error = new Error("Member not found.");
      error.status = 404;
      throw error;
    }
    return serializeMember(m);
  }
  function plan(id) {
    const p = one("SELECT * FROM plans WHERE id=?", Number(id));
    if (!p) bad("Choose a valid membership plan.");
    return p;
  }
  function scan() {
    if (!settings().automationEnabled) return { created: 0, skipped: true };
    let created = 0;
    transaction(() => {
      const channel = settings().channel;
      for (const m of members().filter((m) => [7, 3, 0].includes(m.daysLeft))) {
        const message = `Hi ${m.name.split(" ")[0]}, your Gold's Gym Indiranagar ${m.planName.toLowerCase()} membership ${m.daysLeft === 0 ? "expires today" : `expires in ${m.daysLeft} days`} (${m.expiryDate}). Please contact the club front desk to renew and keep your momentum going. — Gold's Gym India`;
        created += Number(
          run(
            "INSERT OR IGNORE INTO reminders(memberId,expiryDate,daysLeft,channel,message,createdAt) VALUES(?,?,?,?,?,?)",
            m.id,
            m.expiryDate,
            m.daysLeft,
            channel,
            message,
            new Date().toISOString(),
          ).changes,
        );
      }
      if (created)
        activity(
          "reminder",
          `${created} renewal reminder${created === 1 ? "" : "s"} added to the demo outbox`,
        );
    });
    return { created, skipped: false };
  }
  if (seed && !one("SELECT COUNT(*) AS n FROM members").n) {
    transaction(() => {
      const names = [
        "Aarav Sharma",
        "Priya Mehta",
        "Rohan Kapoor",
        "Ananya Iyer",
        "Vikram Singh",
        "Sneha Patel",
        "Arjun Nair",
        "Ishita Rao",
        "Rahul Verma",
        "Kavya Menon",
        "Aditya Joshi",
        "Neha Gupta",
        "Karan Malhotra",
        "Pooja Desai",
        "Siddharth Reddy",
        "Riya Shah",
        "Dev Agarwal",
        "Meera Krishnan",
        "Yash Bhatia",
        "Tanya Sethi",
        "Akash Jain",
        "Nisha Kulkarni",
        "Varun Chawla",
        "Diya Bose",
        "Manav Arora",
        "Sanya Mishra",
        "Abhinav Das",
        "Shruti Pillai",
        "Dhruv Sinha",
        "Aditi Saxena",
        "Sameer Khan",
        "Simran Kaur",
        "Harsh Vardhan",
        "Nandini Roy",
        "Pranav Shetty",
        "Sakshi Tiwari",
        "Kabir Sood",
        "Shreya Pandey",
        "Rishabh Goyal",
        "Anjali Bansal",
        "Nikhil Mathur",
        "Ritika Chopra",
        "Sahil Mehra",
        "Ira Mukherjee",
        "Abhay Jha",
        "Tanvi Naik",
        "Vivaan Sen",
        "Avni Sharma",
      ];
      const offsets = [7, 3, 0, 5, 2, 6, 1, -2, -5, -8, -12, -20];
      names.forEach((name, i) => {
        const p = plans()[i % 3];
        const horizon = p.months === 1 ? 17 : p.months === 3 ? 65 : 268;
        const expiryDate = shiftDays(
          today(),
          i < offsets.length ? offsets[i] : 12 + ((i * 7) % horizon),
        );
        const startDate = addMonths(expiryDate, -p.months);
        const joinedAt = shiftDays(today(), -(i * 9 + 30));
        const result = run(
          "INSERT INTO members(name,email,phone,planId,startDate,expiryDate,joinedAt) VALUES(?,?,?,?,?,?,?)",
          name,
          `${name.toLowerCase().replaceAll(" ", ".")}@example.com`,
          `+91 90000 ${String(10000 + i).padStart(5, "0")}`,
          p.id,
          startDate,
          expiryDate,
          joinedAt,
        );
        // Demo transactions span six months and use the same plan prices as the UI.
        const paymentDate = shiftDays(today(), -(i * 4));
        run(
          "INSERT INTO payments(memberId,amount,paidAt) VALUES(?,?,?)",
          Number(result.lastInsertRowid),
          p.price,
          paymentDate,
        );
      });
      run(
        "INSERT INTO tickets(memberName,email,category,priority,subject,description,status,createdAt) VALUES(?,?,?,?,?,?,?,?)",
        "Priya Mehta",
        "priya.mehta@example.com",
        "App & login",
        "medium",
        "Unable to view my membership card",
        "My digital membership card is not loading in the app. Please help me restore access.",
        "open",
        new Date(Date.now() - 3600000).toISOString(),
      );
      run(
        "INSERT INTO tickets(memberName,email,category,priority,subject,description,status,createdAt) VALUES(?,?,?,?,?,?,?,?)",
        "Rahul Verma",
        "rahul.verma@example.com",
        "Billing",
        "high",
        "Payment receipt not available",
        "My renewal payment was received at the front desk but I cannot find the receipt.",
        "in_progress",
        new Date(Date.now() - 86400000).toISOString(),
      );
      run(
        "INSERT INTO tickets(memberName,email,category,priority,subject,description,status,createdAt) VALUES(?,?,?,?,?,?,?,?)",
        "Ananya Iyer",
        "ananya.iyer@example.com",
        "App & login",
        "low",
        "Update registered email",
        "Please update my registered email address after verifying my identity.",
        "resolved",
        new Date(Date.now() - 172800000).toISOString(),
      );
      activity("member", "Club workspace created with 48 demo members");
      activity("support", "New query GGIT-0001 assigned to Gold’s Gym IT");
    });
  }
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "50kb" }));
  app.use("/api", (req, res, next) => {
    if (
      ["POST", "PATCH"].includes(req.method) &&
      (!req.body || Array.isArray(req.body) || typeof req.body !== "object")
    )
      return res.status(400).json({ error: "A JSON object is required." });
    next();
  });
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.get("/api/health", (req, res) =>
    res.json({ status: "ok", mode: "demo", database: "sqlite" }),
  );
  app.get("/api/overview", (req, res) => {
    const list = members();
    const currentMonth = today().slice(0, 7);
    const trend = Array.from({ length: 6 }, (_, i) => {
      const monthDate = addMonths(today().slice(0, 8) + "01", i - 5);
      const key = monthDate.slice(0, 7);
      return {
        month: new Date(monthDate + "T00:00:00Z").toLocaleString("en-IN", {
          month: "short",
          timeZone: "UTC",
        }),
        members: list.filter((m) => m.joinedAt.slice(0, 7) <= key).length,
        revenue: one(
          "SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE substr(paidAt,1,7)=?",
          key,
        ).total,
      };
    });
    res.json({
      stats: {
        totalMembers: list.length,
        activeMembers: list.filter((m) => m.daysLeft >= 0).length,
        expiringMembers: list.filter((m) => m.status === "expiring").length,
        expiredMembers: list.filter((m) => m.status === "expired").length,
        monthlyRevenue: one(
          "SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE substr(paidAt,1,7)=?",
          currentMonth,
        ).total,
        openTickets: one(
          "SELECT COUNT(*) AS n FROM tickets WHERE status!='resolved'",
        ).n,
      },
      trend,
      expiringMembers: list
        .filter((m) => m.status === "expiring")
        .sort((a, b) => a.daysLeft - b.daysLeft),
      recentActivity: all("SELECT * FROM activity ORDER BY id DESC LIMIT 8"),
      plans: plans(),
      club: { name: "Gold’s Gym Indiranagar", location: "Bengaluru, India" },
    });
  });
  app.get("/api/members", (req, res) => {
    const search = String(req.query.search || "").toLowerCase();
    const status = String(req.query.status || "all");
    res.json({
      members: members().filter(
        (m) =>
          (status === "all" || m.status === status) &&
          [m.name, m.email, m.phone, m.memberCode].some((v) =>
            v.toLowerCase().includes(search),
          ),
      ),
      plans: plans(),
    });
  });
  app.get("/api/members/:id", (req, res) =>
    res.json(findMember(req.params.id)),
  );
  function memberInput(input, previous) {
    const name = required(input.name ?? previous?.name, "Name", 80);
    const mail = email(input.email ?? previous?.email);
    const phone = required(input.phone ?? previous?.phone, "Phone", 25);
    if (
      !/^\+?[\d\s()-]{10,25}$/.test(phone) ||
      phone.replace(/\D/g, "").length < 10 ||
      phone.replace(/\D/g, "").length > 15
    )
      bad("Enter a valid phone number with 10 to 15 digits.");
    const p = plan(input.planId ?? previous?.planId);
    const startDate = validDate(
      input.startDate ?? previous?.startDate ?? today(),
      "Start date",
    );
    if (startDate > today() && startDate !== previous?.startDate)
      bad(
        "New memberships must start today or earlier. Future enrolments are not supported in this demo.",
      );
    const expiryDate = validDate(
      input.expiryDate ??
        previous?.expiryDate ??
        addMonths(startDate, p.months),
      "Expiry date",
    );
    if (expiryDate < startDate)
      bad("Expiry date must be on or after the start date.");
    const duplicate = one("SELECT id FROM members WHERE email=?", mail);
    if (duplicate && duplicate.id !== previous?.id) {
      const error = new Error("A member with this email already exists.");
      error.status = 409;
      throw error;
    }
    return {
      name,
      email: mail,
      phone,
      planId: p.id,
      startDate,
      expiryDate,
      price: p.price,
    };
  }
  app.post("/api/members", (req, res) => {
    const v = memberInput(req.body);
    const id = transaction(() => {
      const result = run(
        "INSERT INTO members(name,email,phone,planId,startDate,expiryDate,joinedAt) VALUES(?,?,?,?,?,?,?)",
        v.name,
        v.email,
        v.phone,
        v.planId,
        v.startDate,
        v.expiryDate,
        today(),
      );
      const id = Number(result.lastInsertRowid);
      run(
        "INSERT INTO payments(memberId,amount,paidAt) VALUES(?,?,?)",
        id,
        v.price,
        today(),
      );
      activity(
        "member",
        `${v.name} joined on the ${plan(v.planId).name.toLowerCase()} plan`,
      );
      return id;
    });
    scan();
    res.status(201).json(findMember(id));
  });
  app.patch("/api/members/:id", (req, res) => {
    const previous = findMember(req.params.id);
    const v = memberInput(req.body, previous);
    transaction(() => {
      run(
        "UPDATE members SET name=?,email=?,phone=?,planId=?,startDate=?,expiryDate=? WHERE id=?",
        v.name,
        v.email,
        v.phone,
        v.planId,
        v.startDate,
        v.expiryDate,
        previous.id,
      );
      if (v.expiryDate !== previous.expiryDate)
        run(
          "DELETE FROM reminders WHERE memberId=? AND status='queued'",
          previous.id,
        );
      activity("member", `${v.name}’s member details updated`);
    });
    scan();
    res.json(findMember(previous.id));
  });
  app.post("/api/members/:id/renew", (req, res) => {
    const m = findMember(req.params.id);
    const p = plan(req.body.planId ?? m.planId);
    const base = m.expiryDate > today() ? m.expiryDate : today();
    transaction(() => {
      run(
        "UPDATE members SET planId=?,startDate=?,expiryDate=? WHERE id=?",
        p.id,
        base,
        addMonths(base, p.months),
        m.id,
      );
      run(
        "INSERT INTO payments(memberId,amount,paidAt) VALUES(?,?,?)",
        m.id,
        p.price,
        today(),
      );
      run("DELETE FROM reminders WHERE memberId=? AND status='queued'", m.id);
      activity(
        "renewal",
        `${m.name} renewed for ${p.months} month${p.months === 1 ? "" : "s"}`,
      );
    });
    res.json(findMember(m.id));
  });
  app.get("/api/renewals", (req, res) => {
    const reminders = all(
      "SELECT r.*,m.name AS memberName,m.phone,m.email FROM reminders r JOIN members m ON m.id=r.memberId ORDER BY r.id DESC",
    );
    res.json({
      reminders,
      settings: settings(),
      summary: {
        queued: reminders.filter((r) => r.status === "queued").length,
        simulated: reminders.filter((r) => r.status === "simulated").length,
        dueSoon: members().filter((m) => m.status === "expiring").length,
      },
    });
  });
  app.patch("/api/settings", (req, res) => {
    const current = settings();
    const enabled = req.body.automationEnabled ?? current.automationEnabled;
    if (typeof enabled !== "boolean")
      bad("Automation enabled must be true or false.");
    const channel = choice(
      req.body.channel ?? current.channel,
      ["whatsapp", "email"],
      "channel",
    );
    run(
      "UPDATE settings SET automationEnabled=?,channel=? WHERE id=1",
      Number(enabled),
      channel,
    );
    res.json(settings());
  });
  app.post("/api/renewals/scan", (req, res) => res.json(scan()));
  app.post("/api/renewals/dispatch", (req, res) => {
    const simulated = transaction(() => {
      // Never contacts an external messaging provider. Every result is labelled simulated.
      const n = Number(
        run(
          "UPDATE reminders SET status='simulated',sentAt=? WHERE status='queued'",
          new Date().toISOString(),
        ).changes,
      );
      if (n)
        activity(
          "reminder",
          `${n} reminder${n === 1 ? "" : "s"} simulated · no messages sent`,
        );
      return n;
    });
    res.json({ simulated });
  });
  const ticketView = (t) => ({
    ...t,
    reference: `GGIT-${String(t.id).padStart(4, "0")}`,
  });
  app.get("/api/tickets", (req, res) => {
    const tickets = all("SELECT * FROM tickets ORDER BY id DESC").map(
      ticketView,
    );
    res.json({
      tickets,
      summary: {
        open: tickets.filter((t) => t.status === "open").length,
        inProgress: tickets.filter((t) => t.status === "in_progress").length,
        resolved: tickets.filter((t) => t.status === "resolved").length,
      },
    });
  });
  app.post("/api/tickets", (req, res) => {
    const v = req.body;
    const values = [
      required(v.memberName, "Member name", 80),
      email(v.email),
      choice(
        v.category,
        ["App & login", "Membership", "Billing", "Technical", "Other"],
        "category",
      ),
      choice(v.priority ?? "medium", ["low", "medium", "high"], "priority"),
      required(v.subject, "Subject", 140),
      required(v.description, "Description", 2000),
      new Date().toISOString(),
    ];
    const id = transaction(() => {
      const result = run(
        "INSERT INTO tickets(memberName,email,category,priority,subject,description,createdAt) VALUES(?,?,?,?,?,?,?)",
        ...values,
      );
      activity(
        "support",
        `Query GGIT-${String(result.lastInsertRowid).padStart(4, "0")} assigned to Gold’s Gym IT`,
      );
      return Number(result.lastInsertRowid);
    });
    res
      .status(201)
      .json(ticketView(one("SELECT * FROM tickets WHERE id=?", id)));
  });
  app.patch("/api/tickets/:id", (req, res) => {
    const status = choice(
      req.body.status,
      ["open", "in_progress", "resolved"],
      "ticket status",
    );
    const id = Number(req.params.id);
    const t = one("SELECT * FROM tickets WHERE id=?", id);
    if (!t) return res.status(404).json({ error: "Ticket not found." });
    transaction(() => {
      run("UPDATE tickets SET status=? WHERE id=?", status, id);
      activity(
        "support",
        `Query GGIT-${String(id).padStart(4, "0")} marked ${status.replace("_", " ")}`,
      );
    });
    res.json(ticketView(one("SELECT * FROM tickets WHERE id=?", id)));
  });
  app.post("/api/chat", (req, res) => {
    const message = required(req.body.message, "Message", 1000).toLowerCase();
    let reply,
      suggestTicket = false;
    if (
      /\b(hi|hello|hey|help)\b/.test(message) &&
      message.split(/\s+/).length < 5
    )
      reply =
        "Hi! I’m the Gold’s Gym demo FAQ assistant. I can explain memberships, renewals, plans and how to raise a support query. What would you like help with?";
    else if (/freeze|pause|cancel|refund/.test(message)) {
      reply =
        "Membership freezes, cancellations and refunds require a club review. Please raise a query with the membership details. The demo records it in the Gold’s Gym IT support queue for triage; no refund or cancellation is performed automatically.";
      suggestTicket = true;
    } else if (
      /\b(ticket|query|support|login|app|bug|payment|receipt)\b|it team/.test(
        message,
      )
    ) {
      reply =
        "Use Raise query to describe your issue and add your contact email. You’ll receive a GGIT reference and the query will appear in the Gold’s Gym IT queue. Staff can mark it In progress or Resolved. External IT email/helpdesk delivery is not connected in this demo.";
      suggestTicket = true;
    } else if (/expir|renew|extend/.test(message))
      reply =
        "Open Members and select a member to see their expiry date, then choose Renew membership. Renewals add the selected plan from the current expiry date, or from today if expired. Reminders are queued 7 days, 3 days and on the expiry date. In this demo, sending is simulated.";
    else if (/plan|price|cost|fee|membership/.test(message))
      reply =
        "This demo club offers Monthly at ₹3,000, Quarterly at ₹7,500 and Annual at ₹24,000. Open Members → Add member to enrol someone, or select a member to review their plan and expiry. These are illustrative prices for the showcase.";
    else if (/hour|timing|open|close/.test(message))
      reply =
        "For this demo, the Indiranagar club’s sample hours are Monday–Saturday, 6 AM–10 PM, and Sunday, 7 AM–2 PM. Confirm actual branch timings with the club front desk.";
    else if (/message|whatsapp|email|reminder|automat/.test(message))
      reply =
        "Renewals checks expiry dates automatically once a minute while the server is running. It queues reminders at 7 days, 3 days and on expiry. Use Simulate dispatch to demonstrate the outbox. No WhatsApp or email is sent until a verified provider integration is added.";
    else {
      reply =
        "I can answer basic questions about demo memberships, renewals, prices, timings and reminders. I don’t have an answer for that yet. Raise a query to record the issue in the Gold’s Gym IT support queue.";
      suggestTicket = true;
    }
    res.json({
      reply,
      suggestTicket,
      suggestions: [
        "Membership plans",
        "How do renewals work?",
        "Raise a support query",
      ],
    });
  });
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "API endpoint not found." }),
  );
  const dist = resolve(ROOT, "dist");
  if (existsSync(resolve(dist, "index.html"))) {
    app.use(express.static(dist));
    app.get("/{*path}", (req, res) =>
      res.sendFile(resolve(dist, "index.html")),
    );
  }
  app.use((error, req, res, next) => {
    if (error.type === "entity.parse.failed")
      return res
        .status(400)
        .json({ error: "Request body must be valid JSON." });
    if (error.type === "entity.too.large")
      return res.status(413).json({ error: "Request is too large." });
    if (error.status)
      return res.status(error.status).json({ error: error.message });
    console.error("API error:", error.message);
    res
      .status(500)
      .json({ error: "The request could not be completed. Please try again." });
  });
  scan();
  return { app, db, scan };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const { app, db, scan } = createApp();
  const port = Number(process.env.PORT || 3000);
  const server = app.listen(port, "0.0.0.0", () =>
    console.log(
      `Gold’s Gym demo running on port ${port}. Messaging and IT routing are local simulations.`,
    ),
  );
  const timer = setInterval(() => {
    try {
      scan();
    } catch (error) {
      console.error("Reminder scan failed:", error.message);
    }
  }, 60000);
  timer.unref();
  const close = () => {
    clearInterval(timer);
    server.close(() => {
      db.close();
      process.exit(0);
    });
  };
  process.on("SIGTERM", close);
  process.on("SIGINT", close);
}
