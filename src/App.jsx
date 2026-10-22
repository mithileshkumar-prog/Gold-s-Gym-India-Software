import React, { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BellRing,
  Bot,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  CreditCard,
  Dumbbell,
  LayoutDashboard,
  LoaderCircle,
  Mail,
  MessageCircle,
  MessageSquareText,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Ticket,
  Users,
  Wallet,
  X,
} from "lucide-react";

const navItems = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "members", label: "Members", icon: Users },
  { id: "renewals", label: "Renewals", icon: BellRing },
  { id: "support", label: "Support desk", icon: MessageSquareText },
];
const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
const number = (value) => new Intl.NumberFormat("en-IN").format(value || 0);
const date = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      })
    : "—";
const localToday = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const initials = (name) =>
  (name || "GG")
    .split(" ")
    .map((v) => v[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
const statusLabel = (value) =>
  ({
    active: "Active",
    expiring: "Expiring soon",
    expired: "Expired",
    open: "Open",
    in_progress: "In progress",
    resolved: "Resolved",
    queued: "Queued",
    simulated: "Simulated",
  })[value] || value;
async function api(path, options = {}) {
  const response = await fetch("/api" + path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const body = await response.json();
  if (!response.ok)
    throw new Error(body.error || "Something went wrong. Please try again.");
  return body;
}
function Badge({ status }) {
  return (
    <span className={`badge badge-${status}`}>
      <i />
      {statusLabel(status)}
    </span>
  );
}
function Avatar({ name, index = 0, large = false }) {
  return (
    <span
      className={`avatar avatar-${index % 5} ${large ? "avatar-large" : ""}`}
    >
      {initials(name)}
    </span>
  );
}
function Empty({ icon: Icon = Users, title, text }) {
  return (
    <div className="empty">
      <Icon size={28} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
function Modal({ title, subtitle, onClose, children, wide = false }) {
  const panel = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    const focusable = () =>
      [
        ...panel.current.querySelectorAll(
          'button,input,select,textarea,[tabindex="0"]',
        ),
      ].filter((el) => !el.disabled);
    focusable()[0]?.focus();
    const key = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const els = focusable();
        const first = els[0],
          last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = old;
      prev?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        className={`modal ${wide ? "modal-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        ref={panel}
      >
        <header className="modal-header">
          <div>
            <h2 id="modal-title">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
function FormField({ label, children, span = false }) {
  return (
    <label className={`form-field ${span ? "field-full" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export default function App() {
  const [page, setPage] = useState("overview");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [ticketFilter, setTicketFilter] = useState("all");
  const [chartMetric, setChartMetric] = useState("members");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      role: "bot",
      text: "Hi! I’m Gold’s Assist, your demo FAQ assistant. I can help with memberships, renewals, club hours and technical support. How can I help?",
      suggestions: ["How do I renew?", "Club timings", "I need technical help"],
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const chatEnd = useRef(null);
  const load = async (initial = false) => {
    if (initial) setLoading(true);
    try {
      const [overview, members, renewals, tickets] = await Promise.all([
        api("/overview"),
        api("/members"),
        api("/renewals"),
        api("/tickets"),
      ]);
      setData({ overview, members, renewals, tickets });
      setError("");
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load(true).catch(() => {});
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [chatMessages, chatOpen]);
  const go = (next) => {
    setPage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const mutate = async (path, body, success, method = "POST", close = true) => {
    setBusy(true);
    try {
      const result = await api(path, { method, body: JSON.stringify(body) });
      if (close) setModal(null);
      const message = typeof success === "function" ? success(result) : success;
      try {
        await load();
        setToast(message);
      } catch {
        setToast(`${message} The view could not refresh; use Try again.`);
      }
      return result;
    } catch (e) {
      setToast(e.message);
    } finally {
      setBusy(false);
    }
  };
  const updateSettings = async (patch) => {
    const previous = data.renewals.settings;
    setData((current) => ({
      ...current,
      renewals: {
        ...current.renewals,
        settings: { ...current.renewals.settings, ...patch },
      },
    }));
    setBusy(true);
    try {
      await api("/settings", { method: "PATCH", body: JSON.stringify(patch) });
      try {
        await load();
        setToast("Automation settings updated.");
      } catch {
        setToast("Settings saved. The view could not refresh; use Try again.");
      }
    } catch (e) {
      setData((current) => ({
        ...current,
        renewals: { ...current.renewals, settings: previous },
      }));
      setToast(e.message);
    } finally {
      setBusy(false);
    }
  };
  const sendChat = async (text) => {
    const message = (text || chatInput).trim();
    if (!message || chatBusy) return;
    setChatInput("");
    setChatMessages((current) => [...current, { role: "user", text: message }]);
    setChatBusy(true);
    try {
      const result = await api("/chat", {
        method: "POST",
        body: JSON.stringify({ message }),
      });
      setChatMessages((current) => [
        ...current,
        {
          role: "bot",
          text: result.reply,
          suggestions: result.suggestions || [],
          suggestTicket: result.suggestTicket,
        },
      ]);
    } catch (e) {
      setChatMessages((current) => [
        ...current,
        { role: "bot", text: e.message, suggestTicket: true },
      ]);
    } finally {
      setChatBusy(false);
    }
  };
  const exportMembers = () => {
    const rows = [
      ["Member ID", "Name", "Email", "Phone", "Plan", "Expiry date", "Status"],
      ...filteredMembers.map((m) => [
        m.memberCode,
        m.name,
        m.email,
        m.phone,
        m.planName,
        m.expiryDate,
        m.status,
      ]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map(
            (value) =>
              '"' +
              String(value ?? "")
                .replace(/^[=+@-]/, "'" + String(value ?? "")[0])
                .replaceAll('"', '""') +
              '"',
          )
          .join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "golds-gym-members.csv";
    a.click();
    URL.revokeObjectURL(url);
    setToast("Member list exported.");
  };
  const allMembers = data?.members.members || [];
  const filteredMembers = allMembers.filter(
    (m) =>
      (statusFilter === "all" || m.status === statusFilter) &&
      `${m.name} ${m.memberCode} ${m.email} ${m.phone}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const plans = data?.members.plans || [];
  const stats = data?.overview.stats || {};
  const renewals = data?.renewals;
  const ticketData = data?.tickets;
  const currentNav = navItems.find((v) => v.id === page);
  const memberRows = (members, compact = false) => (
    <div className="table-scroll">
      <table className={`members-table ${compact ? "table-compact" : ""}`}>
        <thead>
          <tr>
            <th>Member</th>
            <th>Membership</th>
            <th>Expiry date</th>
            <th>Status</th>
            <th className="align-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member, index) => (
            <tr key={member.id}>
              <td>
                <button
                  className="member-cell"
                  onClick={() => setModal({ type: "detail", member })}
                >
                  <Avatar name={member.name} index={index} />
                  <span>
                    <strong>{member.name}</strong>
                    <small>{member.memberCode}</small>
                  </span>
                </button>
              </td>
              <td>
                <span className="plan-name">{member.planName}</span>
              </td>
              <td>
                <span>{date(member.expiryDate)}</span>
                <small className={member.daysLeft <= 7 ? "text-amber" : ""}>
                  {member.daysLeft < 0
                    ? `${Math.abs(member.daysLeft)} days overdue`
                    : member.daysLeft === 0
                      ? "Expires today"
                      : `${member.daysLeft} days left`}
                </small>
              </td>
              <td>
                <Badge status={member.status} />
              </td>
              <td className="align-right">
                <button
                  className="text-button"
                  onClick={() => setModal({ type: "renew", member })}
                >
                  Renew <ArrowUpRight size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go("overview");
          }}
        >
          <span className="brand-mark">
            <Dumbbell size={29} strokeWidth={2.7} />
          </span>
          <span>
            GOLD’S GYM<small>INDIA · CLUB MANAGEMENT</small>
          </span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${page === id ? "nav-active" : ""}`}
              onClick={() => go(id)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {id === "renewals" && stats.expiringMembers > 0 && (
                <span className="nav-count">{stats.expiringMembers}</span>
              )}
              {id === "support" && stats.openTickets > 0 && (
                <span className="nav-dot" />
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="demo-card">
            <Sparkles size={19} />
            <strong>Built for a stronger club.</strong>
            <p>
              Your members. Your team.
              <br />
              One connected workspace.
            </p>
            <span>DEMO WORKSPACE</span>
          </div>
          <div className="club-profile">
            <span className="club-icon">
              <Dumbbell size={20} />
            </span>
            <div>
              <strong>{data?.overview.club?.name || "Gold’s Gym"}</strong>
              <small>
                {data?.overview.club?.location || "Indiranagar, Bengaluru"}
              </small>
            </div>
            <ShieldCheck size={17} />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <span className="mobile-mark">
              <Dumbbell size={24} />
            </span>
            <span className="desktop-only">
              Workspace <ChevronRight size={14} />
            </span>
            <strong>{currentNav.label}</strong>
          </div>
          <div className="topbar-actions">
            <span className="demo-indicator">
              <i />
              Demo workspace
            </span>
            <span className="header-divider" />
            <span className="user-avatar">AM</span>
            <span className="user-name">
              Club manager<small>Admin</small>
            </span>
          </div>
        </header>
        <main id="main-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {page === "overview"
                  ? "YOUR CLUB, AT A GLANCE"
                  : page === "members"
                    ? "THE PEOPLE BEHIND THE PROGRESS"
                    : page === "renewals"
                      ? "KEEP THE MOMENTUM GOING"
                      : "A LITTLE HELP GOES A LONG WAY"}
              </div>
              <h1>
                {page === "overview"
                  ? "Club overview"
                  : page === "members"
                    ? "Members"
                    : page === "renewals"
                      ? "Renewals & reminders"
                      : "Support desk"}
                <span className="heading-dot">.</span>
              </h1>
              <p>
                {page === "overview"
                  ? "A stronger community starts with staying connected."
                  : page === "members"
                    ? "Every membership, milestone and renewal in one place."
                    : page === "renewals"
                      ? "Timely reminders. Fewer missed renewals. More progress."
                      : "Quick answers for members. Clear ownership for your team."}
              </p>
            </div>
            <div className="heading-actions">
              {page === "overview" && (
                <div className="date-pill">
                  <CalendarDays size={16} />
                  {date(new Date())}
                </div>
              )}
              {page === "members" && (
                <button
                  className="button button-secondary"
                  onClick={exportMembers}
                  disabled={!data}
                >
                  <ArrowDownToLine size={16} />
                  <span>Export</span>
                </button>
              )}
              {page === "support" ? (
                <button
                  className="button button-primary"
                  onClick={() => setModal({ type: "ticket" })}
                >
                  <Plus size={17} />
                  Raise a query
                </button>
              ) : (
                <button
                  className="button button-primary"
                  onClick={() => setModal({ type: "member" })}
                >
                  <Plus size={17} />
                  Add member
                </button>
              )}
            </div>
          </div>
          {error && (
            <div className="error-banner" role="alert">
              <CircleHelp size={18} />
              <span>{error}</span>
              <button onClick={() => load(true).catch(() => {})}>
                Try again
              </button>
            </div>
          )}
          {loading ? (
            <div className="loading-state">
              <LoaderCircle className="spin" size={30} />
              <h3>Getting your club ready…</h3>
              <p>Loading memberships and activity</p>
            </div>
          ) : (
            data && (
              <>
                {page === "overview" && (
                  <>
                    <div className="stats-grid">
                      <Stat
                        icon={Users}
                        label="Total members"
                        value={number(stats.totalMembers)}
                        detail="Your growing fitness community"
                        tone="gold"
                      />
                      <Stat
                        icon={Activity}
                        label="Active memberships"
                        value={number(stats.activeMembers)}
                        detail="Includes memberships expiring soon"
                        tone="green"
                      />
                      <Stat
                        icon={Clock3}
                        label="Expiring in 7 days"
                        value={number(stats.expiringMembers)}
                        detail="A little nudge goes a long way"
                        tone="amber"
                        action={() => {
                          setStatusFilter("expiring");
                          setSearch("");
                          go("members");
                        }}
                      />
                      <Stat
                        icon={Wallet}
                        label="Revenue this month"
                        value={money(stats.monthlyRevenue)}
                        detail="Recorded membership payments"
                        tone="purple"
                      />
                    </div>
                    <div className="overview-middle">
                      <section className="panel growth-panel">
                        <div className="panel-header">
                          <div>
                            <h2>Club growth</h2>
                            <p>Membership activity over the last 6 months</p>
                          </div>
                          <div className="segmented" aria-label="Chart metric">
                            <button
                              className={
                                chartMetric === "members" ? "selected" : ""
                              }
                              onClick={() => setChartMetric("members")}
                            >
                              Members
                            </button>
                            <button
                              className={
                                chartMetric === "revenue" ? "selected" : ""
                              }
                              onClick={() => setChartMetric("revenue")}
                            >
                              Revenue
                            </button>
                          </div>
                        </div>
                        <GrowthChart
                          trend={data.overview.trend || []}
                          metric={chartMetric}
                        />
                        <div className="chart-footer">
                          <span>
                            <i />
                            {chartMetric === "members"
                              ? "Total memberships"
                              : "Membership revenue"}
                          </span>
                          <span>Sample club data · updated live</span>
                        </div>
                      </section>
                      <section className="panel health-panel">
                        <div className="panel-header">
                          <div>
                            <h2>Membership health</h2>
                            <p>Keep your community moving</p>
                          </div>
                          <span className="tiny-icon">
                            <Activity size={17} />
                          </span>
                        </div>
                        <HealthRing stats={stats} />
                        <div className="health-legend">
                          <span>
                            <i className="legend-green" />
                            Active
                            <strong>
                              {Math.max(
                                0,
                                stats.activeMembers - stats.expiringMembers,
                              )}
                            </strong>
                          </span>
                          <span>
                            <i className="legend-gold" />
                            Expiring soon
                            <strong>{stats.expiringMembers}</strong>
                          </span>
                          <span>
                            <i className="legend-grey" />
                            Expired<strong>{stats.expiredMembers}</strong>
                          </span>
                        </div>
                      </section>
                    </div>
                    <div className="renewal-callout">
                      <div className="callout-icon">
                        <BellRing size={22} />
                      </div>
                      <div>
                        <h3>Help members keep their streak.</h3>
                        <p>
                          {stats.expiringMembers} memberships expire in the next
                          7 days. Make every reminder count.
                        </p>
                      </div>
                      <button onClick={() => go("renewals")}>
                        Manage renewals <ArrowRight size={17} />
                      </button>
                      <div className="callout-pattern" />
                    </div>
                    <div className="overview-bottom">
                      <section className="panel expiring-panel">
                        <div className="panel-header">
                          <div>
                            <h2>
                              Renewals on the horizon{" "}
                              <span className="count-bubble">
                                {stats.expiringMembers}
                              </span>
                            </h2>
                            <p>A timely check-in can make all the difference</p>
                          </div>
                          <button
                            className="text-button"
                            onClick={() => {
                              setStatusFilter("expiring");
                              setSearch("");
                              go("members");
                            }}
                          >
                            View all <ArrowRight size={15} />
                          </button>
                        </div>
                        {data.overview.expiringMembers?.length ? (
                          memberRows(
                            data.overview.expiringMembers.slice(0, 4),
                            true,
                          )
                        ) : (
                          <Empty
                            title="All caught up"
                            text="No memberships expire in the next seven days."
                          />
                        )}
                      </section>
                      <section className="panel activity-panel">
                        <div className="panel-header">
                          <div>
                            <h2>Recent activity</h2>
                            <p>The latest from your club</p>
                          </div>
                          <span className="live-dot" />
                        </div>
                        <div className="activity-list">
                          {data.overview.recentActivity?.length ? (
                            data.overview.recentActivity
                              .slice(0, 5)
                              .map((item, index) => (
                                <div className="activity-item" key={item.id}>
                                  <span
                                    className={`activity-icon activity-${index % 3}`}
                                  >
                                    {item.type === "ticket" ? (
                                      <Ticket size={15} />
                                    ) : item.type === "renewal" ? (
                                      <CheckCheck size={15} />
                                    ) : (
                                      <Users size={15} />
                                    )}
                                  </span>
                                  <div>
                                    <p>{item.message}</p>
                                    <small>{date(item.createdAt)}</small>
                                  </div>
                                </div>
                              ))
                          ) : (
                            <p className="muted">
                              Your club activity will appear here.
                            </p>
                          )}
                        </div>
                      </section>
                    </div>
                  </>
                )}
                {page === "members" && (
                  <>
                    <div className="member-summary">
                      <span>
                        <strong>{stats.totalMembers}</strong> total members
                      </span>
                      <span>
                        <i className="legend-green" />
                        <strong>
                          {stats.activeMembers - stats.expiringMembers}
                        </strong>{" "}
                        active
                      </span>
                      <span>
                        <i className="legend-gold" />
                        <strong>{stats.expiringMembers}</strong> expiring soon
                      </span>
                      <span>
                        <i className="legend-grey" />
                        <strong>{stats.expiredMembers}</strong> expired
                      </span>
                    </div>
                    <section className="panel">
                      <div className="member-toolbar">
                        <div
                          className="filter-tabs"
                          aria-label="Membership status"
                        >
                          {["all", "active", "expiring", "expired"].map(
                            (value) => (
                              <button
                                key={value}
                                className={
                                  statusFilter === value ? "active" : ""
                                }
                                onClick={() => setStatusFilter(value)}
                              >
                                {value === "all"
                                  ? "All members"
                                  : statusLabel(value)}
                              </button>
                            ),
                          )}
                        </div>
                        <label className="search-field">
                          <Search size={17} />
                          <input
                            aria-label="Search members"
                            placeholder="Search name, ID or phone…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                          />
                          {search && (
                            <button
                              aria-label="Clear search"
                              onClick={() => setSearch("")}
                            >
                              <X size={15} />
                            </button>
                          )}
                        </label>
                      </div>
                      {filteredMembers.length ? (
                        memberRows(filteredMembers)
                      ) : (
                        <Empty
                          title="No members found"
                          text="Try a different search or add your first member."
                        />
                      )}
                      <div className="table-footer">
                        Showing {filteredMembers.length} of {allMembers.length}{" "}
                        members<span>All times in India Standard Time</span>
                      </div>
                    </section>
                    <div className="section-heading">
                      <h2>Membership plans</h2>
                      <span>Available at this demo club</span>
                    </div>
                    <div className="plans-grid">
                      {plans.map((plan, index) => (
                        <div
                          className={`plan-card ${index === 1 ? "plan-featured" : ""}`}
                          key={plan.id}
                        >
                          <span className="plan-icon">
                            <Dumbbell size={21} />
                          </span>
                          <div>
                            <h3>{plan.name}</h3>
                            <p>
                              {plan.months}{" "}
                              {plan.months === 1 ? "month" : "months"} of
                              progress
                            </p>
                          </div>
                          <strong>{money(plan.price)}</strong>
                          <button
                            className="icon-button"
                            aria-label={`Add member with ${plan.name}`}
                            onClick={() =>
                              setModal({ type: "member", planId: plan.id })
                            }
                          >
                            <Plus size={19} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {page === "renewals" && (
                  <>
                    <div className="info-note">
                      <ShieldCheck size={18} />
                      <p>
                        <strong>Demo mode, real workflow.</strong> Reminders are
                        saved to a local outbox. Dispatch simulates delivery; no
                        WhatsApp messages or emails are sent.
                      </p>
                    </div>
                    <div className="renewal-stats">
                      <Stat
                        icon={Clock3}
                        label="Waiting in outbox"
                        value={renewals.summary.queued}
                        detail="Ready for simulated dispatch"
                        tone="gold"
                      />
                      <Stat
                        icon={CheckCheck}
                        label="Simulated messages"
                        value={renewals.summary.simulated}
                        detail="Recorded in this demo workspace"
                        tone="green"
                      />
                      <Stat
                        icon={BellRing}
                        label="Renewals coming up"
                        value={renewals.summary.dueSoon}
                        detail="Memberships needing a check-in"
                        tone="amber"
                      />
                    </div>
                    <section className="automation-panel">
                      <div className="automation-title">
                        <span className="automation-icon">
                          <Sparkles size={24} />
                        </span>
                        <div>
                          <h2>Let reminders do the follow-up.</h2>
                          <p>
                            Automatically check for renewals at{" "}
                            {renewals.settings.days.join(", ")} days before
                            expiry.
                          </p>
                        </div>
                        <label className="switch-label">
                          <span>
                            {renewals.settings.automationEnabled
                              ? "Automation on"
                              : "Automation paused"}
                          </span>
                          <input
                            type="checkbox"
                            aria-label="Enable renewal automation"
                            checked={renewals.settings.automationEnabled}
                            disabled={busy}
                            onChange={(e) =>
                              updateSettings({
                                automationEnabled: e.target.checked,
                              })
                            }
                          />
                          <span className="switch" />
                        </label>
                      </div>
                      <div className="automation-bottom">
                        <label>
                          Reminder channel
                          <select
                            value={renewals.settings.channel}
                            disabled={busy}
                            onChange={(e) =>
                              updateSettings({ channel: e.target.value })
                            }
                          >
                            <option value="whatsapp">
                              WhatsApp · simulated
                            </option>
                            <option value="email">Email · simulated</option>
                          </select>
                        </label>
                        <div className="automation-copy">
                          <i />
                          Checks run automatically while the server is running.
                        </div>
                        <button
                          className="button button-secondary"
                          disabled={busy}
                          onClick={() =>
                            mutate(
                              "/renewals/scan",
                              {},
                              (result) =>
                                `${result.created} new reminder${result.created === 1 ? "" : "s"} queued. Existing reminders are not duplicated.`,
                              "POST",
                              false,
                            )
                          }
                        >
                          <BellRing size={16} />
                          Check renewals now
                        </button>
                      </div>
                    </section>
                    <section className="panel">
                      <div className="panel-header">
                        <div>
                          <h2>
                            Reminder outbox{" "}
                            <span className="count-bubble">
                              {renewals.reminders.length}
                            </span>
                          </h2>
                          <p>Personal follow-ups, without the manual work</p>
                        </div>
                        <button
                          className="button button-primary"
                          disabled={busy || !renewals.summary.queued}
                          onClick={() => setModal({ type: "dispatch" })}
                        >
                          <Send size={16} />
                          Simulate dispatch
                        </button>
                      </div>
                      {renewals.reminders.length ? (
                        <div className="table-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>Member</th>
                                <th>Expiry date</th>
                                <th>Channel</th>
                                <th>Status</th>
                                <th className="align-right">Message</th>
                              </tr>
                            </thead>
                            <tbody>
                              {renewals.reminders.map((item, index) => (
                                <tr key={item.id}>
                                  <td>
                                    <div className="member-cell">
                                      <Avatar
                                        name={item.memberName}
                                        index={index}
                                      />
                                      <span>
                                        <strong>{item.memberName}</strong>
                                        <small>
                                          {item.channel === "email"
                                            ? item.email
                                            : item.phone}
                                        </small>
                                      </span>
                                    </div>
                                  </td>
                                  <td>{date(item.expiryDate)}</td>
                                  <td>
                                    <span className="channel-label">
                                      {item.channel === "email" ? (
                                        <Mail size={15} />
                                      ) : (
                                        <MessageCircle size={15} />
                                      )}
                                      {item.channel === "email"
                                        ? "Email"
                                        : "WhatsApp"}
                                    </span>
                                  </td>
                                  <td>
                                    <Badge status={item.status} />
                                  </td>
                                  <td className="align-right">
                                    <button
                                      className="text-button"
                                      onClick={() =>
                                        setModal({
                                          type: "message",
                                          reminder: item,
                                        })
                                      }
                                    >
                                      Preview <ArrowUpRight size={14} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <Empty
                          icon={BellRing}
                          title="The outbox is clear"
                          text="Run a renewal check to queue eligible reminders."
                        />
                      )}
                      <div className="table-footer">
                        One reminder per member, expiry date and reminder window
                        <span>No live messaging provider connected</span>
                      </div>
                    </section>
                  </>
                )}
                {page === "support" && (
                  <>
                    <div className="support-cards">
                      <section className="support-assist">
                        <div className="support-symbol">
                          <Bot size={29} />
                        </div>
                        <span className="eyebrow">GOLD’S ASSIST</span>
                        <h2>
                          Quick questions.
                          <br />
                          Instant answers.
                        </h2>
                        <p>
                          Find answers about memberships, renewals and club
                          policies with our demo FAQ assistant.
                        </p>
                        <button
                          className="button button-primary"
                          onClick={() => setChatOpen(true)}
                        >
                          Ask the assistant <ArrowRight size={17} />
                        </button>
                      </section>
                      <section className="support-human">
                        <span className="support-symbol">
                          <Ticket size={28} />
                        </span>
                        <span className="eyebrow">YOUR IT SUPPORT TEAM</span>
                        <h2>
                          Some things need
                          <br />a human touch.
                        </h2>
                        <p>
                          Raise a query and track it in the Gold’s Gym IT queue.
                          This demo stores tickets locally.
                        </p>
                        <button
                          className="button button-secondary"
                          onClick={() => setModal({ type: "ticket" })}
                        >
                          Raise a query <Plus size={17} />
                        </button>
                      </section>
                    </div>
                    <section className="panel">
                      <div className="panel-header">
                        <div>
                          <h2>
                            IT query queue{" "}
                            <span className="count-bubble">
                              {ticketData.tickets.length}
                            </span>
                          </h2>
                          <p>Assigned to Gold’s Gym IT · local demo queue</p>
                        </div>
                        <label className="compact-select">
                          <span className="sr-only">Filter ticket status</span>
                          <select
                            value={ticketFilter}
                            onChange={(e) => setTicketFilter(e.target.value)}
                          >
                            <option value="all">All queries</option>
                            <option value="open">Open</option>
                            <option value="in_progress">In progress</option>
                            <option value="resolved">Resolved</option>
                          </select>
                          <ChevronDown size={15} />
                        </label>
                      </div>
                      {ticketData.tickets.filter(
                        (t) =>
                          ticketFilter === "all" || t.status === ticketFilter,
                      ).length ? (
                        <div className="ticket-list">
                          {ticketData.tickets
                            .filter(
                              (t) =>
                                ticketFilter === "all" ||
                                t.status === ticketFilter,
                            )
                            .map((ticket) => (
                              <div className="ticket-row" key={ticket.id}>
                                <span
                                  className={`ticket-icon priority-${ticket.priority}`}
                                >
                                  <Ticket size={21} />
                                </span>
                                <button
                                  className="ticket-info"
                                  onClick={() =>
                                    setModal({ type: "ticketDetail", ticket })
                                  }
                                >
                                  <span className="ticket-meta">
                                    {ticket.reference} <i />
                                    {ticket.category} <i />
                                    {date(ticket.createdAt)}
                                  </span>
                                  <strong>{ticket.subject}</strong>
                                  <span>
                                    {ticket.memberName}{" "}
                                    <span
                                      className={`priority-text priority-${ticket.priority}`}
                                    >
                                      · {ticket.priority} priority
                                    </span>
                                  </span>
                                </button>
                                <Badge status={ticket.status} />
                                <button
                                  className="icon-button"
                                  aria-label={`View query ${ticket.reference}`}
                                  onClick={() =>
                                    setModal({ type: "ticketDetail", ticket })
                                  }
                                >
                                  <ChevronRight size={19} />
                                </button>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <Empty
                          icon={Ticket}
                          title="No queries here"
                          text="New queries will appear in this queue."
                        />
                      )}
                      <div className="table-footer">
                        {ticketData.summary.open} open ·{" "}
                        {ticketData.summary.inProgress} in progress ·{" "}
                        {ticketData.summary.resolved} resolved
                        <span>External IT notifications are not connected</span>
                      </div>
                    </section>
                  </>
                )}
              </>
            )
          )}
          <footer className="page-footer">
            <span>
              <Dumbbell size={14} />
              GOLD’S GYM INDIA
            </span>
            <span>Stronger together. Better connected.</span>
            <span>Functional prototype · Sample data</span>
          </footer>
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={page === id ? "active" : ""}
            onClick={() => go(id)}
          >
            <Icon size={21} />
            <span>{id === "support" ? "Support" : label}</span>
          </button>
        ))}
      </nav>
      <button
        className={`chat-launcher ${chatOpen ? "chat-launcher-open" : ""}`}
        onClick={() => setChatOpen(!chatOpen)}
        aria-expanded={chatOpen}
        aria-label={chatOpen ? "Close assistant" : "Open Gold’s Assist"}
      >
        {chatOpen ? (
          <X size={23} />
        ) : (
          <>
            <Bot size={23} />
            <span>Gold’s Assist</span>
            <i />
          </>
        )}
      </button>
      {chatOpen && (
        <section className="chat-panel" aria-label="Gold’s Assist FAQ chat">
          <header>
            <span className="chat-bot-icon">
              <Bot size={24} />
            </span>
            <div>
              <strong>Gold’s Assist</strong>
              <small>
                <i />
                Demo FAQ assistant
              </small>
            </div>
            <button
              className="icon-button"
              onClick={() => setChatOpen(false)}
              aria-label="Close assistant"
            >
              <X size={19} />
            </button>
          </header>
          <div className="chat-disclaimer">
            Answers use club demo FAQs. No generative AI or account access.
          </div>
          <div className="chat-messages" aria-live="polite">
            {chatMessages.map((item, index) => (
              <div key={index} className={`chat-message chat-${item.role}`}>
                <div className="chat-bubble">{item.text}</div>
                {item.suggestions?.length > 0 && (
                  <div className="chat-suggestions">
                    {item.suggestions.map((s) => (
                      <button
                        key={s}
                        disabled={chatBusy}
                        onClick={() => sendChat(s)}
                      >
                        {s}
                        <ChevronRight size={12} />
                      </button>
                    ))}
                  </div>
                )}
                {item.suggestTicket && (
                  <button
                    className="chat-ticket"
                    onClick={() => {
                      setChatOpen(false);
                      setModal({
                        type: "ticket",
                        description: chatMessages
                          .filter((m) => m.role === "user")
                          .map((m) => m.text)
                          .join("\n"),
                      });
                    }}
                  >
                    Raise a query with IT <ArrowUpRight size={14} />
                  </button>
                )}
              </div>
            ))}
            {chatBusy && (
              <div className="chat-typing">
                <span />
                <span />
                <span />
              </div>
            )}
            <div ref={chatEnd} />
          </div>
          <form
            className="chat-form"
            onSubmit={(e) => {
              e.preventDefault();
              sendChat();
            }}
          >
            <input
              aria-label="Message assistant"
              placeholder="Ask a question…"
              value={chatInput}
              maxLength={1000}
              onChange={(e) => setChatInput(e.target.value)}
            />
            <button
              type="submit"
              aria-label="Send message"
              disabled={!chatInput.trim() || chatBusy}
            >
              <Send size={18} />
            </button>
          </form>
          <button
            className="chat-escalate"
            onClick={() => {
              setChatOpen(false);
              setModal({ type: "ticket" });
            }}
          >
            Need more help? Raise a query <ArrowUpRight size={12} />
          </button>
        </section>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          <span>{toast}</span>
          <button
            onClick={() => setToast("")}
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      )}
      {modal?.type === "member" && (
        <MemberForm
          modal={modal}
          plans={plans}
          busy={busy}
          close={() => setModal(null)}
          save={(values) =>
            mutate(
              modal.member ? `/members/${modal.member.id}` : "/members",
              values,
              modal.member
                ? "Member details updated."
                : "Welcome to the club! Member added.",
              modal.member ? "PATCH" : "POST",
            )
          }
        />
      )}
      {modal?.type === "detail" && (
        <Modal
          title="Member profile"
          subtitle="A little detail behind the progress"
          onClose={() => setModal(null)}
        >
          <div className="member-profile-heading">
            <Avatar name={modal.member.name} large />
            <div>
              <h3>{modal.member.name}</h3>
              <p>{modal.member.memberCode}</p>
              <Badge status={modal.member.status} />
            </div>
          </div>
          <div className="detail-grid">
            <Detail label="Email" value={modal.member.email} />
            <Detail label="Phone" value={modal.member.phone} />
            <Detail label="Membership" value={modal.member.planName} />
            <Detail label="Plan price" value={money(modal.member.planPrice)} />
            <Detail label="Start date" value={date(modal.member.startDate)} />
            <Detail label="Expiry date" value={date(modal.member.expiryDate)} />
          </div>
          <div className="modal-actions">
            <button
              className="button button-secondary"
              onClick={() => setModal({ type: "member", member: modal.member })}
            >
              Edit details
            </button>
            <button
              className="button button-primary"
              onClick={() => setModal({ type: "renew", member: modal.member })}
            >
              Renew membership <ArrowRight size={16} />
            </button>
          </div>
        </Modal>
      )}
      {modal?.type === "renew" && (
        <RenewForm
          member={modal.member}
          plans={plans}
          busy={busy}
          close={() => setModal(null)}
          save={(planId) =>
            mutate(
              `/members/${modal.member.id}/renew`,
              { planId },
              "Membership renewed. Payment recorded in the demo ledger.",
            )
          }
        />
      )}
      {modal?.type === "ticket" && (
        <TicketForm
          description={modal.description}
          busy={busy}
          close={() => setModal(null)}
          save={(values) =>
            mutate(
              "/tickets",
              values,
              (result) =>
                `Query ${result.reference} added to the Gold’s Gym IT demo queue.`,
            )
          }
        />
      )}
      {modal?.type === "ticketDetail" && (
        <Modal
          title={modal.ticket.reference}
          subtitle="Gold’s Gym IT · local demo queue"
          onClose={() => setModal(null)}
        >
          <div className="ticket-detail-title">
            <h3>{modal.ticket.subject}</h3>
            <Badge status={modal.ticket.status} />
          </div>
          <div className="detail-grid">
            <Detail label="Raised by" value={modal.ticket.memberName} />
            <Detail label="Email" value={modal.ticket.email} />
            <Detail label="Category" value={modal.ticket.category} />
            <Detail label="Priority" value={modal.ticket.priority} />
            <Detail label="Assigned to" value={modal.ticket.assignedTo} />
            <Detail label="Created" value={date(modal.ticket.createdAt)} />
          </div>
          <div className="ticket-description">{modal.ticket.description}</div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              mutate(
                `/tickets/${modal.ticket.id}`,
                { status: new FormData(e.currentTarget).get("status") },
                "Query status updated.",
                "PATCH",
              );
            }}
          >
            <FormField label="Update status">
              <select name="status" defaultValue={modal.ticket.status}>
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="resolved">Resolved</option>
              </select>
            </FormField>
            <div className="modal-actions">
              <button
                className="button button-secondary"
                type="button"
                onClick={() => setModal(null)}
              >
                Close
              </button>
              <button className="button button-primary" disabled={busy}>
                {busy ? "Saving…" : "Save status"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {modal?.type === "message" && (
        <Modal
          title="Reminder preview"
          subtitle={`${modal.reminder.channel === "email" ? "Email" : "WhatsApp"} · simulated delivery only`}
          onClose={() => setModal(null)}
        >
          <div className="message-recipient">
            <Avatar name={modal.reminder.memberName} />
            <div>
              <strong>{modal.reminder.memberName}</strong>
              <small>
                {modal.reminder.channel === "email"
                  ? modal.reminder.email
                  : modal.reminder.phone}
              </small>
            </div>
            <Badge status={modal.reminder.status} />
          </div>
          <div className="message-preview">{modal.reminder.message}</div>
          <p className="form-note">
            This reminder is saved locally. No message will be sent to a live
            recipient.
          </p>
          <div className="modal-actions">
            <button
              className="button button-primary"
              onClick={() => setModal(null)}
            >
              Done <Check size={16} />
            </button>
          </div>
        </Modal>
      )}
      {modal?.type === "dispatch" && (
        <Modal
          title="Simulate reminder dispatch?"
          subtitle="Take the full renewal workflow for a test run"
          onClose={() => setModal(null)}
        >
          <div className="confirm-icon">
            <Send size={27} />
          </div>
          <p className="confirm-copy">
            Mark{" "}
            <strong>
              {renewals?.summary.queued} queued reminder
              {renewals?.summary.queued === 1 ? "" : "s"}
            </strong>{" "}
            as simulated. No WhatsApp messages or emails will be sent.
          </p>
          <p className="form-note">
            Connect an approved messaging provider before using this with real
            members.
          </p>
          <div className="modal-actions">
            <button
              className="button button-secondary"
              onClick={() => setModal(null)}
            >
              Cancel
            </button>
            <button
              className="button button-primary"
              disabled={busy}
              onClick={() =>
                mutate(
                  "/renewals/dispatch",
                  {},
                  (result) =>
                    `${result.simulated} reminder${result.simulated === 1 ? "" : "s"} simulated. No live messages sent.`,
                )
              }
            >
              {busy ? "Simulating…" : "Simulate dispatch"}
              <Send size={15} />
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function Stat({ icon: Icon, label, value, detail, tone, action }) {
  return (
    <div className={`stat-card stat-${tone}`}>
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">
          <Icon size={18} />
        </span>
      </div>
      <strong>{value}</strong>
      <div className="stat-detail">
        {action ? (
          <button onClick={action}>
            {detail}
            <ArrowUpRight size={13} />
          </button>
        ) : (
          <span>{detail}</span>
        )}
      </div>
    </div>
  );
}
function Detail({ label, value }) {
  return (
    <div className="detail">
      <span>{label}</span>
      <strong>{value || "—"}</strong>
    </div>
  );
}
function GrowthChart({ trend, metric }) {
  const max = Math.max(...trend.map((t) => Number(t[metric]) || 0), 1);
  const chartMax =
    Math.ceil(max / (metric === "revenue" ? 10000 : 5)) *
    (metric === "revenue" ? 10000 : 5);
  const [hover, setHover] = useState(null);
  return (
    <div className="growth-chart">
      <div className="chart-y">
        {[1, 0.75, 0.5, 0.25, 0].map((v) => (
          <span key={v}>
            {metric === "revenue"
              ? chartMax * v >= 1000
                ? `${Math.round((chartMax * v) / 1000)}k`
                : Math.round(chartMax * v)
              : Math.round(chartMax * v)}
          </span>
        ))}
      </div>
      <div className="chart-plot">
        <div className="chart-grid">
          {[1, 2, 3, 4, 5].map((v) => (
            <i key={v} />
          ))}
        </div>
        <div className="chart-bars">
          {trend.map((item, index) => (
            <div className="bar-column" key={item.month}>
              <div className="bar-track">
                <button
                  className={`chart-bar ${index === trend.length - 1 ? "bar-current" : ""}`}
                  aria-label={`${item.month}: ${metric === "revenue" ? money(item[metric]) : item[metric]} ${metric === "members" ? "members" : "revenue"}`}
                  style={{
                    height: `${Math.max(2, ((item[metric] || 0) / chartMax) * 100)}%`,
                  }}
                  onMouseEnter={() => setHover(index)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(index)}
                  onBlur={() => setHover(null)}
                  onClick={() => setHover(hover === index ? null : index)}
                >
                  {hover === index && (
                    <span className="chart-tooltip">
                      {metric === "revenue"
                        ? money(item[metric])
                        : `${item[metric]} members`}
                    </span>
                  )}
                </button>
              </div>
              <span
                className={index === trend.length - 1 ? "current-label" : ""}
              >
                {item.month}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
function HealthRing({ stats }) {
  const total = stats.totalMembers || 1;
  const active =
    (Math.max(0, (stats.activeMembers || 0) - (stats.expiringMembers || 0)) /
      total) *
    100;
  const expiring = active + ((stats.expiringMembers || 0) / total) * 100;
  return (
    <div className="health-ring-wrap">
      <div
        className="health-ring"
        style={{
          background: `conic-gradient(#4d8064 0% ${active}%, #e9bc42 ${active}% ${expiring}%, #e5e7e5 ${expiring}% 100%)`,
        }}
      >
        <div>
          <strong>{number(stats.totalMembers)}</strong>
          <span>Total members</span>
          <small>
            <i />
            Club community
          </small>
        </div>
      </div>
    </div>
  );
}
function MemberForm({ modal, plans, busy, close, save }) {
  const member = modal.member;
  const [planId, setPlanId] = useState(
    String(member?.planId || modal.planId || plans[0]?.id || ""),
  );
  const plan = plans.find((p) => String(p.id) === planId);
  return (
    <Modal
      title={member ? "Edit member details" : "Welcome a new member"}
      subtitle={
        member
          ? "Keep your member records up to date"
          : "Every fitness journey starts with a first step"
      }
      onClose={close}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const values = Object.fromEntries(new FormData(e.currentTarget));
          save(values);
        }}
      >
        <div className="form-grid">
          <FormField label="Full name" span>
            <input
              name="name"
              required
              maxLength={80}
              defaultValue={member?.name}
              placeholder="e.g. Aditi Sharma"
              autoComplete="name"
            />
          </FormField>
          <FormField label="Email address" span>
            <input
              name="email"
              type="email"
              required
              maxLength={180}
              defaultValue={member?.email}
              placeholder="member@example.com"
              autoComplete="email"
            />
          </FormField>
          <FormField label="Mobile number" span>
            <input
              name="phone"
              type="tel"
              required
              pattern="[+0-9 ()-]{10,20}"
              title="Enter a valid 10–15 digit mobile number, with optional country code"
              defaultValue={member?.phone}
              placeholder="+91 98765 43210"
              autoComplete="tel"
            />
          </FormField>
          <FormField label="Membership plan">
            <select
              name="planId"
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              required
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Start date">
            <input
              type="date"
              name="startDate"
              required
              max={member ? undefined : localToday()}
              defaultValue={member?.startDate?.slice(0, 10) || localToday()}
            />
          </FormField>
          {member && (
            <FormField label="Expiry date" span>
              <input
                type="date"
                name="expiryDate"
                required
                defaultValue={member.expiryDate?.slice(0, 10)}
              />
            </FormField>
          )}
        </div>
        <div className="form-plan-summary">
          <span>
            <CreditCard size={17} />
            {plan?.months} {plan?.months === 1 ? "month" : "months"} membership
          </span>
          <strong>{money(plan?.price)}</strong>
        </div>
        <p className="form-note">
          {member
            ? "Editing a plan changes the record only. Use Renew to extend membership and record a payment."
            : "Adding a member records the plan fee in the demo payment ledger. No real payment is collected."}
        </p>
        <div className="modal-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={close}
          >
            Cancel
          </button>
          <button className="button button-primary" disabled={busy}>
            {busy ? "Saving…" : member ? "Save changes" : "Add member"}
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
function RenewForm({ member, plans, busy, close, save }) {
  const [planId, setPlanId] = useState(String(member.planId));
  const plan = plans.find((p) => String(p.id) === planId);
  return (
    <Modal
      title="Keep the progress going"
      subtitle={`Renew ${member.name}’s membership`}
      onClose={close}
    >
      <div className="renew-member">
        <Avatar name={member.name} />
        <div>
          <strong>{member.name}</strong>
          <small>Current expiry: {date(member.expiryDate)}</small>
        </div>
        <Badge status={member.status} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save(planId);
        }}
      >
        <FormField label="Choose a membership plan">
          <select
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            required
          >
            {plans.map((p) => (
              <option value={p.id} key={p.id}>
                {p.name} · {p.months} months · {money(p.price)}
              </option>
            ))}
          </select>
        </FormField>
        <div className="renew-summary">
          <span>
            Membership extension
            <strong>
              {plan?.months} {plan?.months === 1 ? "month" : "months"}
            </strong>
          </span>
          <span>
            Amount recorded<strong>{money(plan?.price)}</strong>
          </span>
        </div>
        <p className="form-note">
          The new term starts after the current expiry, or from today if already
          expired. This records a demo payment; no money is collected.
        </p>
        <div className="modal-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={close}
          >
            Cancel
          </button>
          <button className="button button-primary" disabled={busy}>
            {busy ? "Renewing…" : "Confirm renewal"}
            <Check size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
function TicketForm({ description, busy, close, save }) {
  return (
    <Modal
      title="How can we help?"
      subtitle="Raise a query with the Gold’s Gym IT team"
      onClose={close}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save(Object.fromEntries(new FormData(e.currentTarget)));
        }}
      >
        <div className="form-grid">
          <FormField label="Your name">
            <input
              name="memberName"
              required
              maxLength={80}
              placeholder="Full name"
              autoComplete="name"
            />
          </FormField>
          <FormField label="Email address">
            <input
              name="email"
              type="email"
              required
              maxLength={180}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </FormField>
          <FormField label="Category">
            <select name="category">
              <option value="App & login">App & login</option>
              <option value="Membership">Membership</option>
              <option value="Billing">Billing</option>
              <option value="Technical">Technical issue</option>
              <option value="Other">Other</option>
            </select>
          </FormField>
          <FormField label="Priority">
            <select name="priority">
              <option value="medium">Normal</option>
              <option value="high">High</option>
              <option value="low">Low</option>
            </select>
          </FormField>
          <FormField label="Subject" span>
            <input
              name="subject"
              required
              minLength={3}
              maxLength={140}
              placeholder="A short summary of your query"
            />
          </FormField>
          <FormField label="Tell us a little more" span>
            <textarea
              name="description"
              required
              minLength={10}
              maxLength={2000}
              rows={4}
              placeholder="What happened? Include any details that could help the team."
              defaultValue={description}
            />
          </FormField>
        </div>
        <div className="form-notice">
          <ShieldCheck size={17} />
          <p>
            Your query will appear in the local <strong>Gold’s Gym IT</strong>{" "}
            demo queue. External email and ticketing services are not connected.
          </p>
        </div>
        <div className="modal-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={close}
          >
            Cancel
          </button>
          <button className="button button-primary" disabled={busy}>
            {busy ? "Submitting…" : "Submit query"}
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
