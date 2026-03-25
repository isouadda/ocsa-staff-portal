import { useState, useEffect, useCallback, useRef } from "react";

const API = process.env.REACT_APP_API_URL || "https://ocsa-api-production.up.railway.app";
const SUPA_URL = "https://gcgswxyxkbummtgzgusk.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjZ3N3eHl4a2J1bW10Z3pndXNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NjY0NTcsImV4cCI6MjA5MDA0MjQ1N30.Vbe7ueRmQ6MPZX2sqa0XHIlJD22_J7sDJ65OoQ50LaM";

async function uploadPhoto(file) {
  const fileName = "issue-" + Date.now() + "-" + Math.random().toString(36).substring(2, 8) + "." + file.name.split(".").pop();
  const res = await fetch(SUPA_URL + "/storage/v1/object/issue-photos/" + fileName, {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + SUPA_KEY,
      "apikey": SUPA_KEY,
      "Content-Type": file.type,
    },
    body: file,
  });
  if (!res.ok) throw new Error("Photo upload failed");
  return SUPA_URL + "/storage/v1/object/public/issue-photos/" + fileName;
}
const NAVY = "#0A1628";
const NAVY_MID = "#132240";
const NAVY_LIGHT = "#1B3058";
const GOLD = "#C8A84E";
const GOLD_LIGHT = "#E8D08E";
const GOLD_DIM = "rgba(200, 168, 78, 0.12)";
const WHITE = "#F8F7F4";
const GREEN = "#2ECC71";
const RED = "#E74C3C";
const ORANGE = "#F39C12";
const BLUE = "#3498DB";
const GRAY = "#8899AA";
const GRAY_LIGHT = "#A8B8C8";

