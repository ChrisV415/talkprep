import { Router } from "express";
import { db } from "@workspace/db";
import { users, usageCounts, sessions, proOverrides } from "@workspace/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import { adminAuth } from "../middlewares/adminAuth";
import { storage } from "../lib/storage";
import { logger } from "../lib/logger";

const router = Router();

// ─── HTML admin panel ──────────────────────────────────────────────────────────

router.get("/admin", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(ADMIN_HTML);
});

// ─── Password verification ─────────────────────────────────────────────────────

router.post("/admin/verify", adminAuth, (_req, res) => {
  res.json({ ok: true });
});

// ─── Stats ─────────────────────────────────────────────────────────────────────

router.get("/admin/stats", adminAuth, async (_req, res) => {
  try {
    const [totalUsers] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users);

    const [totalSessions] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sessions);

    const [totalPreps] = await db
      .select({ total: sql<number>`coalesce(sum(ai_calls),0)::int` })
      .from(usageCounts)
      .where(eq(usageCounts.period, "all-time"));

    const [overrideCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(proOverrides);

    // Count Stripe pro users from users table (have an active sub id)
    const [stripeProCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(sql`stripe_subscription_id is not null`);

    res.json({
      totalUsers: totalUsers?.count ?? 0,
      totalSessions: totalSessions?.count ?? 0,
      totalPreps: totalPreps?.total ?? 0,
      overrideProUsers: overrideCount?.count ?? 0,
      stripeProUsers: stripeProCount?.count ?? 0,
    });
  } catch (err) {
    logger.error({ err }, "admin/stats error");
    res.status(500).json({ error: "Failed to load stats" });
  }
});

// ─── User list ─────────────────────────────────────────────────────────────────

router.get("/admin/users", adminAuth, async (_req, res) => {
  try {
    // All users from our DB
    const allUsers = await db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt));

    // Prep counts (all-time period)
    const prepRows = await db
      .select({ userId: usageCounts.userId, preps: usageCounts.aiCalls })
      .from(usageCounts)
      .where(eq(usageCounts.period, "all-time"));
    const prepMap = new Map(prepRows.map((r) => [r.userId, r.preps]));

    // Session counts per user
    const sessionRows = await db
      .select({
        userId: sessions.userId,
        count: sql<number>`count(*)::int`,
      })
      .from(sessions)
      .groupBy(sessions.userId);
    const sessionMap = new Map(sessionRows.map((r) => [r.userId, r.count]));

    // Pro overrides
    const overrideRows = await db.select().from(proOverrides);
    const overrideMap = new Map(overrideRows.map((r) => [r.userId, r]));

    // Fetch emails from Clerk in one shot
    const clerkEmailMap = await fetchClerkEmails(allUsers.map((u) => u.id));

    const result = allUsers.map((u) => {
      const hasOverride = overrideMap.has(u.id);
      const hasStripe = !!u.stripeSubscriptionId;
      let proSource: "stripe" | "override" | "none" = "none";
      if (hasOverride) proSource = "override";
      else if (hasStripe) proSource = "stripe";

      return {
        userId: u.id,
        email: clerkEmailMap.get(u.id) ?? u.email ?? "",
        joinedAt: u.createdAt,
        prepsUsed: prepMap.get(u.id) ?? 0,
        sessionCount: sessionMap.get(u.id) ?? 0,
        proSource,
        overrideNote: overrideMap.get(u.id)?.note ?? "",
        stripeSubscriptionId: u.stripeSubscriptionId ?? null,
      };
    });

    res.json(result);
  } catch (err) {
    logger.error({ err }, "admin/users error");
    res.status(500).json({ error: "Failed to load users" });
  }
});

// ─── Grant pro override ────────────────────────────────────────────────────────

router.post("/admin/users/:userId/grant", adminAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { note = "Admin grant" } = req.body as { note?: string };
    await storage.grantProOverride(userId, note);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "admin/grant error");
    res.status(500).json({ error: "Failed to grant override" });
  }
});

// ─── Revoke pro override ───────────────────────────────────────────────────────

