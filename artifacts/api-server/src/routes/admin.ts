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
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>TalkPrep Admin</title>
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  :root{
    --cream:#f9f5ef;--rust:#c4622d;--rust-dark:#a34f22;--rust-light:#f0ddd0;
    --sage:#5c7a6a;--ink:#1c1814;--ink2:#3d3530;--ink3:#6b5f58;
    --ink4:#a89e98;--white:#ffffff;--red:#d93025;--green:#2e7d32;
    --radius:10px;--shadow:0 2px 12px rgba(28,24,20,.10);
  }
  body{font-family:'Inter',system-ui,sans-serif;background:var(--cream);color:var(--ink);min-height:100vh}
  a{color:var(--rust);text-decoration:none}

  /* ── Login ── */
  #login{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
  .login-card{background:var(--white);border-radius:16px;padding:48px 40px;width:100%;max-width:400px;box-shadow:var(--shadow)}
  .login-logo{font-size:22px;font-weight:700;color:var(--rust);letter-spacing:-.5px;margin-bottom:8px}
  .login-sub{font-size:14px;color:var(--ink3);margin-bottom:32px}
  .field label{display:block;font-size:12px;font-weight:600;color:var(--ink3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}
  .field input{width:100%;padding:12px 14px;border:1.5px solid #e0d8d2;border-radius:var(--radius);font-size:15px;outline:none;transition:border-color .15s}
  .field input:focus{border-color:var(--rust)}
  .btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:11px 20px;border-radius:var(--radius);font-size:14px;font-weight:600;cursor:pointer;border:none;transition:all .15s}
  .btn-primary{background:var(--rust);color:var(--white);width:100%;margin-top:20px}
  .btn-primary:hover{background:var(--rust-dark)}
  .btn-sm{padding:6px 12px;font-size:12px;border-radius:6px}
  .btn-grant{background:var(--sage);color:var(--white)}
  .btn-grant:hover{opacity:.85}
  .btn-revoke{background:var(--rust-light);color:var(--rust-dark)}
  .btn-revoke:hover{background:#e8ccbc}
  .btn-reset{background:#f0ede8;color:var(--ink3);border:1px solid #ddd5cd}
  .btn-reset:hover{background:#e8e1d8}
  .error-msg{color:var(--red);font-size:13px;margin-top:12px;text-align:center}

  /* ── Dashboard ── */
  #dashboard{display:none}
  .topbar{background:var(--white);border-bottom:1px solid #e8e0d8;padding:0 28px;height:56px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:10}
  .topbar-brand{font-size:16px;font-weight:700;color:var(--rust)}
  .topbar-right{display:flex;align-items:center;gap:16px}
  .topbar-right span{font-size:13px;color:var(--ink3)}
  .btn-logout{background:none;border:1px solid #ddd5cd;color:var(--ink3);padding:6px 14px;font-size:13px;border-radius:6px;cursor:pointer}
  .btn-logout:hover{background:#f0ede8}

  .main{padding:28px;max-width:1200px;margin:0 auto}
  .page-title{font-size:24px;font-weight:700;color:var(--ink);margin-bottom:4px}
  .page-sub{font-size:14px;color:var(--ink3);margin-bottom:28px}

  /* ── Stats ── */
  .stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin-bottom:32px}
  .stat-card{background:var(--white);border-radius:var(--radius);padding:20px;box-shadow:var(--shadow)}
  .stat-val{font-size:32px;font-weight:700;color:var(--ink);line-height:1}
  .stat-label{font-size:12px;color:var(--ink3);text-transform:uppercase;letter-spacing:.5px;margin-top:6px}

  /* ── Users table ── */
  .table-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;gap:12px;flex-wrap:wrap}
  .search-box{padding:9px 14px;border:1.5px solid #e0d8d2;border-radius:var(--radius);font-size:14px;outline:none;width:260px;transition:border-color .15s}
  .search-box:focus{border-color:var(--rust)}
  .refresh-btn{background:none;border:1.5px solid #e0d8d2;color:var(--ink3);padding:8px 16px;border-radius:var(--radius);font-size:13px;cursor:pointer;font-weight:500}
  .refresh-btn:hover{background:#f0ede8}
  .table-wrap{background:var(--white);border-radius:var(--radius);box-shadow:var(--shadow);overflow-x:auto}
  table{width:100%;border-collapse:collapse;font-size:13px}
  thead th{background:#faf7f4;padding:11px 14px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--ink3);border-bottom:1px solid #ede8e2;white-space:nowrap}
  tbody tr{border-bottom:1px solid #f0ede8;transition:background .1s}
  tbody tr:last-child{border-bottom:none}
  tbody tr:hover{background:#fdf9f6}
  td{padding:12px 14px;vertical-align:middle}
  .email-cell{font-weight:500;color:var(--ink)}
  .id-cell{font-family:monospace;font-size:11px;color:var(--ink4)}
  .badge{display:inline-flex;align-items:center;padding:3px 9px;border-radius:20px;font-size:11px;font-weight:600}
  .badge-stripe{background:#e8f0fe;color:#1a56db}
  .badge-override{background:#e6f4ea;color:var(--green)}
  .badge-free{background:#f5f5f5;color:var(--ink3)}
  .actions{display:flex;gap:6px;flex-wrap:wrap}
  .loading{text-align:center;padding:48px;color:var(--ink4);font-size:14px}
  .empty{text-align:center;padding:48px;color:var(--ink4);font-size:14px}
  .toast{position:fixed;bottom:24px;right:24px;background:var(--ink);color:var(--white);padding:12px 20px;border-radius:var(--radius);font-size:13px;font-weight:500;z-index:100;opacity:0;transform:translateY(8px);transition:all .2s}
  .toast.show{opacity:1;transform:translateY(0)}
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
      <input id="pwd" type="password" placeholder="Enter password" autocomplete="current-password"/>
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
      <span id="user-count-badge"></span>
      <button class="btn-logout" onclick="logout()">Sign out</button>
    </div>
  </div>
  <div class="main">
    <div class="page-title">Users</div>
    <div class="page-sub">Manage access and view usage across all accounts.</div>

    <div class="stats-grid" id="stats-grid">
      <div class="stat-card"><div class="stat-val" id="s-users">—</div><div class="stat-label">Total Users</div></div>
      <div class="stat-card"><div class="stat-val" id="s-sessions">—</div><div class="stat-label">Total Sessions</div></div>
      <div class="stat-card"><div class="stat-val" id="s-preps">—</div><div class="stat-label">Preps Generated</div></div>
      <div class="stat-card"><div class="stat-val" id="s-stripe">—</div><div class="stat-label">Stripe Pro</div></div>
      <div class="stat-card"><div class="stat-val" id="s-override">—</div><div class="stat-label">Manual Pro</div></div>
    </div>

    <div class="table-header">
      <input class="search-box" id="search" type="text" placeholder="Search by email or user ID…" oninput="filterUsers()"/>
      <button class="refresh-btn" onclick="loadDashboard()">↻ Refresh</button>
    </div>
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
        <tbody id="users-tbody"><tr><td colspan="7" class="loading">Loading…</td></tr></tbody>
      </table>
    </div>
  </div>
</div>

<div id="toast" class="toast"></div>

<script>
const BASE = '/api/admin';
let token = sessionStorage.getItem('tp_admin_token') || '';
let allUsers = [];

// ── Auth ──────────────────────────────────────────────────────────────────────

async function doLogin() {
  const pwd = document.getElementById('pwd').value.trim();
  if (!pwd) return;
  document.getElementById('login-error').textContent = '';
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
  }
}

function logout() {
  token = '';
  sessionStorage.removeItem('tp_admin_token');
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('login').style.display = 'flex';
  document.getElementById('pwd').value = '';
}

document.getElementById('pwd').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doLogin();
});

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const res = await fetch(BASE + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': token,
      ...(options.headers || {}),
    },
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
  const [stats, users] = await Promise.all([
    apiFetch('/stats'),
    apiFetch('/users'),
  ]);
  if (stats) renderStats(stats);
  if (users) {
    allUsers = users;
    document.getElementById('user-count-badge').textContent = users.length + ' users';
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
    ? allUsers.filter(u =>
        u.email.toLowerCase().includes(q) ||
        u.userId.toLowerCase().includes(q)
      )
    : allUsers;
  renderUsers(filtered);
}

function renderLoading() {
  document.getElementById('users-tbody').innerHTML =
    '<tr><td colspan="7" class="loading">Loading…</td></tr>';
}

function renderUsers(users) {
  const tbody = document.getElementById('users-tbody');
  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty">No users found.</td></tr>';
    return;
  }
  tbody.innerHTML = users.map(u => {
    const joined = u.joinedAt
      ? new Date(u.joinedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '—';
    const badgeClass = u.proSource === 'stripe' ? 'badge-stripe'
                     : u.proSource === 'override' ? 'badge-override'
                     : 'badge-free';
    const badgeLabel = u.proSource === 'stripe' ? '⚡ Stripe Pro'
                     : u.proSource === 'override' ? '✓ Manual Pro'
                     : 'Free';
    const shortId = u.userId.length > 18
      ? u.userId.slice(0, 8) + '…' + u.userId.slice(-6)
      : u.userId;

    const grantBtn = u.proSource !== 'override'
      ? \`<button class="btn btn-sm btn-grant" onclick="grantPro('\${u.userId}')">Grant Pro</button>\`
      : \`<button class="btn btn-sm btn-revoke" onclick="revokePro('\${u.userId}')">Revoke</button>\`;

    const resetBtn = u.prepsUsed > 0
      ? \`<button class="btn btn-sm btn-reset" onclick="resetPreps('\${u.userId}')">Reset Preps</button>\`
      : '';

    return \`<tr>
      <td class="email-cell">\${escHtml(u.email || '—')}</td>
      <td class="id-cell" title="\${escHtml(u.userId)}">\${escHtml(shortId)}</td>
      <td>\${joined}</td>
      <td>\${u.prepsUsed}</td>
      <td>\${u.sessionCount}</td>
      <td><span class="badge \${badgeClass}">\${badgeLabel}</span></td>
      <td><div class="actions">\${grantBtn}\${resetBtn}</div></td>
    </tr>\`;
  }).join('');
}

// ── Actions ───────────────────────────────────────────────────────────────────

async function grantPro(userId) {
  const res = await apiFetch('/users/' + encodeURIComponent(userId) + '/grant', {
    method: 'POST', body: JSON.stringify({ note: 'Admin grant' }),
  });
  if (res?.ok) { toast('Pro access granted ✓'); loadDashboard(); }
  else toast('Error granting access', true);
}

async function revokePro(userId) {
  if (!confirm('Revoke manual Pro access for this user?')) return;
  const res = await apiFetch('/users/' + encodeURIComponent(userId) + '/grant', {
    method: 'DELETE',
  });
  if (res?.ok) { toast('Pro access revoked'); loadDashboard(); }
  else toast('Error revoking access', true);
}

async function resetPreps(userId) {
  if (!confirm('Reset prep count? This lets the user generate one more free prep.')) return;
  const res = await apiFetch('/users/' + encodeURIComponent(userId) + '/reset-preps', {
    method: 'POST',
  });
  if (res?.ok) { toast('Prep count reset ✓'); loadDashboard(); }
  else toast('Error resetting preps', true);
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

let toastTimer;
function toast(msg, isError = false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.background = isError ? '#c0392b' : '#1c1814';
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

// ── Boot ──────────────────────────────────────────────────────────────────────

if (token) {
  apiFetch('/verify', { method: 'POST' }).then(data => {
    if (data?.ok) showDashboard();
    else { token = ''; sessionStorage.removeItem('tp_admin_token'); }
  }).catch(() => {});
}
</script>
</body>
</html>`;