async function api(path, opts = {}) {
  const headers = { "Content-Type": "application/json", ...opts.headers };
  if (opts.token) headers["Authorization"] = "Bearer " + opts.token;
  const res = await fetch(API + path, { ...opts, headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}




const formatTime = (d) => new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
const formatDate = (d) => new Date(d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
const now = () => new Date();

const Ico = ({ d, sz = 18, c = "currentColor", style: s, ...p }) => (
  <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s} {...p}><path d={d} /></svg>
);
const ClockIco = (p) => <Ico d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 0v10l4 4" {...p} />;
const CheckIco = (p) => <Ico d="M20 6L9 17l-5-5" {...p} />;
const AlertIco = (p) => <Ico d="M12 2L2 22h20L12 2zm0 7v5m0 3h.01" {...p} />;
const BoxIco = (p) => <Ico d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" {...p} />;
const MapIco = (p) => <Ico d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" {...p} />;
const CamIco = (p) => <Ico d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z" {...p} />;
const UserIco = (p) => <Ico d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" {...p} />;
const ChatIco = (p) => <Ico d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" {...p} />;
const SendIco = (p) => <Ico d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" {...p} />;
const LogOutIco = (p) => <Ico d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" {...p} />;
const MinusIco = (p) => <Ico d="M5 12h14" {...p} />;
const PlusIco = (p) => <Ico d="M12 5v14M5 12h14" {...p} />;
const ChevIco = (p) => <Ico d="M9 18l6-6-6-6" {...p} />;
const LockIco = ({ sz = 12, c = BLUE }) => (
  <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

export default function OCSAStaffPortal() {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [sites, setSites] = useState([]);
  const [screen, setScreen] = useState("login");
  const [activeTab, setActiveTab] = useState("clock");
  const [clockStatus, setClockStatus] = useState(null);
  const [selectedSite, setSelectedSite] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [completedTaskIds, setCompletedTaskIds] = useState(new Set());
  const [issues, setIssues] = useState([]);
  const [issueTasks, setIssueTasks] = useState([]);
  const [supplies, setSupplies] = useState([]);
  const [supplyLogs, setSupplyLogs] = useState([]);
  const [channels, setChannels] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [currentTime, setCurrentTime] = useState(now());
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const i = setInterval(() => setCurrentTime(now()), 1000);
    return () => clearInterval(i);
  }, []);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleLogin = async (phone, pin) => {
    setLoading(true);
    try {
      const data = await api("/api/auth/login", { method: "POST", body: { phone, pin } });
      setToken(data.token);
      const me = await api("/api/auth/me", { token: data.token });
      setUser(me.user);
      setSites(me.sites);
      const cs = await api("/api/clock/status", { token: data.token });
      setClockStatus(cs);
      if (cs.clockedIn) setSelectedSite(cs.shift.siteId);
      setScreen("main");
      showToast("Welcome, " + me.user.firstName);
    } catch (err) {
      showToast(err.message, "error");
    }
    setLoading(false);
  };

  const handleRegister = async (firstName, lastName, phone, email, pin) => {
    setLoading(true);
    try {
      await api("/api/auth/register", { method: "POST", body: { firstName, lastName, phone, email, pin } });
      showToast("Registration submitted. Pending supervisor approval.");
      setScreen("login");
    } catch (err) {
      showToast(err.message, "error");
    }
    setLoading(false);
  };

  const handleLogout = () => {
    if (clockStatus?.clockedIn) { showToast("Clock out before logging out", "error"); return; }
    setToken(null); setUser(null); setSites([]); setScreen("login");
    setClockStatus(null); setSelectedSite(null); setTasks([]); setCompletedTaskIds(new Set());
    setActiveTab("clock");
  };

  const handleClockIn = async () => {
    if (!selectedSite) { showToast("Select a site first", "error"); return; }
    setLoading(true);
    try {
      await api("/api/clock/in", { method: "POST", body: { siteId: selectedSite }, token });
      const cs = await api("/api/clock/status", { token });
      setClockStatus(cs);
      showToast("Clocked in at " + formatTime(now()));
    } catch (err) { showToast(err.message, "error"); }
    setLoading(false);
  };

  const handleClockOut = async () => {
    setLoading(true);
    try {
      const data = await api("/api/clock/out", { method: "POST", body: {}, token });
      setClockStatus({ clockedIn: false, shift: null, tasks: { total: 0, completed: 0 } });
      setTasks([]); setCompletedTaskIds(new Set()); setSelectedSite(null);
      showToast("Clocked out. Duration: " + data.shiftRecord.duration_minutes + " minutes");
    } catch (err) { showToast(err.message, "error"); }
    setLoading(false);
  };

  const loadTasks = async () => {
    if (!clockStatus?.clockedIn || !clockStatus?.shift?.siteId) return;
    try {
      const t = await api("/api/sites/" + clockStatus.shift.siteId + "/tasks?user_id=" + user.id, { token });
      setTasks(t);
      const cs = await api("/api/clock/status", { token });
      setClockStatus(cs);
    } catch (err) { console.error(err); }
  };

  const toggleTask = async (taskId) => {
    try {
      if (completedTaskIds.has(taskId)) {
        await api("/api/clock/tasks/" + taskId + "/complete", { method: "DELETE", token });
        setCompletedTaskIds(prev => { const n = new Set(prev); n.delete(taskId); return n; });
      } else {
        await api("/api/clock/tasks/" + taskId + "/complete", { method: "POST", body: {}, token });
        setCompletedTaskIds(prev => new Set(prev).add(taskId));
        showToast("Task completed");
      }
      const cs = await api("/api/clock/status", { token });
      setClockStatus(cs);
    } catch (err) { showToast(err.message, "error"); }
  };

  const loadIssues = async () => {
    try { const data = await api("/api/issues?limit=20", { token }); setIssues(data); } catch (err) { console.error(err); }
  };

  const loadIssueTasks = async () => {
    try { const data = await api("/api/issues/my-tasks", { token }); setIssueTasks(data); } catch (err) { console.error(err); }
  };

  const resolveIssueTask = async (taskId, status, note) => {
    try {
      await api("/api/issues/tasks/" + taskId + "/resolve", { method: "PATCH", body: { resolutionStatus: status, resolutionNote: note || undefined }, token });
      showToast("Task updated to " + status.replace(/_/g, " "));
      loadIssueTasks();
    } catch (err) { showToast(err.message, "error"); }
  };

  const submitIssue = async (title, description, zone, severity, photoUrl) => {
    try {
      const data = await api("/api/issues", { method: "POST", body: { siteId: clockStatus.shift.siteId, title, description, zone, severity }, token });
      if (photoUrl && data.issue) {
        await api("/api/issues/" + data.issue.id + "/photos", { method: "POST", body: { photoUrl }, token });
      }
      showToast("Issue reported");
      loadIssues();
    } catch (err) { showToast(err.message, "error"); }
  };

  const loadSupplies = async () => {
    if (!clockStatus?.shift?.siteId) return;
    try {
      const data = await api("/api/supplies?site_id=" + clockStatus.shift.siteId, { token });
      setSupplies(data);
    } catch (err) { console.error(err); }
  };

  const logSupplyUsage = async (supplyId, quantity) => {
    try {
      const data = await api("/api/supplies/log-usage", { method: "POST", body: { supplyId, quantity, siteId: clockStatus.shift.siteId, scanMethod: "manual" }, token });
      showToast(data.message);
      setSupplyLogs(prev => [{ ...data.log, loggedAt: now().toISOString() }, ...prev]);
      if (data.lowStockAlert) showToast("Low stock alert!", "error");
    } catch (err) { showToast(err.message, "error"); }
  };

  const submitSupplyRequest = async (requestType, itemName, description, urgency, supplyId) => {
    try {
      const siteId = clockStatus?.shift?.siteId || null;
      await api("/api/supplies/requests", { method: "POST", body: { requestType, itemName, description, urgency, supplyId, siteId }, token });
      showToast("Request submitted");
    } catch (err) { showToast(err.message, "error"); }
  };

  const loadChannels = async () => {
    try { const data = await api("/api/chat/channels", { token }); setChannels(data); } catch (err) { console.error(err); }
  };

  const loadMessages = async (channelId) => {
    try { const data = await api("/api/chat/channels/" + channelId + "/messages", { token }); setMessages(data); } catch (err) { console.error(err); }
  };

  const sendMessage = async (channelId, text) => {
    try {
      const data = await api("/api/chat/channels/" + channelId + "/messages", { method: "POST", body: { text }, token });
      setMessages(prev => [...prev, data.message]);
    } catch (err) { showToast(err.message, "error"); }
  };

  useEffect(() => {
    if (activeTab === "tasks" && clockStatus?.clockedIn) loadTasks();
    if (activeTab === "issues" && clockStatus?.clockedIn) loadIssues();
    if (activeTab === "issuetasks") loadIssueTasks();
    if (activeTab === "supplies" && clockStatus?.clockedIn) loadSupplies();
    if (activeTab === "chat") loadChannels();
  }, [activeTab, clockStatus?.clockedIn]);

  useEffect(() => {
    if (activeChannel) loadMessages(activeChannel);
  }, [activeChannel]);

  const WrkIco = (p) => <Ico d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" {...p} />;

  const tabs = [
    { id: "clock", label: "Clock", icon: ClockIco },
    { id: "tasks", label: "Tasks", icon: CheckIco },
    { id: "issuetasks", label: "Assigned", icon: WrkIco },
    { id: "chat", label: "Chat", icon: ChatIco },
    { id: "issues", label: "Issues", icon: AlertIco },
    { id: "supplies", label: "Supplies", icon: BoxIco },
  ];

  return (
    <div style={{ width: "100%", maxWidth: 430, margin: "0 auto", minHeight: "100vh", background: NAVY, fontFamily: "'DM Sans','Segoe UI',sans-serif", color: WHITE, position: "relative" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet" />

      {screen === "login" && <LoginScreen onLogin={handleLogin} onGoRegister={() => setScreen("register")} loading={loading} showToast={showToast} />}
      {screen === "register" && <RegisterScreen onRegister={handleRegister} onBack={() => setScreen("login")} loading={loading} />}
      {screen === "main" && (
        <>
          <div style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_MID} 100%)`, padding: "14px 16px 10px", borderBottom: `1px solid ${NAVY_LIGHT}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: GOLD_DIM, border: `1.5px solid ${GOLD}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: GOLD }}>
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{user?.firstName} {user?.lastName}</div>
                  <div style={{ fontSize: 10, color: GOLD }}>{user?.role?.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {clockStatus?.clockedIn && (
                  <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(46,204,113,0.15)", padding: "3px 8px", borderRadius: 20, fontSize: 10, color: GREEN, fontWeight: 600 }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: GREEN, animation: "pulse 2s infinite" }} />ON SITE
                  </div>
                )}
                <button onClick={handleLogout} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><LogOutIco sz={18} c={GRAY} /></button>
              </div>
            </div>
          </div>

          <div style={{ padding: "0 0 80px 0", minHeight: "calc(100vh - 130px)" }}>
            {activeTab === "clock" && <ClockView clockStatus={clockStatus} currentTime={currentTime} selectedSite={selectedSite} setSelectedSite={setSelectedSite} onClockIn={handleClockIn} onClockOut={handleClockOut} sites={sites} loading={loading} />}
            {activeTab === "tasks" && <TasksView clockStatus={clockStatus} tasks={tasks} completedTaskIds={completedTaskIds} toggleTask={toggleTask} />}
            {activeTab === "issuetasks" && <IssueTasksView issueTasks={issueTasks} resolveIssueTask={resolveIssueTask} showToast={showToast} />}
            {activeTab === "chat" && <ChatView channels={channels} messages={messages} activeChannel={activeChannel} setActiveChannel={setActiveChannel} sendMessage={sendMessage} user={user} />}
            {activeTab === "issues" && <IssuesView clockStatus={clockStatus} issues={issues} submitIssue={submitIssue} showToast={showToast} />}
            {activeTab === "supplies" && <SuppliesView clockStatus={clockStatus} supplies={supplies} supplyLogs={supplyLogs} logSupplyUsage={logSupplyUsage} submitRequest={submitSupplyRequest} showToast={showToast} />}
          </div>

          <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: NAVY_MID, borderTop: `1px solid ${NAVY_LIGHT}`, display: "flex", padding: "6px 0 10px", zIndex: 100 }}>
            {tabs.map(tab => {
              const active = activeTab === tab.id;
              const TabIco = tab.icon;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "none", border: "none", cursor: "pointer", padding: "4px 0", position: "relative" }}>
                  <TabIco sz={18} c={active ? GOLD : GRAY} />
                  <span style={{ fontSize: 9, fontWeight: active ? 700 : 500, color: active ? GOLD : GRAY, letterSpacing: "0.5px", textTransform: "uppercase" }}>{tab.label}</span>
                  {active && <div style={{ position: "absolute", top: -1, width: 20, height: 2, background: GOLD, borderRadius: 1 }} />}
                </button>
              );
            })}
          </div>
        </>
      )}

      {toast && (
        <div style={{ position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)", background: toast.type === "error" ? RED : GREEN, color: WHITE, padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, zIndex: 1000, boxShadow: "0 4px 20px rgba(0,0,0,0.4)", maxWidth: "90%", textAlign: "center" }}>{toast.msg}</div>
      )}

      <style>{`
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }
        * { box-sizing: border-box; }
        input::placeholder, textarea::placeholder { color: ${GRAY}; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: ${NAVY_LIGHT}; border-radius: 2px; }
      `}</style>
    </div>
  );
}

// ============================================================
// LOGIN
// ============================================================
function LoginScreen({ onLogin, onGoRegister, loading, showToast }) {
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");

  const demos = [
    { name: "Marcus Williams", role: "Custodial Lead", phone: "215-555-0101", pin: "1234" },
    { name: "Tamika Johnson", role: "Custodial Laborer", phone: "215-555-0102", pin: "2345" },
    { name: "David Chen", role: "Day Porter", phone: "215-555-0103", pin: "3456" },
    { name: "Aisha Brown", role: "Custodial Laborer", phone: "215-555-0104", pin: "4567" },
  ];

  return (
    <div style={{ padding: "0 24px", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 36, fontWeight: 700, color: GOLD }}>OCSA</div>
        <div style={{ fontSize: 12, color: GRAY_LIGHT, letterSpacing: "3px", textTransform: "uppercase", marginTop: 4 }}>Cleaning Inc.</div>
        <div style={{ fontSize: 11, color: GRAY, marginTop: 16, letterSpacing: "1px", textTransform: "uppercase" }}>Staff Operations Portal</div>
        <div style={{ fontSize: 10, color: GREEN, marginTop: 8 }}>Connected to Live API</div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelSt}>Phone Number or Email</label>
        <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="2155550101 or name@email.com" style={inputSt} onKeyDown={e => e.key === "Enter" && onLogin(phone, pin)} />
      </div>
      <div style={{ marginBottom: 24 }}>
        <label style={labelSt}>PIN</label>
        <input value={pin} onChange={e => setPin(e.target.value)} placeholder="4-digit PIN" type="password" maxLength={4} style={{ ...inputSt, letterSpacing: "8px", textAlign: "center", fontSize: 20 }} onKeyDown={e => e.key === "Enter" && onLogin(phone, pin)} />
      </div>

      <button onClick={() => onLogin(phone, pin)} disabled={loading} style={{ width: "100%", padding: "14px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`, color: NAVY, fontSize: 15, fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: "1px", opacity: loading ? 0.6 : 1 }}>
        {loading ? "Signing in..." : "Sign In"}
      </button>

      <button onClick={onGoRegister} style={{ width: "100%", padding: "12px", marginTop: 12, borderRadius: 10, border: `1px solid ${NAVY_LIGHT}`, background: "transparent", color: GRAY_LIGHT, fontSize: 13, cursor: "pointer" }}>
        New Employee? Register Here
      </button>

      <div style={{ marginTop: 32, padding: "14px", borderRadius: 10, background: "rgba(200,168,78,0.06)", border: `1px solid rgba(200,168,78,0.15)` }}>
        <div style={{ fontSize: 10, color: GOLD, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8, fontWeight: 600 }}>Demo Accounts (Live Data)</div>
        {demos.map(d => (
          <button key={d.phone} onClick={() => { setPhone(d.phone); setPin(d.pin); }} style={{ display: "flex", justifyContent: "space-between", width: "100%", padding: "6px 0", background: "none", border: "none", cursor: "pointer", color: WHITE, textAlign: "left" }}>
            <div><span style={{ fontSize: 12, fontWeight: 600 }}>{d.name}</span><span style={{ fontSize: 10, color: GRAY, marginLeft: 8 }}>{d.role}</span></div>
            <span style={{ fontSize: 10, color: GRAY, fontFamily: "monospace" }}>PIN: {d.pin}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// REGISTER
// ============================================================
function RegisterScreen({ onRegister, onBack, loading }) {
  const [fn, setFn] = useState(""); const [ln, setLn] = useState("");
  const [ph, setPh] = useState(""); const [em, setEm] = useState("");
  const [pin, setPin] = useState(""); const [pin2, setPin2] = useState("");
  return (
    <div style={{ padding: "0 24px", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, fontWeight: 700, color: GOLD }}>OCSA</div>
        <div style={{ fontSize: 12, color: GRAY_LIGHT, letterSpacing: "2px", textTransform: "uppercase", marginTop: 4 }}>New Staff Registration</div>
      </div>
      <div style={{ marginBottom: 14 }}><label style={labelSt}>First Name *</label><input value={fn} onChange={e => setFn(e.target.value)} placeholder="First name" style={inputSt} /></div>
      <div style={{ marginBottom: 14 }}><label style={labelSt}>Last Name</label><input value={ln} onChange={e => setLn(e.target.value)} placeholder="Last name" style={inputSt} /></div>
      <div style={{ marginBottom: 14 }}><label style={labelSt}>Phone Number *</label><input value={ph} onChange={e => setPh(e.target.value)} placeholder="2155550000 (no dashes needed)" style={inputSt} /></div>
      <div style={{ marginBottom: 14 }}><label style={labelSt}>Email Address *</label><input value={em} onChange={e => setEm(e.target.value)} placeholder="name@email.com" type="email" style={inputSt} /></div>
      <div style={{ marginBottom: 14 }}><label style={labelSt}>PIN (4 digits) *</label><input value={pin} onChange={e => setPin(e.target.value)} type="password" maxLength={4} style={{ ...inputSt, letterSpacing: "8px", textAlign: "center", fontSize: 20 }} /></div>
      <div style={{ marginBottom: 24 }}><label style={labelSt}>Confirm PIN *</label><input value={pin2} onChange={e => setPin2(e.target.value)} type="password" maxLength={4} style={{ ...inputSt, letterSpacing: "8px", textAlign: "center", fontSize: 20 }} /></div>
      <button onClick={() => { if (pin !== pin2) return; onRegister(fn, ln, ph, em, pin); }} disabled={loading} style={{ width: "100%", padding: "14px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`, color: NAVY, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>{loading ? "Registering..." : "Register"}</button>
      <button onClick={onBack} style={{ width: "100%", padding: "12px", marginTop: 12, borderRadius: 10, border: `1px solid ${NAVY_LIGHT}`, background: "transparent", color: GRAY_LIGHT, fontSize: 13, cursor: "pointer" }}>Back to Login</button>
    </div>
  );
}

// ============================================================
// CLOCK VIEW
// ============================================================
function ClockView({ clockStatus, currentTime, selectedSite, setSelectedSite, onClockIn, onClockOut, sites, loading }) {
  const ci = clockStatus?.clockedIn;
  const elapsed = ci && clockStatus.shift ? Math.floor((currentTime - new Date(clockStatus.shift.clockInTime)) / 1000) : 0;
  const h = Math.floor(elapsed / 3600), m = Math.floor((elapsed % 3600) / 60), s = elapsed % 60;
  const pad = (n) => String(n).padStart(2, "0");
  const t = clockStatus?.tasks || { total: 0, completed: 0 };
  const pct = t.total > 0 ? Math.round((t.completed / t.total) * 100) : 0;

  return (
    <div style={{ padding: "16px" }}>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: GRAY_LIGHT, marginBottom: 3 }}>{formatDate(currentTime)}</div>
        <div style={{ fontSize: 42, fontWeight: 700, color: WHITE, letterSpacing: "-1px" }}>{formatTime(currentTime)}</div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ ...labelSt, display: "block", marginBottom: 8 }}>Your Assigned Sites</label>
        {sites.length === 0 && <div style={{ padding: 20, textAlign: "center", background: "rgba(255,255,255,0.02)", borderRadius: 10, border: `1px solid ${NAVY_LIGHT}`, fontSize: 13, color: GRAY }}>No sites assigned yet.</div>}
        {sites.map(site => (
          <button key={site.siteId} onClick={() => !ci && setSelectedSite(site.siteId)} style={{
            width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", marginBottom: 8,
            background: selectedSite === site.siteId ? GOLD_DIM : "rgba(255,255,255,0.03)",
            border: selectedSite === site.siteId ? `1.5px solid ${GOLD}` : `1px solid ${NAVY_LIGHT}`,
            borderRadius: 10, cursor: ci ? "default" : "pointer", color: WHITE, textAlign: "left",
            opacity: ci && selectedSite !== site.siteId ? 0.3 : 1,
          }}>
            <MapIco sz={18} c={selectedSite === site.siteId ? GOLD : GRAY} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{site.siteName}</div>
              <div style={{ fontSize: 10, color: GRAY_LIGHT, marginTop: 2 }}>{site.address}, {site.city}</div>
              {site.shiftName && <div style={{ fontSize: 10, color: GOLD, marginTop: 3 }}>{site.roleAtSite} | {site.shiftName} shift</div>}
            </div>
          </button>
        ))}
      </div>

      {ci && clockStatus.shift && (
        <div style={{ textAlign: "center", padding: "18px", marginBottom: 16, background: NAVY_MID, borderRadius: 12, border: `1px solid ${NAVY_LIGHT}` }}>
          <div style={{ fontSize: 10, color: GOLD, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 6 }}>Time on Site</div>
          <div style={{ fontSize: 38, fontWeight: 700, fontFamily: "'DM Sans',monospace", letterSpacing: "2px" }}>{pad(h)}:{pad(m)}:{pad(s)}</div>
          <div style={{ fontSize: 11, color: GRAY_LIGHT, marginTop: 6 }}>Clocked in at {formatTime(clockStatus.shift.clockInTime)}</div>
          <div style={{ fontSize: 12, color: GRAY_LIGHT, marginTop: 4 }}>{clockStatus.shift.siteName}</div>
          {t.total > 0 && (
            <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <div style={{ flex: 1, maxWidth: 180, height: 5, borderRadius: 3, background: NAVY_LIGHT, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 3, background: pct === 100 ? GREEN : `linear-gradient(90deg,${GOLD},${GOLD_LIGHT})`, width: `${pct}%`, transition: "width 0.3s ease" }} />
              </div>
              <span style={{ fontSize: 11, color: GOLD, fontWeight: 600 }}>{t.completed}/{t.total}</span>
            </div>
          )}
        </div>
      )}

      <button onClick={ci ? onClockOut : onClockIn} disabled={loading} style={{
        width: "100%", padding: "15px", borderRadius: 12, border: "none",
        background: ci ? `linear-gradient(135deg,${RED},#C0392B)` : `linear-gradient(135deg,${GOLD},${GOLD_LIGHT})`,
        color: ci ? WHITE : NAVY, fontSize: 15, fontWeight: 700, cursor: "pointer", textTransform: "uppercase",
        opacity: loading ? 0.6 : 1,
      }}>
        {loading ? "..." : ci ? "Clock Out" : "Clock In"}
      </button>
    </div>
  );
}

// ============================================================
// TASKS VIEW
// ============================================================
function TasksView({ clockStatus, tasks, completedTaskIds, toggleTask }) {
  if (!clockStatus?.clockedIn) return <EmptyState icon={CheckIco} text="Clock in to view your assigned tasks." />;
  if (tasks.length === 0) return <EmptyState icon={CheckIco} text="Loading tasks..." />;

  const zones = [...new Set(tasks.map(t => t.zone))];
  const completed = tasks.filter(t => completedTaskIds.has(t.id)).length;
  const pct = Math.round((completed / tasks.length) * 100);

  return (
    <div style={{ padding: "16px" }}>
      <div style={{ padding: "12px 14px", marginBottom: 14, background: GOLD_DIM, borderRadius: 10, border: `1px solid rgba(200,168,78,0.2)` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 10, color: GOLD, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600 }}>Your Assignment</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 3 }}>{clockStatus.shift.siteName}</div>
          </div>
          <div style={{ background: pct === 100 ? "rgba(46,204,113,0.15)" : NAVY_MID, padding: "6px 12px", borderRadius: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: pct === 100 ? GREEN : GOLD }}>{pct}%</div>
          </div>
        </div>
        <div style={{ height: 4, borderRadius: 2, background: NAVY_LIGHT, marginTop: 10, overflow: "hidden" }}>
          <div style={{ height: "100%", borderRadius: 2, background: pct === 100 ? GREEN : `linear-gradient(90deg,${GOLD},${GOLD_LIGHT})`, width: `${pct}%`, transition: "width 0.4s ease" }} />
        </div>
      </div>

      {zones.map(zone => (
        <div key={zone} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: GOLD, textTransform: "uppercase", letterSpacing: "1.5px", fontWeight: 600, marginBottom: 6 }}>{zone}</div>
          {tasks.filter(t => t.zone === zone).map(task => {
            const done = completedTaskIds.has(task.id);
            return (
              <button key={task.id} onClick={() => toggleTask(task.id)} style={{
                width: "100%", display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", marginBottom: 4,
                background: done ? "rgba(46,204,113,0.06)" : "rgba(255,255,255,0.02)",
                border: done ? `1px solid rgba(46,204,113,0.2)` : `1px solid ${NAVY_LIGHT}`,
                borderRadius: 8, cursor: "pointer", textAlign: "left", color: WHITE,
              }}>
                <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${done ? GREEN : GRAY}`, background: done ? GREEN : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                  {done && <CheckIco sz={11} c={WHITE} />}
                </div>
                <div style={{ flex: 1, fontSize: 12, fontWeight: 500, textDecoration: done ? "line-through" : "none", opacity: done ? 0.6 : 1 }}>{task.label}</div>
                <div style={{ display: "flex", gap: 4, flexShrink: 0, marginTop: 2 }}>
                  {task.priority === "high" && <span style={{ fontSize: 8, color: ORANGE, background: `${ORANGE}15`, padding: "1px 5px", borderRadius: 3, fontWeight: 600 }}>PRIORITY</span>}
                  <span style={{ fontSize: 8, color: GRAY, background: NAVY_LIGHT, padding: "1px 5px", borderRadius: 3 }}>{task.cims_category}</span>
                </div>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// CHAT VIEW
// ============================================================
function ChatView({ channels, messages, activeChannel, setActiveChannel, sendMessage, user }) {
  const [text, setText] = useState("");
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  const siteChannels = channels.filter(c => c.type === "site" || c.type === "general");
  const dmChannel = channels.find(c => c.type === "admin_dm");
  const isDm = activeChannel && dmChannel && activeChannel === dmChannel.id;

  const handleSend = () => {
    if (!text.trim() || !activeChannel) return;
    sendMessage(activeChannel, text.trim());
    setText("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 128px)" }}>
      <div style={{ padding: "10px 12px 0", borderBottom: `1px solid ${NAVY_LIGHT}`, paddingBottom: 10 }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          {siteChannels.map(ch => (
            <button key={ch.id} onClick={() => setActiveChannel(ch.id)} style={{
              padding: "6px 12px", borderRadius: 20, border: activeChannel === ch.id ? `1px solid rgba(200,168,78,0.3)` : "1px solid transparent",
              background: activeChannel === ch.id ? GOLD_DIM : "transparent", color: activeChannel === ch.id ? GOLD : GRAY,
              fontSize: 11, fontWeight: activeChannel === ch.id ? 700 : 500, cursor: "pointer",
            }}>{ch.name || ch.siteName}</button>
          ))}
        </div>
        {dmChannel && (
          <button onClick={() => setActiveChannel(dmChannel.id)} style={{
            display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px", borderRadius: 10,
            background: isDm ? "rgba(52,152,219,0.12)" : "rgba(255,255,255,0.02)",
            border: isDm ? `1.5px solid rgba(52,152,219,0.4)` : `1px solid ${NAVY_LIGHT}`,
            cursor: "pointer", color: WHITE, textAlign: "left",
          }}>
            <LockIco c={isDm ? BLUE : GRAY} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: isDm ? 700 : 600, color: isDm ? BLUE : GRAY_LIGHT }}>Admin (Private)</div>
              <div style={{ fontSize: 9, color: GRAY }}>Only you and management can see these messages</div>
            </div>
            {dmChannel.unreadCount > 0 && <div style={{ background: RED, color: WHITE, fontSize: 9, fontWeight: 700, width: 18, height: 18, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>{dmChannel.unreadCount}</div>}
          </button>
        )}
      </div>

      {isDm && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: "rgba(52,152,219,0.06)", borderBottom: `1px solid rgba(52,152,219,0.12)`, fontSize: 10, color: BLUE }}>
          <LockIco /> Private conversation with admin.
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 12px 0" }}>
        {!activeChannel && <div style={{ textAlign: "center", padding: "40px 20px" }}><ChatIco sz={32} c={NAVY_LIGHT} /><div style={{ fontSize: 13, color: GRAY, marginTop: 12 }}>Select a channel to start chatting.</div></div>}
        {activeChannel && messages.length === 0 && <div style={{ textAlign: "center", padding: "40px 20px", fontSize: 13, color: GRAY }}>No messages yet.</div>}
        {messages.map((msg, idx) => {
          const isMe = msg.senderId === user?.id;
          const isAdmin = msg.senderRole === "admin" || msg.senderRole === "supervisor";
          const showName = idx === 0 || messages[idx - 1].senderId !== msg.senderId;
          return (
            <div key={msg.id} style={{ display: "flex", flexDirection: isMe ? "row-reverse" : "row", gap: 8, marginBottom: showName ? 12 : 4, alignItems: "flex-end" }}>
              {!isMe && showName && (
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: isAdmin ? (isDm ? "rgba(52,152,219,0.15)" : GOLD_DIM) : NAVY_LIGHT, border: `1px solid ${isAdmin ? (isDm ? BLUE : GOLD) : NAVY_LIGHT}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: isAdmin ? (isDm ? BLUE : GOLD) : GRAY_LIGHT, flexShrink: 0 }}>
                  {msg.senderName?.split(" ").map(n => n[0]).join("")}
                </div>
              )}
              {!isMe && !showName && <div style={{ width: 28, flexShrink: 0 }} />}
              <div style={{ maxWidth: "75%" }}>
                {!isMe && showName && <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 3, color: isAdmin ? (isDm ? BLUE : GOLD) : GRAY_LIGHT }}>{msg.senderName}</div>}
                <div style={{ padding: "8px 12px", borderRadius: isMe ? "12px 12px 2px 12px" : "12px 12px 12px 2px", background: isMe ? (isDm ? BLUE : GOLD) : (isDm && isAdmin ? "rgba(52,152,219,0.08)" : NAVY_MID), border: isMe ? "none" : `1px solid ${isDm && isAdmin ? "rgba(52,152,219,0.2)" : NAVY_LIGHT}`, color: isMe ? (isDm ? WHITE : NAVY) : WHITE, fontSize: 13, lineHeight: 1.45 }}>{msg.text}</div>
                <div style={{ fontSize: 9, color: GRAY, marginTop: 2, textAlign: isMe ? "right" : "left" }}>{formatTime(msg.sentAt)}</div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div style={{ padding: "10px 12px", borderTop: `1px solid ${isDm ? "rgba(52,152,219,0.15)" : NAVY_LIGHT}`, display: "flex", gap: 8, alignItems: "center", background: NAVY }}>
        <input value={text} onChange={e => setText(e.target.value)} placeholder={isDm ? "Private message to admin..." : "Type a message..."} style={{ flex: 1, padding: "10px 14px", borderRadius: 20, border: `1px solid ${isDm ? "rgba(52,152,219,0.25)" : NAVY_LIGHT}`, background: NAVY_MID, color: WHITE, fontSize: 13, outline: "none", fontFamily: "'DM Sans',sans-serif" }} onKeyDown={e => e.key === "Enter" && handleSend()} />
        <button onClick={handleSend} style={{ width: 38, height: 38, borderRadius: "50%", background: text.trim() ? (isDm ? BLUE : GOLD) : NAVY_LIGHT, border: "none", cursor: text.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <SendIco sz={16} c={text.trim() ? (isDm ? WHITE : NAVY) : GRAY} />
        </button>
      </div>
    </div>
  );
}

// ============================================================
// ISSUES VIEW
// ============================================================
// ============================================================
// ISSUE TASKS VIEW (Assigned issues from admin)
// ============================================================
function IssueTasksView({ issueTasks, resolveIssueTask, showToast }) {
  const [resolving, setResolving] = useState(null);
  const [note, setNote] = useState("");
  const sevC = { low: GREEN, medium: ORANGE, high: RED };

  if (issueTasks.length === 0) return (
    <div style={{ padding: "60px 20px", textAlign: "center" }}>
      <AlertIco sz={40} c={NAVY_LIGHT} />
      <div style={{ fontSize: 15, color: GRAY, marginTop: 16 }}>No assigned issue tasks right now.</div>
      <div style={{ fontSize: 12, color: GRAY, marginTop: 4 }}>When an admin assigns an issue to you, it will appear here.</div>
    </div>
  );

  return (
    <div style={{ padding: "16px" }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Assigned Issues</div>
        <div style={{ fontSize: 11, color: GRAY_LIGHT }}>{issueTasks.length} issue{issueTasks.length !== 1 ? "s" : ""} assigned to you</div>
      </div>

      {issueTasks.map(task => {
        const isResolving = resolving === task.task_id;
        return (
          <div key={task.task_id} style={{ marginBottom: 10, background: NAVY_MID, border: `1px solid ${NAVY_LIGHT}`, borderRadius: 10, borderLeft: `3px solid ${sevC[task.severity] || ORANGE}`, overflow: "hidden" }}>
            <div style={{ padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{task.issue_title}</div>
                  {task.issue_description && <div style={{ fontSize: 11, color: GRAY_LIGHT, marginTop: 4, lineHeight: 1.4 }}>{task.issue_description}</div>}
                </div>
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", padding: "2px 7px", borderRadius: 4, background: (sevC[task.severity] || ORANGE) + "18", color: sevC[task.severity] || ORANGE, flexShrink: 0, marginLeft: 8 }}>{task.severity}</span>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 8, fontSize: 10, color: GRAY }}>
                <span>{task.site_name}</span>
                <span>{task.issue_zone || task.zone}</span>
                <span>Reported by {task.reported_by_name}</span>
              </div>

              {task.photo_url && (
                <div style={{ marginTop: 8 }}>
                  <img src={task.photo_url} alt="Issue" style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 6, border: `1px solid ${NAVY_LIGHT}` }} />
                </div>
              )}

              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                {task.resolution_status !== "in_progress" && (
                  <button onClick={() => resolveIssueTask(task.task_id, "in_progress", null)} style={{ flex: 1, padding: "8px", borderRadius: 6, border: `1px solid ${ORANGE}`, background: "transparent", color: ORANGE, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>In Progress</button>
                )}
                <button onClick={() => resolveIssueTask(task.task_id, "resolved", null)} style={{ flex: 1, padding: "8px", borderRadius: 6, border: `1px solid ${GREEN}`, background: "transparent", color: GREEN, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Resolved</button>
                <button onClick={() => { setResolving(isResolving ? null : task.task_id); setNote(""); }} style={{ flex: 1, padding: "8px", borderRadius: 6, border: `1px solid ${RED}`, background: "transparent", color: RED, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Cannot Resolve</button>
              </div>
            </div>

            {isResolving && (
              <div style={{ padding: "10px 14px", borderTop: `1px solid ${NAVY_LIGHT}`, background: "rgba(231,76,60,0.04)" }}>
                <div style={{ fontSize: 10, color: RED, fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 6 }}>Explain why this cannot be resolved</div>
                <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Describe the issue preventing resolution..." rows={3} style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: `1px solid ${NAVY_LIGHT}`, background: "rgba(255,255,255,0.04)", color: WHITE, fontSize: 12, outline: "none", resize: "vertical", fontFamily: "'DM Sans',sans-serif", marginBottom: 8 }} />
                <button onClick={() => { if (!note.trim()) { showToast("Please provide a reason", "error"); return; } resolveIssueTask(task.task_id, "unable_to_resolve", note.trim()); setResolving(null); }} style={{ width: "100%", padding: "10px", borderRadius: 6, border: "none", background: RED, color: WHITE, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Submit</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// ISSUES VIEW
// ============================================================
function IssuesView({ clockStatus, issues, submitIssue, showToast }) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState(""); const [desc, setDesc] = useState("");
  const [sev, setSev] = useState("medium"); const [zone, setZone] = useState("");
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const sevs = [{ v: "low", l: "Low", c: GREEN }, { v: "medium", l: "Med", c: ORANGE }, { v: "high", l: "High", c: RED }];

  if (!clockStatus?.clockedIn) return <EmptyState icon={AlertIco} text="Clock in to report issues." />;

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { showToast("Photo must be under 10MB", "error"); return; }
    setPhoto(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    setPhoto(null);
    setPhotoPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!title.trim()) { showToast("Enter issue title", "error"); return; }
    setUploading(true);
    try {
      let photoUrl = null;
      if (photo) {
        photoUrl = await uploadPhoto(photo);
      }
      await submitIssue(title.trim(), desc.trim(), zone.trim(), sev, photoUrl);
      setTitle(""); setDesc(""); setZone(""); setSev("medium");
      setPhoto(null); setPhotoPreview(null);
      setShowForm(false);
    } catch (err) {
      showToast(err.message, "error");
    }
    setUploading(false);
  };

  return (
    <div style={{ padding: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Issues</div>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: "7px 12px", borderRadius: 8, border: "none", background: showForm ? NAVY_LIGHT : GOLD, color: showForm ? WHITE : NAVY, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{showForm ? "Cancel" : "+ Report"}</button>
      </div>

      {showForm && (
        <div style={{ padding: 14, marginBottom: 14, background: NAVY_MID, border: `1px solid ${NAVY_LIGHT}`, borderRadius: 12, animation: "fadeIn 0.3s ease" }}>
          <div style={{ marginBottom: 10 }}><label style={labelSt}>Title</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="Brief description" style={inputSt} /></div>
          <div style={{ marginBottom: 10 }}><label style={labelSt}>Details</label><textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Additional details..." rows={3} style={{ ...inputSt, resize: "vertical", fontFamily: "inherit" }} /></div>
          <div style={{ marginBottom: 10 }}><label style={labelSt}>Zone</label><input value={zone} onChange={e => setZone(e.target.value)} placeholder="e.g. Restroom, Lobby" style={inputSt} /></div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelSt}>Severity</label>
            <div style={{ display: "flex", gap: 6 }}>
              {sevs.map(s => (
                <button key={s.v} onClick={() => setSev(s.v)} style={{ flex: 1, padding: "8px", borderRadius: 8, border: sev === s.v ? `2px solid ${s.c}` : `1px solid ${NAVY_LIGHT}`, background: sev === s.v ? `${s.c}15` : "transparent", cursor: "pointer", color: s.c, fontSize: 12, fontWeight: 600, textAlign: "center" }}>{s.l}</button>
              ))}
            </div>
          </div>

          {/* Photo Upload */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelSt}>Photo</label>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: "none" }} />

            {!photoPreview ? (
              <button onClick={() => fileRef.current?.click()} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "12px", background: "rgba(255,255,255,0.03)",
                border: `1px dashed ${GOLD}`, borderRadius: 8, cursor: "pointer",
                color: GOLD, fontSize: 12, fontWeight: 600,
              }}>
                <CamIco sz={18} c={GOLD} />
                <div style={{ textAlign: "left" }}>
                  <div>Take Photo or Choose from Gallery</div>
                  <div style={{ fontSize: 10, color: GRAY, fontWeight: 400, marginTop: 2 }}>JPG, PNG up to 10MB</div>
                </div>
              </button>
            ) : (
              <div style={{ position: "relative" }}>
                <img src={photoPreview} alt="Preview" style={{
                  width: "100%", height: 160, objectFit: "cover",
                  borderRadius: 8, border: `1px solid ${NAVY_LIGHT}`,
                }} />
                <button onClick={removePhoto} style={{
                  position: "absolute", top: 6, right: 6,
                  width: 28, height: 28, borderRadius: "50%",
                  background: "rgba(0,0,0,0.7)", border: "none",
                  color: WHITE, fontSize: 16, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>x</button>
                <div style={{ fontSize: 10, color: GREEN, marginTop: 4 }}>Photo attached: {photo?.name}</div>
              </div>
            )}
          </div>

          <button onClick={handleSubmit} disabled={uploading} style={{
            width: "100%", padding: "12px", borderRadius: 10, border: "none",
            background: `linear-gradient(135deg,${GOLD},${GOLD_LIGHT})`,
            color: NAVY, fontSize: 13, fontWeight: 700, cursor: "pointer",
            textTransform: "uppercase", opacity: uploading ? 0.6 : 1,
          }}>{uploading ? "Uploading..." : "Submit Issue"}</button>
        </div>
      )}

      {issues.length === 0 && !showForm && <div style={{ padding: "32px 20px", textAlign: "center", background: "rgba(255,255,255,0.02)", borderRadius: 12, border: `1px solid ${NAVY_LIGHT}`, fontSize: 13, color: GRAY }}>No issues reported yet.</div>}
      {issues.map(issue => {
        const sc = issue.severity === "high" ? RED : issue.severity === "medium" ? ORANGE : GREEN;
        return (
          <div key={issue.id} style={{ padding: "12px", marginBottom: 6, background: NAVY_MID, border: `1px solid ${NAVY_LIGHT}`, borderRadius: 10, borderLeft: `3px solid ${sc}` }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{issue.title}</div>
              <span style={{ fontSize: 9, color: sc, background: `${sc}20`, padding: "2px 6px", borderRadius: 4, fontWeight: 600, textTransform: "uppercase" }}>{issue.severity}</span>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 6, fontSize: 9, color: GRAY }}>
              <span>{issue.zone}</span>
              <span>{issue.site_name}</span>
              <span style={{ color: issue.status === "open" ? ORANGE : GREEN, fontWeight: 600, textTransform: "uppercase" }}>{issue.status}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// SUPPLIES VIEW
// ============================================================
function SuppliesView({ clockStatus, supplies, supplyLogs, logSupplyUsage, submitRequest, showToast }) {
  const [scanning, setScanning] = useState(null);
  const [qty, setQty] = useState(1);
  const [reqForm, setReqForm] = useState(null);

  if (!clockStatus?.clockedIn) return <EmptyState icon={BoxIco} text="Clock in to log supply usage." />;

  const handleSubmitReq = () => {
    if (!reqForm.type) { showToast("Select a request type", "error"); return; }
    if ((reqForm.type === "new_gear" || reqForm.type === "new_supply") && !reqForm.itemName) { showToast("Enter the item name", "error"); return; }
    submitRequest(reqForm.type, reqForm.itemName, reqForm.description, reqForm.urgency, reqForm.supplyId);
    setReqForm(null);
  };

  return (
    <div style={{ padding: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div><div style={{ fontSize: 16, fontWeight: 700 }}>Supply Tracking</div><div style={{ fontSize: 11, color: GRAY_LIGHT }}>Log usage or submit a request</div></div>
        <button onClick={() => setReqForm({ type: "", itemName: "", description: "", urgency: "normal", supplyId: null })} style={{ padding: "7px 12px", borderRadius: 8, border: "none", background: GOLD, color: NAVY, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>+ Request</button>
      </div>

      {reqForm && (
        <div style={{ padding: 14, marginBottom: 14, background: NAVY_MID, border: `1px solid ${NAVY_LIGHT}`, borderRadius: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Supply/Gear Request</div>
          <div style={{ marginBottom: 10 }}>
            <label style={labelSt}>Request Type</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[{ v: "refill", l: "Refill" }, { v: "damage_report", l: "Damage Report" }, { v: "new_gear", l: "New Gear" }, { v: "new_supply", l: "New Supply" }].map(t => (
                <button key={t.v} onClick={() => setReqForm({ ...reqForm, type: t.v })} style={{ padding: "6px 10px", borderRadius: 6, border: reqForm.type === t.v ? `2px solid ${GOLD}` : `1px solid ${NAVY_LIGHT}`, background: reqForm.type === t.v ? GOLD_DIM : "transparent", color: reqForm.type === t.v ? GOLD : GRAY_LIGHT, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{t.l}</button>
              ))}
            </div>
          </div>
          {(reqForm.type === "refill" || reqForm.type === "damage_report") && supplies.length > 0 && (
            <div style={{ marginBottom: 10 }}><label style={labelSt}>Supply Item</label><select value={reqForm.supplyId || ""} onChange={e => setReqForm({ ...reqForm, supplyId: e.target.value || null, itemName: supplies.find(s => s.id === e.target.value)?.name || "" })} style={inputSt}><option value="">Select supply...</option>{supplies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          )}
          {(reqForm.type === "new_gear" || reqForm.type === "new_supply") && (
            <div style={{ marginBottom: 10 }}><label style={labelSt}>Item Name</label><input value={reqForm.itemName} onChange={e => setReqForm({ ...reqForm, itemName: e.target.value })} placeholder="What do you need?" style={inputSt} /></div>
          )}
          <div style={{ marginBottom: 10 }}><label style={labelSt}>Details</label><textarea value={reqForm.description} onChange={e => setReqForm({ ...reqForm, description: e.target.value })} placeholder="Describe the request..." rows={2} style={{ ...inputSt, resize: "vertical", fontFamily: "inherit" }} /></div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelSt}>Urgency</label>
            <div style={{ display: "flex", gap: 6 }}>
              {[{ v: "low", l: "Low", c: GREEN }, { v: "normal", l: "Normal", c: GRAY_LIGHT }, { v: "high", l: "High", c: ORANGE }, { v: "urgent", l: "Urgent", c: RED }].map(u => (
                <button key={u.v} onClick={() => setReqForm({ ...reqForm, urgency: u.v })} style={{ flex: 1, padding: "6px", borderRadius: 6, border: reqForm.urgency === u.v ? `2px solid ${u.c}` : `1px solid ${NAVY_LIGHT}`, background: reqForm.urgency === u.v ? u.c + "15" : "transparent", color: u.c, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>{u.l}</button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setReqForm(null)} style={{ flex: 1, padding: "10px", borderRadius: 8, border: `1px solid ${NAVY_LIGHT}`, background: "transparent", color: GRAY_LIGHT, fontSize: 12, cursor: "pointer" }}>Cancel</button>
            <button onClick={handleSubmitReq} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: `linear-gradient(135deg,${GOLD},${GOLD_LIGHT})`, color: NAVY, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Submit Request</button>
          </div>
        </div>
      )}

      {supplies.map(sup => {
        const isOpen = scanning === sup.id;
        const isLow = sup.is_low || (sup.site_stock !== undefined && sup.site_stock <= sup.site_threshold);
        return (
          <div key={sup.id} style={{ marginBottom: 6 }}>
            <button onClick={() => { setScanning(isOpen ? null : sup.id); setQty(1); }} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
              background: isOpen ? GOLD_DIM : "rgba(255,255,255,0.02)",
              border: isOpen ? `1.5px solid ${GOLD}` : `1px solid ${NAVY_LIGHT}`,
              borderRadius: isOpen ? "10px 10px 0 0" : 10, cursor: "pointer", color: WHITE, textAlign: "left",
            }}>
              <div style={{ width: 34, height: 34, borderRadius: 6, background: NAVY_LIGHT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: GRAY, fontFamily: "monospace" }}>QR</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{sup.name}</div>
                <div style={{ display: "flex", gap: 6, marginTop: 2, fontSize: 9 }}>
                  <span style={{ color: GRAY }}>{sup.qr_code}</span>
                  {isLow && <span style={{ color: ORANGE, fontWeight: 600 }}>LOW</span>}
                </div>
              </div>
              <ChevIco sz={14} c={GRAY} style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "0.2s" }} />
            </button>
            {isOpen && (
              <div style={{ padding: "12px", background: NAVY_MID, border: `1.5px solid ${GOLD}`, borderTop: "none", borderRadius: "0 0 10px 10px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 12 }}>
                  <button onClick={() => setQty(Math.max(1, qty - 1))} style={qtyBtn}><MinusIco sz={14} /></button>
                  <div style={{ textAlign: "center" }}><div style={{ fontSize: 28, fontWeight: 700, color: GOLD }}>{qty}</div><div style={{ fontSize: 10, color: GRAY }}>{sup.unit}</div></div>
                  <button onClick={() => setQty(qty + 1)} style={qtyBtn}><PlusIco sz={14} /></button>
                </div>
                <button onClick={() => { logSupplyUsage(sup.id, qty); setScanning(null); setQty(1); }} style={{ width: "100%", padding: "10px", borderRadius: 8, border: "none", background: `linear-gradient(135deg,${GOLD},${GOLD_LIGHT})`, color: NAVY, fontSize: 12, fontWeight: 700, cursor: "pointer", textTransform: "uppercase" }}>Log Usage</button>
              </div>
            )}
          </div>
        );
      })}

      {supplyLogs.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <label style={{ ...labelSt, display: "block", marginBottom: 8 }}>This Shift's Log</label>
          {supplyLogs.map((log, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", marginBottom: 3, background: "rgba(255,255,255,0.02)", borderRadius: 6, fontSize: 11 }}>
              <span style={{ fontWeight: 600 }}>{log.supply_name || "Item"} <span style={{ color: GRAY, fontWeight: 400 }}>{log.quantity} {log.unit}</span></span>
              <span style={{ color: GRAY, fontSize: 9 }}>{formatTime(log.loggedAt || log.scanned_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// SHARED
// ============================================================
function EmptyState({ icon: Icon, text }) {
  return (
    <div style={{ padding: "60px 20px", textAlign: "center" }}>
      <Icon sz={40} c={NAVY_LIGHT} />
      <div style={{ fontSize: 15, color: GRAY, marginTop: 16 }}>{text}</div>
    </div>
  );
}

const labelSt = { fontSize: 10, color: GOLD, textTransform: "uppercase", letterSpacing: "1.5px", fontWeight: 600, marginBottom: 6, display: "block" };
const inputSt = { width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${NAVY_LIGHT}`, background: "rgba(255,255,255,0.04)", color: WHITE, fontSize: 13, outline: "none", fontFamily: "'DM Sans',sans-serif" };
const qtyBtn = { width: 36, height: 36, borderRadius: "50%", border: `1px solid ${NAVY_LIGHT}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: WHITE };