router.delete("/admin/users/:userId/grant", adminAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    await storage.revokeProOverride(userId);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "admin/revoke error");
    res.status(500).json({ error: "Failed to revoke override" });
  }
});

// ─── Reset prep count ──────────────────────────────────────────────────────────

router.post("/admin/users/:userId/reset-preps", adminAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    await db
      .delete(usageCounts)
      .where(
        sql`${usageCounts.userId} = ${userId} AND ${usageCounts.period} = 'all-time'`,
      );
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "admin/reset-preps error");
    res.status(500).json({ error: "Failed to reset preps" });
  }
});

// ─── Clerk email helper ────────────────────────────────────────────────────────

async function fetchClerkEmails(userIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret || userIds.length === 0) return map;
  try {
    const url = `https://api.clerk.com/v1/users?limit=500`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (!res.ok) return map;
    const data = (await res.json()) as Array<{
      id: string;
      email_addresses?: Array<{ email_address: string }>;
    }>;
    for (const u of data) {
      const email = u.email_addresses?.[0]?.email_address ?? "";
      map.set(u.id, email);
    }
  } catch {
    // Non-fatal — emails just won't show
  }
  return map;
}

export default router;

// ─── Admin panel HTML ──────────────────────────────────────────────────────────

const ADMIN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<meta name="mobile-web-app-capable" content="yes"/>
<meta name="apple-mobile-web-app-capable" content="yes"/>
<meta name="apple-mobile-web-app-status-bar-style" content="default"/>
<title>TalkPrep Admin</title>
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
  :root{
    --cream:#f9f5ef;--rust:#c4622d;--rust-dark:#a34f22;--rust-light:#f0ddd0;
    --sage:#5c7a6a;--ink:#1c1814;--ink3:#6b5f58;--ink4:#a89e98;
    --white:#fff;--red:#c0392b;--green:#2e7d32;
    --radius:10px;--shadow:0 2px 12px rgba(28,24,20,.10);
  }
  body{font-family:-apple-system,BlinkMacSystemFont,'Inter',system-ui,sans-serif;background:var(--cream);color:var(--ink);min-height:100vh;-webkit-font-smoothing:antialiased}

  /* ── Login ── */
  #login{display:flex;align-items:center;justify-content:center;min-height:100vh;min-height:100dvh;padding:20px;padding-top:max(20px,env(safe-area-inset-top))}
  .login-card{background:var(--white);border-radius:16px;padding:40px 32px;width:100%;max-width:380px;box-shadow:var(--shadow)}
  .login-logo{font-size:21px;font-weight:700;color:var(--rust);letter-spacing:-.5px;margin-bottom:6px}
  .login-sub{font-size:14px;color:var(--ink3);margin-bottom:28px;line-height:1.4}
  .field label{display:block;font-size:11px;font-weight:600;color:var(--ink3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}
  .field input{
    width:100%;padding:14px;border:1.5px solid #e0d8d2;border-radius:var(--radius);
    font-size:16px;outline:none;transition:border-color .15s;
    -webkit-appearance:none;appearance:none;background:var(--white);color:var(--ink)
  }
  .field input:focus{border-color:var(--rust)}
  .btn{
    display:flex;align-items:center;justify-content:center;gap:6px;
    min-height:48px;padding:12px 20px;border-radius:var(--radius);
    font-size:15px;font-weight:600;cursor:pointer;border:none;
    transition:opacity .15s,background .15s;touch-action:manipulation;
    -webkit-appearance:none;user-select:none
  }
  .btn:active{opacity:.75}
  .btn-primary{background:var(--rust);color:var(--white);width:100%;margin-top:18px}
  @media(hover:hover){.btn-primary:hover{background:var(--rust-dark)}}
  .btn-sm{min-height:36px;padding:8px 14px;font-size:13px;border-radius:8px}
  .btn-grant{background:var(--sage);color:var(--white)}
  .btn-revoke{background:var(--rust-light);color:var(--rust-dark)}
  .btn-reset{background:#f0ede8;color:var(--ink3);border:1px solid #ddd5cd}
  .error-msg{color:var(--red);font-size:13px;margin-top:12px;text-align:center;min-height:20px}

  /* ── Dashboard ── */
  #dashboard{display:none}
  .topbar{
    background:var(--white);border-bottom:1px solid #e8e0d8;
    padding:0 16px 0 20px;height:52px;
    display:flex;align-items:center;justify-content:space-between;
    position:sticky;top:0;z-index:10;
    padding-left:max(20px,env(safe-area-inset-left));
    padding-right:max(16px,env(safe-area-inset-right));
  }
  .topbar-brand{font-size:16px;font-weight:700;color:var(--rust)}
  .topbar-right{display:flex;align-items:center;gap:10px}
  .count-badge{font-size:12px;color:var(--ink3);background:#f0ede8;padding:3px 9px;border-radius:20px;font-weight:500}
  .btn-logout{
    background:none;border:1.5px solid #e0d8d2;color:var(--ink3);
    min-height:34px;padding:0 14px;font-size:13px;border-radius:8px;
    cursor:pointer;font-weight:500;touch-action:manipulation
  }
  .btn-logout:active{opacity:.7}

  .main{
    padding:20px;max-width:1100px;margin:0 auto;
    padding-left:max(20px,env(safe-area-inset-left));
    padding-right:max(20px,env(safe-area-inset-right));
    padding-bottom:max(24px,env(safe-area-inset-bottom));
  }
  .page-title{font-size:22px;font-weight:700;color:var(--ink);margin-bottom:3px}
  .page-sub{font-size:13px;color:var(--ink3);margin-bottom:20px}

  /* ── Stats ── */
  .stats-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:24px}
  @media(min-width:480px){.stats-grid{grid-template-columns:repeat(3,1fr)}}
  @media(min-width:700px){.stats-grid{grid-template-columns:repeat(5,1fr)}}
  .stat-card{background:var(--white);border-radius:var(--radius);padding:16px;box-shadow:var(--shadow)}
  .stat-val{font-size:28px;font-weight:700;color:var(--ink);line-height:1}
  .stat-label{font-size:11px;color:var(--ink3);text-transform:uppercase;letter-spacing:.4px;margin-top:5px}

  /* ── Toolbar ── */
  .toolbar{display:flex;align-items:stretch;gap:10px;margin-bottom:14px;flex-wrap:wrap}
  .search-wrap{flex:1;min-width:200px;position:relative}
  .search-wrap svg{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--ink4);pointer-events:none}
  .search-box{
    width:100%;padding:11px 12px 11px 36px;
    border:1.5px solid #e0d8d2;border-radius:var(--radius);
    font-size:15px;outline:none;transition:border-color .15s;
    -webkit-appearance:none;background:var(--white);color:var(--ink)
  }
  .search-box:focus{border-color:var(--rust)}
  .refresh-btn{
    background:var(--white);border:1.5px solid #e0d8d2;color:var(--ink3);
    min-height:44px;padding:0 16px;border-radius:var(--radius);
    font-size:13px;cursor:pointer;font-weight:500;white-space:nowrap;touch-action:manipulation
  }
  .refresh-btn:active{opacity:.7}

  /* ── Desktop table ── */
  .table-wrap{background:var(--white);border-radius:var(--radius);box-shadow:var(--shadow);overflow-x:auto;display:none}
  @media(min-width:640px){.table-wrap{display:block}}
  table{width:100%;border-collapse:collapse;font-size:13px}
  thead th{background:#faf7f4;padding:10px 14px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--ink3);border-bottom:1px solid #ede8e2;white-space:nowrap}
  tbody tr{border-bottom:1px solid #f0ede8;transition:background .1s}
  tbody tr:last-child{border-bottom:none}
  @media(hover:hover){tbody tr:hover{background:#fdf9f6}}
  td{padding:12px 14px;vertical-align:middle}
  .email-cell{font-weight:500;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .id-cell{font-family:ui-monospace,monospace;font-size:11px;color:var(--ink4)}
  .badge{display:inline-flex;align-items:center;padding:3px 9px;border-radius:20px;font-size:11px;font-weight:600;white-space:nowrap}
  .badge-stripe{background:#e8f0fe;color:#1a56db}
  .badge-override{background:#e6f4ea;color:var(--green)}
  .badge-free{background:#f5f5f5;color:var(--ink3)}
  .actions{display:flex;gap:6px;flex-wrap:wrap}
  .loading-row{text-align:center;padding:40px;color:var(--ink4);font-size:14px}
  .empty-row{text-align:center;padding:40px;color:var(--ink4);font-size:14px}

  /* ── Mobile cards (< 640px) ── */
  .cards-list{display:flex;flex-direction:column;gap:10px}
  @media(min-width:640px){.cards-list{display:none}}
  .user-card{background:var(--white);border-radius:var(--radius);padding:16px;box-shadow:var(--shadow)}
  .card-top{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:10px}
  .card-email{font-weight:600;font-size:14px;color:var(--ink);word-break:break-all;flex:1}
  .card-meta{display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap}
  .card-meta-item{font-size:12px;color:var(--ink3)}
  .card-meta-item strong{color:var(--ink);font-weight:600}
  .card-id{font-family:ui-monospace,monospace;font-size:11px;color:var(--ink4);margin-bottom:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .card-actions{display:flex;gap:8px;flex-wrap:wrap}
  .card-actions .btn-sm{flex:1;min-width:100px}
  .cards-loading{text-align:center;padding:40px;color:var(--ink4);font-size:14px}
  .cards-empty{text-align:center;padding:40px;color:var(--ink4);font-size:14px}

  /* ── Toast ── */
  .toast{
    position:fixed;bottom:max(24px,env(safe-area-inset-bottom));
    left:50%;transform:translateX(-50%) translateY(12px);
    background:var(--ink);color:var(--white);
    padding:12px 22px;border-radius:var(--radius);
    font-size:14px;font-weight:500;z-index:100;
    opacity:0;transition:all .22s;white-space:nowrap;
    pointer-events:none;max-width:calc(100vw - 32px);text-align:center
  }
  .toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
</style>
</head>
<body>

<!-- Login -->
<div id="login">
  <div class="login-card">
    <div class="login-logo">TalkPrep</div>
    <div class="login-sub">Admin panel — authorized access only</div>
    <div class="field">
      <label>Admin password</label>
      <input id="pwd" type="password" placeholder="Enter password"
             autocomplete="current-password" autocorrect="off" autocapitalize="off"/>
    </div>
    <button class="btn btn-primary" onclick="doLogin()">Sign in</button>
    <div id="login-error" class="error-msg"></div>
  </div>
</div>

<!-- Dashboard -->
<div id="dashboard">
  <div class="topbar">
    <div class="topbar-brand">TalkPrep Admin</div>
    <div class="topbar-right">
      <span class="count-badge" id="user-count-badge" style="display:none"></span>
      <button class="btn-logout" onclick="logout()">Sign out</button>
    </div>
  </div>
  <div class="main">
    <div class="page-title">Users</div>
    <div class="page-sub">Manage access and view usage across all accounts.</div>

    <div class="stats-grid">
      <div class="stat-card"><div class="stat-val" id="s-users">—</div><div class="stat-label">Users</div></div>
      <div class="stat-card"><div class="stat-val" id="s-sessions">—</div><div class="stat-label">Sessions</div></div>
      <div class="stat-card"><div class="stat-val" id="s-preps">—</div><div class="stat-label">Preps</div></div>
      <div class="stat-card"><div class="stat-val" id="s-stripe">—</div><div class="stat-label">Stripe Pro</div></div>
      <div class="stat-card"><div class="stat-val" id="s-override">—</div><div class="stat-label">Manual Pro</div></div>
    </div>

    <div class="toolbar">
      <div class="search-wrap">
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
          <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" stroke-width="1.5"/>
          <path d="M10 10l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <input class="search-box" id="search" type="search" placeholder="Search by email or user ID…"
               oninput="filterUsers()" autocorrect="off" autocapitalize="off" spellcheck="false"/>
      </div>
      <button class="refresh-btn" onclick="loadDashboard()">↻ Refresh</button>
    </div>

    <!-- Desktop table -->
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>User ID</th>
            <th>Joined</th>
            <th>Preps</th>
            <th>Sessions</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="users-tbody"><tr><td colspan="7" class="loading-row">Loading…</td></tr></tbody>
      </table>
    </div>

    <!-- Mobile cards -->
    <div class="cards-list" id="cards-list"><div class="cards-loading">Loading…</div></div>
  </div>
</div>

<div id="toast" class="toast"></div>

<script>
const BASE = '/api/admin';
let token = sessionStorage.getItem('tp_admin_token') || '';
let allUsers = [];

// ── Auth ──────────────────────────────────────────────────────────────────────

async function doLogin() {
  const btn = document.querySelector('.btn-primary');
  const pwd = document.getElementById('pwd').value.trim();
  if (!pwd) return;
  document.getElementById('login-error').textContent = '';
  btn.textContent = 'Signing in…';
  btn.disabled = true;
  try {
    const res = await fetch(BASE + '/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': pwd },
    });
    if (res.ok) {
      token = pwd;
      sessionStorage.setItem('tp_admin_token', token);
      showDashboard();
    } else {
      document.getElementById('login-error').textContent = 'Incorrect password.';
    }
  } catch {
    document.getElementById('login-error').textContent = 'Could not reach server.';
  } finally {
    btn.textContent = 'Sign in';
    btn.disabled = false;
  }
}

function logout() {
  token = '';
  sessionStorage.removeItem('tp_admin_token');
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('login').style.display = 'flex';
  document.getElementById('pwd').value = '';
}

document.getElementById('pwd').addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const res = await fetch(BASE + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'x-admin-token': token, ...(options.headers||{}) },
  });
  if (res.status === 401) { logout(); return null; }
  return res.json();
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function showDashboard() {
  document.getElementById('login').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
  loadDashboard();
}

async function loadDashboard() {
  renderLoading();
  const [stats, users] = await Promise.all([apiFetch('/stats'), apiFetch('/users')]);
  if (stats) renderStats(stats);
  if (users) {
    allUsers = users;
    const badge = document.getElementById('user-count-badge');
    badge.textContent = users.length + ' users';
    badge.style.display = '';
    filterUsers();
  }
}

function renderStats(s) {
  document.getElementById('s-users').textContent = s.totalUsers;
  document.getElementById('s-sessions').textContent = s.totalSessions;
  document.getElementById('s-preps').textContent = s.totalPreps;
  document.getElementById('s-stripe').textContent = s.stripeProUsers;
  document.getElementById('s-override').textContent = s.overrideProUsers;
}

function filterUsers() {
  const q = document.getElementById('search').value.toLowerCase();
  const filtered = q
    ? allUsers.filter(u => u.email.toLowerCase().includes(q) || u.userId.toLowerCase().includes(q))
    : allUsers;
  renderTable(filtered);
  renderCards(filtered);
}

function renderLoading() {
  document.getElementById('users-tbody').innerHTML = '<tr><td colspan="7" class="loading-row">Loading…</td></tr>';
  document.getElementById('cards-list').innerHTML = '<div class="cards-loading">Loading…</div>';
}

// ── Desktop table ─────────────────────────────────────────────────────────────

function renderTable(users) {
  const tbody = document.getElementById('users-tbody');
  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-row">No users found.</td></tr>';
    return;
  }
  tbody.innerHTML = users.map(u => {
    const joined = u.joinedAt ? new Date(u.joinedAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—';
    const {badgeClass, badgeLabel} = badge(u.proSource);
    const shortId = u.userId.length > 20 ? u.userId.slice(0,9)+'…'+u.userId.slice(-6) : u.userId;
    return \`<tr>
      <td class="email-cell" title="\${esc(u.email)}">\${esc(u.email||'—')}</td>
      <td class="id-cell" title="\${esc(u.userId)}">\${esc(shortId)}</td>
      <td>\${joined}</td>
      <td>\${u.prepsUsed}</td>
      <td>\${u.sessionCount}</td>
      <td><span class="badge \${badgeClass}">\${badgeLabel}</span></td>
      <td><div class="actions">\${actionBtns(u)}</div></td>
    </tr>\`;
  }).join('');
}

// ── Mobile cards ──────────────────────────────────────────────────────────────

function renderCards(users) {
  const list = document.getElementById('cards-list');
  if (!users.length) {
    list.innerHTML = '<div class="cards-empty">No users found.</div>';
    return;
  }
  list.innerHTML = users.map(u => {
    const joined = u.joinedAt ? new Date(u.joinedAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—';
    const {badgeClass, badgeLabel} = badge(u.proSource);
    const shortId = u.userId.length > 24 ? u.userId.slice(0,12)+'…'+u.userId.slice(-8) : u.userId;
    return \`<div class="user-card">
      <div class="card-top">
        <div class="card-email">\${esc(u.email||'—')}</div>
        <span class="badge \${badgeClass}">\${badgeLabel}</span>
      </div>
      <div class="card-id">\${esc(shortId)}</div>
      <div class="card-meta">
        <div class="card-meta-item">Joined <strong>\${joined}</strong></div>
        <div class="card-meta-item">Preps <strong>\${u.prepsUsed}</strong></div>
        <div class="card-meta-item">Sessions <strong>\${u.sessionCount}</strong></div>
      </div>
      <div class="card-actions">\${actionBtns(u)}</div>
    </div>\`;
  }).join('');
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function badge(proSource) {
  if (proSource === 'stripe')   return {badgeClass:'badge-stripe',   badgeLabel:'⚡ Stripe Pro'};
  if (proSource === 'override') return {badgeClass:'badge-override',  badgeLabel:'✓ Manual Pro'};
  return {badgeClass:'badge-free', badgeLabel:'Free'};
}

function actionBtns(u) {
  const grant = u.proSource !== 'override'
    ? \`<button class="btn btn-sm btn-grant" onclick="grantPro('\${u.userId}')">Grant Pro</button>\`
    : \`<button class="btn btn-sm btn-revoke" onclick="revokePro('\${u.userId}')">Revoke Pro</button>\`;
  const reset = u.prepsUsed > 0
    ? \`<button class="btn btn-sm btn-reset" onclick="resetPreps('\${u.userId}')">Reset Preps</button>\`
    : '';
  return grant + reset;
}

// ── Actions ───────────────────────────────────────────────────────────────────

async function grantPro(userId) {
  const res = await apiFetch('/users/' + encodeURIComponent(userId) + '/grant', {
    method:'POST', body:JSON.stringify({note:'Admin grant'}),
  });
  if (res?.ok) { toast('Pro access granted ✓'); loadDashboard(); }
  else toast('Error granting access', true);
}

async function revokePro(userId) {
  if (!confirm('Revoke manual Pro access for this user?')) return;
  const res = await apiFetch('/users/' + encodeURIComponent(userId) + '/grant', { method:'DELETE' });
  if (res?.ok) { toast('Pro access revoked'); loadDashboard(); }
  else toast('Error revoking access', true);
}

async function resetPreps(userId) {
  if (!confirm('Reset prep count? This lets the user generate one more free prep.')) return;
  const res = await apiFetch('/users/' + encodeURIComponent(userId) + '/reset-preps', { method:'POST' });
  if (res?.ok) { toast('Prep count reset ✓'); loadDashboard(); }
  else toast('Error resetting preps', true);
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

let toastTimer;
function toast(msg, isError = false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.background = isError ? 'var(--red)' : 'var(--ink)';
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

// ── Boot ──────────────────────────────────────────────────────────────────────

if (token) {
  apiFetch('/verify', { method:'POST' }).then(data => {
    if (data?.ok) showDashboard();
    else { token = ''; sessionStorage.removeItem('tp_admin_token'); }
  }).catch(() => {});
}
</script>
</body>
</html>`;
