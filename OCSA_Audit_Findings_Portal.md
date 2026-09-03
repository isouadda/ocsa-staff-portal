# OCSA Audit 3 of 4: Staff Portal Findings Register

Repo: ocsa-staff-portal, main at commit 30a32d5 (the session branch claude/new-session-7d8wvb points at the same commit).
Date: September 3, 2026.
Mode: read-only. No edits, no branches, no commits, no lockfile changes. The one verification build ran on a scratch copy outside the repo because npm ci fails on the committed lockfile (POR-022). The working tree was clean before and after the audit.
Files read in full: src/App.js (1,561 lines, 223 KB), src/clientConfig.js, src/index.js, public/index.html, package.json, .env, .gitignore, CLAUDE.md, and the header of package-lock.json.
Source of truth: OCSA_Roadmap_and_State_20260903.md and the Audit 3 brief. The API repo and the admin repo were not opened. Anything that depends on API behavior is stated as an assumption, listed under Needs Verification, or handed to the API register as a Cross Reference.
Locations: function name plus a text pattern in src/App.js unless another file is named. No line numbers.

## Summary

33 findings: P0 1, P1 11, P2 11, P3 10.

Headline. The portal is a single React file with a consistent design vocabulary and a central api() helper that attaches the token and handles 401 on every call. The problems cluster in four places. First, one P0: a live admin login and a staff login are rendered on the login screen with their PINs. Second, session state is held in memory only and is reset inconsistently, so a reload mid-shift loses the checklist state and a shared phone can show the previous user's chat. Third, failure handling: seven read paths fail silently, several forms clear themselves before the server answers, and no request has a timeout, which on a weak connection means lost issue reports, lost chat messages, and a Clock In button stuck on "...". Fourth, two data correctness defects: the schedule buckets evening work on the wrong day because it compares UTC dates, and the drop-shift request throws away the reason the cleaner typed. The hard-convention violation is that certification framework category codes render on every task row and inspection item.

Scope coverage, one entry per item in the brief:

1. Login and session. Findings POR-001, POR-003, POR-009, POR-013, POR-014, POR-016, POR-033. Clean with evidence: the portal never touches ocsa_qr_token, the only storage key in the codebase is "ocsa-staff-theme" (`localStorage.getItem("ocsa-staff-theme")`, `localStorage.setItem("ocsa-staff-theme", next)`), so the cross-repo contract is untouched on this side; whether the portal is expected to read that key is NV-6. A placeholder pin_hash such as RESET_REQUIRED cannot be typed into the portal, the PIN field is `type="password" maxLength={4}` and the value is sent verbatim in `body: { phone, pin }` with no client hashing, so rejection of the placeholder is entirely an API concern (CR-9). Every 401 is handled in one place for api() and separately in the three raw upload fetches, all four dispatch `ocsa-session-expired`.

2. Clock in and out. Findings POR-009, POR-010, and the stale-site path inside POR-003. What the portal sends today: `body: { siteId: selectedSite }` and nothing else. There is no geolocation code at all (grep for geolocation, latitude, longitude, coords returns nothing), so the geofence backend receives no coordinates from this app. Wrong site in the normal path: the site is chosen from `me.sites` returned by /api/auth/me, and the chooser is locked while clocked in (`onClick={() => !ci && setSelectedSite(site.siteId)}`), and on login the selection is forced to the open shift's site (`if (cs.clockedIn) setSelectedSite(cs.shift.siteId)`). Double submit is blocked by `disabled={loading}` on the single Clock In/Out button. Sent versus failed: success shows a green toast and the Time on Site card, failure shows a red toast for 3 seconds, and a stalled request shows "..." with no end (POR-009). Whether the API rejects a siteId outside the caller's assignments is CR-1.

3. Task checklist. Findings POR-002, POR-008, POR-011, POR-021. Clean with evidence: the portal renders every task in the response with no frequency filter (grep for frequency returns nothing) and prints `task.label` as delivered, so cadence-prefixed labels render as stored. Completion calls carry only the task id (`"/api/clock/tasks/" + taskId + "/complete"` with `body: {}`), so scoping to the current shift record is server-side (CR-6). Toggling twice sends POST then DELETE, driven by `completedTaskIds.has(taskId)`. Missing shift record: TasksView returns the clock-in prompt when `!clockStatus?.clockedIn`, and loadTasks returns early when `!clockStatus?.shift?.siteId`.

4. Profile. Findings POR-012, POR-019. Clean with evidence: the Employee ID badge renders `u.employeeId` with the fallback "Employee ID not assigned. Ask your supervisor." Employment type is not surfaced anywhere (grep for employment returns nothing). Photo upload compresses to an 800 px JPEG at 0.85, posts to the profile-photos bucket, then posts the returned URL to /api/users/profile/photo, and handles 401 and non-2xx. Address and emergency fields are edited and sent (POR-012 covers the empty-string problem).

5. Error and offline behavior. Findings POR-004, POR-005, POR-006, POR-008, POR-009, POR-010, POR-014. Every fetch and what the user sees on failure:
   - POST /api/auth/login: red toast with the raw error; a 401 from a wrong PIN would read "Session expired" (NV-1).
   - GET /api/auth/me, GET /api/clock/status at login: red toast, login screen stays, token left in state (POR-033).
   - GET /api/users/profile/me at login: swallowed, cosmetic only.
   - GET /api/lookups/all: console.warn, fallback option lists used.
   - GET /api/clock/tasks/assigned: silent, badge stays stale (POR-008).
   - POST /api/auth/register: red toast.
   - POST /api/clock/in, POST /api/clock/out: red toast, no status resync (POR-010).
   - GET /api/sites/:id/tasks: silent, "Loading tasks..." shown with no end (POR-008).
   - POST and DELETE /api/clock/tasks/:id/complete: red toast, local state unchanged, correct.
   - GET /api/issues: silent (POR-008).
   - POST /api/issues, POST /api/issues/:id/photos: red toast, form already cleared (POR-004).
   - PATCH /api/clock/tasks/resolve/:id: red toast, note already cleared (POR-004).
   - GET /api/supplies: silent (POR-008).
   - POST /api/supplies/log-usage: red toast, accordion already closed.
   - POST /api/supplies/requests: red toast, form already gone (POR-004).
   - GET /api/chat/channels, GET /api/chat/channels/:id/messages: silent (POR-008).
   - POST /api/chat/channels/:id/messages: red toast, typed text already cleared (POR-005).
   - GET /api/pickups/my-schedule: silent, every day shows "-" (POR-008).
   - POST /api/pickups/request-drop: red toast on failure, nothing on success (POR-006).
   - GET /api/pickups/available, GET /api/pickups/my-pickups, POST claim, POST release: red toast, visible.
   - GET /api/inspections/scheduled, GET templates, GET /api/sites, POST scheduled, GET scheduled/:id, POST complete: red toast, visible.
   - POST /api/uploads (three helpers): red toast through the caller, visible.
   - GET /api/users/profile/me in MyProfileView: red toast, then "Loading profile..." stays with no retry (POR-008).
   - POST /api/users/profile/photo, PATCH /api/users/profile/me: red toast, edit mode stays open, correct.
   There is no timeout, no retry, and no online or offline indicator anywhere (grep for AbortController, navigator.onLine, visibilitychange returns nothing).

6. Mobile rendering. Findings POR-026, POR-027, POR-028, all P3. Nothing found that would block a cleaner from completing a shift: the Clock In/Out button is full width with 15 px vertical padding, site rows and task rows are full-width tap targets, the bottom nav buttons are `flex: 1`, and there are no hover-only interactions (the only hover token is a background color and there are no onMouse handlers).

7. API base and requests. Findings POR-029 (the fallback literal), POR-033. Clean with evidence: `const API = process.env.REACT_APP_API_URL || "https://ocsa-api-production.up.railway.app";` and every request is built as `API + path`. All 36 api() calls that need auth pass `token`, the three raw upload fetches set `"Authorization": "Bearer " + token`, and all four paths handle 401 by dispatching `ocsa-session-expired`. Consistency with the admin's derivation is NV-13.

8. Text conventions. Findings POR-011 (category codes rendered), POR-025 (English-only strings). Clean with evidence: `grep -nP '[^\x00-\x7F]' src/*.js public/index.html` returns nothing, so there are no em or en dashes, no curly quotes, and no non-ASCII characters in any user-facing string. The word CIMS appears only as the identifier `CIMS_C` and the field `cims_category`, never as rendered text.

9. Data the portal should never see. Findings POR-018, POR-019, POR-003. Nothing rendered carries an hourly rate, another person's profile, or an admin note (grep for hourly, rate, wage, salary, pin_hash, admin_notes returns nothing). The portal does receive other staff's issues (POR-018) and a hidden personalNotes field (POR-019). What /api/auth/me and /api/users/profile/me carry beyond the fields rendered is CR-4.

10. Tests. Finding POR-023. There is no test script, no test file, no setupTests, no testing library dependency, and no CI configuration (find for *.test.*, *.spec.*, setupTests* returns nothing; package.json has only start and build; there is no .github directory).

## Findings

### POR-001

- ID: POR-001
- Severity: P0
- Location: src/App.js, LoginScreen, pattern `const demos = [` through `Demo Accounts (Live Data)`.
- What: Two real accounts, one admin and one staff, are compiled into the bundle with their phone or email and PIN, and rendered on the login screen as tap-to-fill buttons with the PIN printed beside each name. A static line below the logo also reads "Connected to Live API".
- Impact: Anyone who opens the portal URL can sign in as the OCSA admin without knowing anything. The PINs are in the deployed JavaScript, in view source, and in git history for every commit since the block was added, so removing the block is necessary and rotation is also required.
- Evidence (PIN digits redacted in this register, they are present in the source):
```
const demos = [
  { name: "Ibrahim Souadda", role: "Admin (test)", phone: "isouadda@ocsaco.com", pin: "<redacted>" },
  { name: "Daniel Evans", role: "Custodial Laborer | PLA", phone: "daniel.evans@ocsa.temp", pin: "<redacted>" },
];
...
<div style={{ fontSize: 10, color: GREEN, marginTop: 8 }}>Connected to Live API</div>
...
<div ...>Demo Accounts (Live Data)</div>
{demos.map(d => (<button key={d.phone} onClick={() => { setPhone(d.phone); setPin(d.pin); }} ...>...<span ...>PIN: {d.pin}</span></button>))}
```
- Recommended fix: Delete the `demos` array, the "Demo Accounts (Live Data)" block, and the "Connected to Live API" line. Rotate both PINs through admin reset PIN the same day. Add this to the pre-launch security gate list in the roadmap so it ships with the API gate.
- Effort: S
- Rewrite flag: No

### POR-002

- ID: POR-002
- Severity: P1
- Location: src/App.js, OCSAStaffPortal, patterns `const [completedTaskIds, setCompletedTaskIds] = useState(new Set());`, `const loadTasks = async () =>`, `const toggleTask = async (taskId) =>`.
- What: The set of completed task ids lives only in memory and is never seeded from the server. loadTasks fetches the task list and the status counts and leaves completedTaskIds untouched. The only writers are toggleTask, handleClockOut, and handleLogout.
- Impact: After any reload, tab eviction, or re-login mid-shift (which POR-013 makes common), every task shows unchecked while the Home card shows the server's count, for example 12/20 on Home and 0% on Tasks. Tapping an already-completed task sends a second POST, so completions are double-counted or rejected depending on the API. The cleaner cannot trust the checklist and may redo or re-tick work.
- Evidence:
```
const [completedTaskIds, setCompletedTaskIds] = useState(new Set());
...
const loadTasks = async () => { if (!clockStatus?.clockedIn || !clockStatus?.shift?.siteId) return; try { let taskUrl = "/api/sites/" + clockStatus.shift.siteId + "/tasks?user_id=" + user.id; ... const tt = await api(taskUrl, { token }); setTasks(tt); const cs = await api("/api/clock/status", { token }); setClockStatus(cs); } catch (err) { console.error(err); } };
const toggleTask = async (taskId) => { try { if (completedTaskIds.has(taskId)) { await api("/api/clock/tasks/" + taskId + "/complete", { method: "DELETE", token }); ... } else { await api("/api/clock/tasks/" + taskId + "/complete", { method: "POST", body: {}, token }); ...
```
TasksView: `const completed = standardTasks.filter(tk => completedTaskIds.has(tk.id)).length;`
ClockView: `const tk = clockStatus?.tasks || { total: 0, completed: 0 };`
handleLogin restores the shift and leaves the completions empty: `if (cs.clockedIn) setSelectedSite(cs.shift.siteId);`
- Recommended fix: In loadTasks, seed completedTaskIds from a per-task completion flag on the tasks response, for example `setCompletedTaskIds(new Set(tt.filter(x => x.completed_this_shift).map(x => x.id)))`. If the API does not yet return that flag for the active shift record, add it there first (CR-6, NV-4). Until then, at minimum treat an already-completed error from the POST as a signal to refetch.
- Effort: S on the portal once the field exists
- Rewrite flag: No

### POR-003

- ID: POR-003
- Severity: P1
- Location: src/App.js, OCSAStaffPortal, patterns `const h = () => { setToken(null); setUser(null); setScreen("login"); };` and `const handleLogout = () => {`.
- What: Neither logout path resets all per-user state. Manual logout leaves issues, assignedTasks, supplies, supplyLogs, channels, messages, activeChannel, and lookups in memory. The session-expired path leaves all of those plus clockStatus, selectedSite, tasks, completedTaskIds, and activeTab.
- Impact: On a shared phone, the next person who logs in and opens Chat sees the previous user's messages immediately, because activeChannel and messages persist and ChatView renders `messages` for any truthy activeChannel. That includes the private Admin DM. The API audit recorded that chat message routes have no access check, so the 12 second poll for the stale channel would keep succeeding. "This Shift's Log" under Supplies shows the previous user's usage lines. After a session expiry, a stale selectedSite is sent by Clock In even when no site is highlighted, so a clock-in can be recorded against a site the new user is not assigned to unless the API rejects it (CR-1). A stale clockStatus can also show the previous user as ON SITE for a moment.
- Evidence:
```
useEffect(() => { const h = () => { setToken(null); setUser(null); setScreen("login"); }; window.addEventListener("ocsa-session-expired", h); ... }, []);
const handleLogout = () => { if (clockStatus?.clockedIn) { showToast("Clock out before logging out", "error"); return; } setToken(null); setUser(null); setSites([]); setScreen("login"); setClockStatus(null); setSelectedSite(null); setTasks([]); setCompletedTaskIds(new Set()); setActiveTab("clock"); };
```
ChatView: `{activeChannel && messages.length === 0 && <div ...>No messages yet.</div>}` followed by `{messages.map((msg, idx) => { ...`
handleClockIn guard passes on any truthy value: `if (!selectedSite) { showToast("Select a site first", "error"); return; }`
- Recommended fix: One `resetSession()` in OCSAStaffPortal that sets every per-user state back to its initial value (token, user, sites, clockStatus, selectedSite, tasks, completedTaskIds, issues, assignedTasks, supplies, supplyLogs, channels, messages, activeChannel, lookups, activeTab, showMore) and screen to "login". Call it from handleLogout after the clocked-in check and from the session-expired handler.
- Effort: S
- Rewrite flag: No

### POR-004

- ID: POR-004
- Severity: P1
- Location: src/App.js, patterns `const submitIssue = async (title, description, zone, severity, photoUrl, siteId) =>`, IssuesView `const handleSubmit = async () =>`, SuppliesView `const handleSubmitReq = () =>`, AssignedTasksView `const handleResolve = async (taskId) =>` and `const handleCantResolve = async (taskId) =>`, and `const resolveAssignedTask = async (taskId, status, note, photoUrl) =>`.
- What: The shared mutation helpers catch their own errors and show a toast without rethrowing, and the callers clear the form unconditionally afterwards. The supply request caller does not even await the helper.
- Impact: On a weak connection a failed issue report loses the title, details, zone, and photo the cleaner just typed and took, with only a 3 second red toast to explain. Same for the supply request form, the resolution note (after its photo already uploaded), and the cannot-resolve reason. If the issue POST succeeds and the photo POST fails, the issue exists without its photo, the toast reads as failure, and a retry creates a duplicate issue.
- Evidence:
```
const submitIssue = async (...) => { ... try { const data = await api("/api/issues", ...); if (photoUrl && data.issue) { await api("/api/issues/" + data.issue.id + "/photos", ...); } showToast("Issue reported"); loadIssues(); } catch (err) { showToast(err.message, "error"); } };
const handleSubmit = async () => { ... await submitIssue(title.trim(), desc.trim(), zone.trim(), sev, photoUrl, siteId); setTitle(""); setDesc(""); setZone(""); setSev("medium"); setPhoto(null); setPhotoPreview(null); setShowForm(false); } catch (err) { ...
const handleSubmitReq = () => { ... submitRequest(reqForm.type, reqForm.itemName, reqForm.description, reqForm.urgency, reqForm.supplyId); setReqForm(null); };
const handleResolve = async (taskId) => { ... const photoUrl = await uploadPhoto(photo, token); await resolveTask(taskId, "resolved", note.trim(), photoUrl); clearForm(); setDetail(null); } catch (err) { ...
const handleCantResolve = async (taskId) => { ... await resolveTask(taskId, "unable_to_resolve", note.trim(), null); clearForm(); setDetail(null); };
const resolveAssignedTask = async (...) => { try { await api("/api/clock/tasks/resolve/" + taskId, ...); showToast(...); loadAssignedTasks(); } catch (err) { showToast(err.message, "error"); } };
```
- Recommended fix: Have submitIssue, submitSupplyRequest, and resolveAssignedTask return true on success and false on failure (keeping their toasts), and make each caller await the result and clear the form only on true. For the issue photo, pass the photo URL in the issue POST body if the API accepts it, otherwise keep the form open with the created issue id so a retry attaches instead of re-creating (CR-13).
- Effort: S
- Rewrite flag: No

### POR-005

- ID: POR-005
- Severity: P1
- Location: src/App.js, ChatView `const handleSend = () => {` and OCSAStaffPortal `const sendMessage = async (channelId, text) =>`.
- What: The input is cleared synchronously right after sendMessage is called, before the POST resolves. sendMessage catches its own error and only toasts.
- Impact: A message that fails to send on a weak connection is gone. The cleaner sees a red toast for 3 seconds and has to retype. Messages to the admin DM about problems on site are the ones most likely to be typed in a basement with one bar of signal.
- Evidence:
```
const handleSend = () => { if (!text.trim() || !activeChannel) return; sendMessage(activeChannel, text.trim()); setText(""); };
const sendMessage = async (channelId, text) => { try { const data = await api("/api/chat/channels/" + channelId + "/messages", { method: "POST", body: { text }, token }); setMessages(prev => [...prev, data.message]); } catch (err) { showToast(err.message, "error"); } };
```
- Recommended fix: Make handleSend async, await sendMessage, have sendMessage return true or false, and clear the input only on success. Disable the send button while the request is in flight, in the existing `disabled={uploading}` pattern.
- Effort: S
- Rewrite flag: No

### POR-006

- ID: POR-006
- Severity: P1
- Location: src/App.js, MyScheduleSection, shift detail modal, patterns `placeholder="Describe the reason"` and `api("/api/pickups/request-drop"`.
- What: When the selected drop reason has show_other_input, the "Specify Reason" text is stored in dropForm.otherText and never sent. The notes field defaults to the reason code when empty. On success the modal just closes with no confirmation, and the Submit Request button has no in-flight guard.
- Impact: A supervisor reviewing a drop request with reason "other" sees the word "other" as the notes and nothing else, the cleaner's explanation is lost. The cleaner cannot tell whether the request went through because success is silent while failure toasts, and a double tap sends two requests.
- Evidence:
```
<input value={detail.dropForm.otherText || ""} onChange={e => setDetail({ ...detail, dropForm: { ...detail.dropForm, otherText: e.target.value } })} placeholder="Describe the reason" style={mkInput(t)} />
...
await api("/api/pickups/request-drop", { method: "POST", body: { scheduled_shift_id: detail.id, reason: detail.dropForm.reason, notes: detail.dropForm.notes || detail.dropForm.reason }, token });
setDetail(null);
loadSchedule();
```
- Recommended fix: Build notes as the other text plus the optional notes, for example `[otherText, notes].filter(Boolean).join(" - ") || null`, send null when both are empty, call `showToast("Drop request sent")` after the await, and hold a `dropping` state that disables the button while in flight.
- Effort: S
- Rewrite flag: No

### POR-007

- ID: POR-007
- Severity: P1
- Location: src/App.js, MyScheduleSection, patterns `const toISO = (d) => d.toISOString().split("T")[0];`, `const isToday = (ds) =>`, `const getActualForDay = (ds) =>`.
- What: Today is computed from the UTC date, and worked shifts are placed by the first ten characters of their UTC clock_in_time. The day columns themselves are local dates. Philadelphia is UTC-4 or UTC-5, so from 8 PM EDT (7 PM EST) onward the UTC date is already tomorrow.
- Impact: Evening cleaners, which is most of the workforce, see tomorrow highlighted as today for the last hours of their shift, and any shift that started after 8 PM EDT appears in the next day's cell in both the week and month views. Hours worked look like they were worked on the wrong day, which is the kind of thing staff take to a supervisor.
- Evidence:
```
const toISO = (d) => d.toISOString().split("T")[0];
...
const isToday = (ds) => ds === toISO(new Date());
...
const getActualForDay = (ds) => data.actual.filter(s => {
  const d = typeof s.clock_in_time === "string" ? s.clock_in_time.slice(0, 10) : s.clock_in_time?.toISOString?.()?.split("T")?.[0];
  return d === ds;
});
```
The columns use local midnight dates (`mon.setHours(0, 0, 0, 0)` then toISO), which is correct for negative UTC offsets, so the columns and the placement disagree.
- Recommended fix: Add a local-date helper next to toISO, for example `const localISO = (d) => { const x = new Date(d); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };`, use it in isToday and in getActualForDay for clock_in_time, and keep toISO for the local-midnight week and month cells. Scheduled and pickup rows use scheduled_date, whose serialization is NV-9.
- Effort: S
- Rewrite flag: No

### POR-008

- ID: POR-008
- Severity: P1
- Location: src/App.js, patterns `catch (err) { console.error(err); }` in loadAssignedTasks, loadTasks, loadIssues, loadSupplies, loadChannels, loadMessages, and `catch (err) { console.error("Schedule load error:", err); }` in MyScheduleSection; TasksView `text="Loading tasks..."`; MyProfileView `Loading profile...`.
- What: Seven read paths swallow errors to the console. The Tasks tab shows "Loading tasks..." whenever the list is empty, which covers both a failed fetch and a site with no standard tasks. The schedule grid shows "-" in every day on failure, identical to a week with no shifts. The profile view shows "Loading profile..." with no retry after its fetch fails.
- Impact: On a weak connection a cleaner sees an empty checklist labelled as loading, or a schedule that says they have no shifts, with no message and no retry other than switching tabs. The assigned-task badge silently stays stale. This is the reliability bar the standard names.
- Evidence:
```
const loadAssignedTasks = useCallback(async (tkn) => { try { ... } catch (err) { console.error(err); } }, [token]);
const loadTasks = async () => { ... } catch (err) { console.error(err); } };
const loadIssues = async () => { try { ... } catch (err) { console.error(err); } };
const loadSupplies = async () => { try { ... } catch (err) { console.error(err); } };
const loadChannels = async () => { try { ... } catch (err) { console.error(err); } };
const loadMessages = async (channelId) => { try { ... } catch (err) { console.error(err); } };
...
} catch (err) { console.error("Schedule load error:", err); }
...
if (standardTasks.length === 0) return <EmptyState icon={CheckIco} text="Loading tasks..." t={t} />;
...
{!hasAny && <div style={{ fontSize: 10, color: t.textMut, opacity: 0.3, textAlign: "center", marginTop: 8 }}>-</div>}
...
if (!profile) return <div style={{ padding: 20, textAlign: "center", color: t.textMut }}>Loading profile...</div>;
```
- Recommended fix: Replace each console-only catch with `showToast(err.message, "error")` (the existing pattern in PickupView and InspectView), and give TasksView and MyScheduleSection a small `loadError` state rendered through EmptyState with the text "Could not load. Tap to retry." and an onClick that calls the loader. Track a `tasksLoaded` flag so an empty checklist reads "No tasks for this site" instead of "Loading tasks...".
- Effort: M
- Rewrite flag: No

### POR-009

- ID: POR-009
- Severity: P1
- Location: src/App.js, `async function api(path, opts = {})`, the three upload helpers, and ClockView `disabled={loading}`.
- What: No request carries an AbortController signal or a timeout. A request that stalls on a dropped connection never settles, so `loading` never clears.
- Impact: The Clock In or Clock Out button shows "..." and stays disabled with no way to retry. Because the token lives only in memory (POR-013), the only way out is a reload, which forces a new PIN login. The same stall freezes Sign In, issue submit, and photo uploads.
- Evidence:
```
const res = await fetch(API + path, { ...opts, headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
...
<button onClick={ci ? onClockOut : onClockIn} disabled={loading} ...>{loading ? "..." : ci ? "Clock Out" : "Clock In"}</button>
```
grep for AbortController and signal returns nothing.
- Recommended fix: In api() and the three upload helpers create `const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 20000);`, pass `signal: ctl.signal`, clear the timer in a finally, and map AbortError to "Connection timed out. Check your signal and try again." Use a longer limit (60 s) for uploads.
- Effort: S
- Rewrite flag: No

### POR-010

- ID: POR-010
- Severity: P1
- Location: src/App.js, `const handleClockIn = async () =>` and `const handleClockOut = async () =>`.
- What: Both handlers only update state on the success path. If the POST reached the server but the response was lost, or the follow-up status GET failed, the UI keeps the old state and shows a red toast. Clock out also replaces the status with a hand-built object instead of refetching.
- Impact: A cleaner whose clock-in was recorded sees "Failed to fetch" and the Clock In button again. Tapping it again produces an "already clocked in" error from the API, and the portal still shows them as off site until they log out and in. The reverse happens on clock out. The user cannot tell sent from failed in exactly the case the brief asks about.
- Evidence:
```
try { await api("/api/clock/in", { method: "POST", body: { siteId: selectedSite }, token }); const cs = await api("/api/clock/status", { token }); setClockStatus(cs); showToast("Clocked in at " + formatTime(now())); } catch (err) { showToast(err.message, "error"); }
...
try { const data = await api("/api/clock/out", { method: "POST", body: {}, token }); setClockStatus({ clockedIn: false, shift: null, tasks: { total: 0, completed: 0 } }); ... showToast("Clocked out. Duration: " + data.shiftRecord.duration_minutes + " minutes"); } catch (err) { showToast(err.message, "error"); }
```
- Recommended fix: Extract `refreshStatus()` that GETs /api/clock/status and sets state, call it after both POSTs and also inside both catch blocks before the toast (wrapped in its own try so a second failure still toasts). Then the UI converges on the server's truth after any outcome.
- Effort: S
- Rewrite flag: No

### POR-011

- ID: POR-011
- Severity: P1
- Location: src/App.js, TasksView patterns `<span style={chipCat}>{task.cims_category}</span>` and `<span style={chipCat}>{detail.cims_category}</span>`; InspectView patterns `const CIMS_C = {` and `{item.cims_category}</div>`.
- What: The certification framework category code (SD, HSE, GB, QS, HR, MC) is rendered as a chip on every checklist row, in the task detail header, and as a colored badge on every inspection item. The standard says internal category codes are backend only and must never render.
- Impact: Every cleaner sees the codes on every shift, and every inspector sees them on every item. This is the one hard-convention violation in the portal and it is on the most-used screen.
- Evidence:
```
<div style={{ display: "flex", gap: 4, flexShrink: 0, marginTop: 2 }}>{task.priority === "high" && <span style={chipPriority}>PRIORITY</span>}<span style={chipCat}>{task.cims_category}</span></div>
...
{detail.priority === "high" && <span style={chipPriority}>PRIORITY</span>}<span style={chipCat}>{detail.cims_category}</span>
...
const CIMS_C = { SD: "#3498DB", HSE: "#F39C12", GB: "#2ECC71", QS: GOLD, HR: "#9B59B6", MC: "#2C3E50" };
...
<div style={{ ... background: (CIMS_C[item.cims_category] || BLUE) + "1A", ... color: CIMS_C[item.cims_category] || BLUE, ... }}>{item.cims_category}</div>
```
- Recommended fix: Remove the two chipCat spans and the inspection badge, and delete CIMS_C. If a category label is wanted later, render a plain-language label from /api/lookups/all. The code itself stays off the screen. Ask the API to stop sending cims_category to portal responses (CR-10).
- Effort: S
- Rewrite flag: No

### POR-012

- ID: POR-012
- Severity: P1
- Location: src/App.js, MyProfileView, patterns `const startEditing = () => {` and `await api("/api/users/profile/me", { method: "PATCH", body: form, token });`.
- What: The edit form initializes every unset field to "" and the save sends the form object as-is. Birthday is a date column and receives "" whenever the user has not set one or clears it. Every text field also goes up as "" instead of null, against the platform's null rule recorded in the roadmap.
- Impact: Saving any profile change on an account without a birthday sends `birthday: ""`. Depending on the API's coercion (the API audit found empty-string gaps in seven route files) that is a 500, a rejected save, or an empty string stored in a typed column. Text columns fill with empty strings that the admin then has to treat as "not set".
- Evidence:
```
setForm({
  birthday: u.birthday ? (typeof u.birthday === "string" ? u.birthday.split("T")[0] : "") : "",
  addressLine1: u.addressLine1 || "", addressLine2: u.addressLine2 || "",
  city: u.city || "", state: u.state || "", zipCode: u.zipCode || "",
  emergencyContactName: u.emergencyContactName || "", emergencyContactPhone: u.emergencyContactPhone || "",
  preferredLanguage: u.preferredLanguage || "English", personalNotes: u.personalNotes || ""
});
...
await api("/api/users/profile/me", { method: "PATCH", body: form, token });
```
- Recommended fix: Build the PATCH body with empty strings mapped to null: `const body = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, typeof v === "string" && v.trim() === "" ? null : v]));`. This matches the "empty select sends null" rule already applied to employment type in the admin. The API should also coerce (CR-5).
- Effort: S
- Rewrite flag: No

### POR-013

- ID: POR-013
- Severity: P2
- Location: src/App.js, `const [token, setToken] = useState(null);` and the session-expired effect; public/index.html `apple-mobile-web-app-capable`.
- What: The token exists only in React state. There is no persistence, no boot-time restore, and no refresh on visibility change.
- Impact: Backgrounded and reopened mid-shift: if the browser kept the page alive, everything continues, but the clock status is never refreshed on resume, so an admin-side clock-out or shift close is invisible until the next action fails. If the OS evicted the page, which is routine on a low-memory phone and on every relaunch of the home-screen app the index.html asks for, the cleaner is back at the PIN screen. The shift itself is restored from the server after login, the checklist state is lost (POR-002).
- Evidence:
```
const [token, setToken] = useState(null);
...
<meta name="apple-mobile-web-app-capable" content="yes" />
```
grep for visibilitychange returns nothing.
- Recommended fix: On login store the token under a portal-specific key such as `ocsa-staff-token` (never reuse ocsa_qr_token), on boot read it and run the same /api/auth/me and /api/clock/status sequence before showing main, clear it in resetSession (POR-003). Add a visibilitychange listener that refetches /api/clock/status when the page becomes visible while logged in. Decision for Ibrahim: sessionStorage survives reloads in the same tab only and is the safer default on shared phones; localStorage survives home-screen relaunches and keeps a session open until logout or token expiry.
- Effort: S
- Rewrite flag: No

### POR-014

- ID: POR-014
- Severity: P2
- Location: src/App.js, `async function api(path, opts = {})`, `const showToast = useCallback(`, the session-expired effect, and every `showToast(err.message, "error")`.
- What: Network failures surface as the browser's TypeError text ("Failed to fetch", "Load failed" on Safari). A 401 during a background load drops the user to the login screen with no message because the loader's catch is console-only. Toasts are cleared by a fixed 3 second timer that is never cancelled, so a second toast is cut short by the first one's timer.
- Impact: Cleaners see developer wording for the most common failure, get logged out with no explanation, and miss error text that disappears in under 3 seconds when two toasts overlap (the supplies low-stock alert always triggers this).
- Evidence:
```
if (res.status === 401) { window.dispatchEvent(new Event("ocsa-session-expired")); throw new Error("Session expired"); }
if (!res.ok) { const err = await res.json().catch(() => ({ error: "Request failed" })); throw new Error(err.error || "Request failed"); }
...
const showToast = useCallback((msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); }, []);
...
const h = () => { setToken(null); setUser(null); setScreen("login"); };
...
showToast(data.message); ... if (data.lowStockAlert) showToast("Low stock alert!", "error");
```
- Recommended fix: In api() wrap fetch in try/catch and rethrow TypeError as "No connection. Check your signal and try again." In the session-expired handler call showToast("Your session ended. Sign in again.", "error"). Keep the toast timer in a useRef and clearTimeout it before setting a new one; give error toasts 5 seconds.
- Effort: S
- Rewrite flag: No

### POR-015

- ID: POR-015
- Severity: P2
- Location: src/App.js, IssuesView `const [sev, setSev] = useState("medium");`, SuppliesView `urgency: "normal"`, MyScheduleSection `dropForm: { reason: "sick", notes: "" }`.
- What: Three controls take their option lists from /api/lookups/all and keep hardcoded default values. If the lookup values differ from the hardcoded ones, no option appears selected and the hardcoded value is what gets submitted.
- Impact: A severity, urgency, or drop reason that is not in the lookup table reaches the API, which either rejects it (a confusing error to the cleaner) or stores a value the admin filters cannot see.
- Evidence:
```
const [sev, setSev] = useState("medium"); ...
const sevs = sevOpts.length > 0 ? sevOpts.map(o => ({ v: o.v, l: o.l, c: sevColors[o.v] || ORANGE })) : [{ v: "low", l: "Low", c: GREEN }, { v: "medium", l: "Med", c: ORANGE }, { v: "high", l: "High", c: RED }];
...
setReqForm({ type: "", itemName: "", description: "", urgency: "normal", supplyId: null })
...
setDetail({ ...detail, dropForm: { reason: "sick", notes: "" } })
```
- Recommended fix: Default each control to the first option of its resolved list, for example `useState(sevs[0]?.v || "medium")` computed after sevs, `urgency: urgItems[0]?.v || "normal"`, and `reason: dropOpts[0]?.v || "sick"`.
- Effort: S
- Rewrite flag: No

### POR-016

- ID: POR-016
- Severity: P2
- Location: src/App.js, RegisterScreen `onClick={() => { if (pin !== pin2) return; onRegister(fn, ln, ph, em, pin); }}`, LoginScreen `onKeyDown={e => e.key === "Enter" && onLogin(phone, pin)}`.
- What: A PIN mismatch on registration returns silently. Fields marked with * are not checked before submit, nor is the PIN checked for four digits, so "" values go to the API and the error comes back as raw API text. On login the Enter key handler ignores the loading flag that disables the button, so Enter twice sends two login requests.
- Impact: A new employee taps Register and nothing happens, with no hint that the PINs differ. Required-field errors are worded by the API. Double login requests are harmless today but will count twice against the planned login rate limiter.
- Evidence:
```
<button onClick={() => { if (pin !== pin2) return; onRegister(fn, ln, ph, em, pin); }} disabled={loading} ...>
...
<label style={labelSt}>Phone Number *</label>
...
<input value={pin} onChange={e => setPin(e.target.value)} placeholder="4-digit PIN" type="password" maxLength={4} ... onKeyDown={e => e.key === "Enter" && onLogin(phone, pin)} />
```
- Recommended fix: In RegisterScreen validate before calling onRegister: first name, phone, email, and a `/^\d{4}$/` PIN, with `showToast(..., "error")` for each (pass showToast in, as LoginScreen already receives it), and toast "PINs do not match". Use `inputMode="numeric"` and `pattern="[0-9]*"` on both PIN inputs. Guard both Enter handlers with `!loading`.
- Effort: S
- Rewrite flag: No

### POR-017

- ID: POR-017
- Severity: P2
- Location: src/App.js, `async function uploadPhoto(file, token)`, `async function uploadTaskMedia(file, token)`, AssignedTasksView `const photoUrl = await uploadPhoto(photo, token);`, MyProfileView `const compressed = await compressImage(file, 800, 0.85);`.
- What: Issue photos, task completion photos, and inspection photos are uploaded as the raw camera file up to 10 MB. compressImage exists and is used only for the profile photo. Task completion photos are sent through uploadPhoto, so they land in the issue-photos bucket rather than task-media.
- Impact: A 6 to 10 MB phone photo over one bar of signal is the single slowest and most failure-prone action in the app, and it sits in front of two required flows (resolving an assigned task requires a photo). Task evidence photos stored under issue-photos will complicate the planned dual-resolution storage and any per-bucket retention.
- Evidence:
```
const res = await fetch(API + "/api/uploads?bucket=issue-photos&ext=" + encodeURIComponent(ext), { method: "POST", headers: { "Authorization": "Bearer " + token, "Content-Type": file.type }, body: file, });
...
if (file.size > 10 * 1024 * 1024) { showToast("Photo must be under 10MB", "error"); return; }
...
const photoUrl = await uploadPhoto(photo, token); await resolveTask(taskId, "resolved", note.trim(), photoUrl);
```
- Recommended fix: Run compressImage(file, 1600, 0.8) inside uploadPhoto and uploadTaskMedia for image types (send the result with ext jpg and Content-Type image/jpeg), and switch handleResolve to uploadTaskMedia. This also sidesteps the empty file.type case (NV-11).
- Effort: S
- Rewrite flag: No

### POR-018

- ID: POR-018
- Severity: P2
- Location: src/App.js, `const loadIssues = async () =>`, IssuesView `const visibleIssues = isAdmin ? issues : issues.filter(i => i.reported_by === user?.id);`, and `{isAdmin && visibleIssues.map(`.
- What: The Issues tab fetches /api/issues?limit=20 for every role, filters to the caller's own issues client-side for non-admins, and then never renders the list for non-admins at all.
- Impact: Every cleaner who opens Report downloads the 20 most recent issues across all sites and all staff, visible in the browser's network panel, for a list the screen never shows. The client-side filter is dead code that hides the exposure.
- Evidence:
```
const loadIssues = async () => { try { const data = await api("/api/issues?limit=20", { token }); setIssues(data); } catch (err) { console.error(err); } };
...
useEffect(() => { ... if (activeTab === "issues") loadIssues(); ... }, [activeTab, clockStatus?.clockedIn]);
...
const visibleIssues = isAdmin ? issues : issues.filter(i => i.reported_by === user?.id);
...
{isAdmin && visibleIssues.map(issue => { ...
```
- Recommended fix: Call loadIssues only when isAdmin (`if (activeTab === "issues" && isAdmin) loadIssues();`) and drop the visibleIssues filter. The API should scope the list by role regardless (CR-2).
- Effort: S
- Rewrite flag: No

### POR-019

- ID: POR-019
- Severity: P2
- Location: src/App.js, MyProfileView `preferredLanguage: u.preferredLanguage || "English", personalNotes: u.personalNotes || ""` and `body: form`.
- What: personalNotes is loaded into the edit form and sent back on save, and is never displayed or editable. Those are its only two references in the file.
- Impact: If personalNotes is an admin-facing note about the employee, the portal exposes it in the profile response and overwrites any admin edit made between the cleaner opening the form and saving it, with the stale value. If it is the employee's own field, it still cannot be edited here and still round-trips stale.
- Evidence:
```
preferredLanguage: u.preferredLanguage || "English", personalNotes: u.personalNotes || ""
...
await api("/api/users/profile/me", { method: "PATCH", body: form, token });
```
- Recommended fix: Remove personalNotes from the form object so the PATCH never carries it. Confirm the field's owner (NV-5) and, if it is admin-only, remove it from the /api/users/profile/me response (CR-4).
- Effort: S
- Rewrite flag: No

### POR-020

- ID: POR-020
- Severity: P2
- Location: src/App.js, InspectView `const openInspection = async (id) =>`, the back button `onClick={() => setActive(null)}`, and `score: parseInt(scores[item.id]) || 0`.
- What: Every item starts at score 0, an unscored item is indistinguishable from a scored 0, and the "<" button (a 20 px glyph with 4 px padding) discards all scores and notes with no confirmation.
- Impact: An inspector who skips an item submits a 0 that drags the site's score down in the reports the roadmap is trying to fix. A mis-tap on the small back button during a 30-item walk-through loses the whole inspection.
- Evidence:
```
(d.items || []).forEach(item => { initScores[item.id] = 0; initNotes[item.id] = ""; });
...
<button onClick={() => setActive(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: t.textSec, fontSize: 20, lineHeight: 1 }}>{"<"}</button>
...
score: parseInt(scores[item.id]) || 0,
```
- Recommended fix: Initialize scores to null, show "Not scored" until the slider is touched, block submit while any item is null (toast naming how many remain), and on back ask "Discard this inspection?" using an inline confirm panel in the existing pattern. Widen the back button to the 44 px minimum used by the profile button.
- Effort: M
- Rewrite flag: No

### POR-021

- ID: POR-021
- Severity: P2
- Location: src/App.js, `const toggleTask = async (taskId) =>`, MyScheduleSection drop `onClick={async () => {`, AssignedTasksView `onClick={() => handleCantResolve(detail.task_id)}`, PickupView `const releaseShift = async (id) =>`.
- What: The issue submit, resolve, claim, and inspection submit buttons use a `disabled` flag while in flight, and these four paths do not. toggleTask reads completedTaskIds before the await, so two quick taps both take the POST branch.
- Impact: A double tap on a checklist row sends two completion POSTs (duplicate completions or an error toast for the second), a double tap on Submit Request sends two drop requests, and cannot-resolve and release can be sent twice.
- Evidence:
```
const toggleTask = async (taskId) => { try { if (completedTaskIds.has(taskId)) { await api(... "DELETE" ...); ... } else { await api(... "POST" ...); setCompletedTaskIds(prev => new Set(prev).add(taskId)); ...
...
<button onClick={async () => { try { await api("/api/pickups/request-drop", ...
...
<button onClick={() => handleCantResolve(detail.task_id)} style={{ ... }}>Submit</button>
```
- Recommended fix: A `pendingTaskIds` Set (or a ref) checked at the top of toggleTask and cleared in finally, and a `busy` boolean with `disabled={busy}` on the other three buttons, matching the existing `disabled={uploading}` pattern.
- Effort: S
- Rewrite flag: No

### POR-022

- ID: POR-022
- Severity: P2
- Location: package-lock.json, pattern `"node_modules/typescript"` with `"version": "6.0.3"`; package.json `"react-scripts": "5.0.1"`.
- What: The committed lockfile does not satisfy the dependency tree. `npm ci` refuses to install ("lock file's typescript@6.0.3 does not satisfy typescript@4.9.5"). `npm install` succeeds by rewriting that one entry to 4.9.5, which means every install on a fresh machine mutates the lockfile.
- Impact: The build is not reproducible from the lockfile, and any future Claude Code session that runs npm install will produce a lockfile diff in a PR that was meant to touch only App.js, against the roadmap's no-lockfile-changes rule. Whether Vercel uses npm ci or npm install is NV-7; if it ever switches to npm ci, deploys fail.
- Evidence (from the verification run, on a scratch copy):
```
npm error `npm ci` can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync.
npm error Invalid: lock file's typescript@6.0.3 does not satisfy typescript@4.9.5
```
npm install in the scratch copy changed only that entry (`"version": "6.0.3"` to `"version": "4.9.5"`, 12 diff lines) and the build then compiled successfully with no warnings, 125.44 kB gzipped.
- Recommended fix: One dedicated commit that runs `npm install` and commits the regenerated package-lock.json with no other change, then keep `npm ci` as the install step everywhere so drift is caught.
- Effort: S
- Rewrite flag: No

### POR-023

- ID: POR-023
- Severity: P2
- Location: package.json `"scripts": { "start": "react-scripts start", "build": "react-scripts build" }`; no files match *.test.*, *.spec.*, or setupTests*; no .github directory.
- What: There are no tests, no test script, no testing library, and no CI. The build is the only gate, and it checks syntax and lint. Behavior goes unchecked.
- Impact: The clock-in and checklist flows, which record hours and completions for payroll and reports, have no regression protection, and the fixes in this register (POR-002, POR-004, POR-005, POR-010) are exactly the kind of async state changes that break silently.
- Evidence:
```
"scripts": {
  "start": "react-scripts start",
  "build": "react-scripts build"
},
```
`find . -path ./node_modules -prune -o -name "*.test.*" -print` returns nothing.
- Recommended fix: Minimum baseline with no new runtime dependencies: add `"test": "react-scripts test --watchAll=false"` (jest ships with react-scripts) and devDependencies @testing-library/react, @testing-library/jest-dom, @testing-library/user-event. Two tests against the root component with `global.fetch` mocked per URL: (1) clock-in flow, login with phone and PIN, select a site, tap Clock In, assert the POST body is `{ siteId }` and the Time on Site card renders, then assert a rejected POST leaves the Clock In button and shows the error toast; (2) checklist flow, clock in, load tasks, tap a task, assert POST to /complete and the checked state, tap again, assert DELETE, and assert a failed POST leaves the box unchecked. Add unit tests for groupTasksByFloorZone and the local-date helper from POR-007. Splitting App.js into modules for direct component tests would carry a Yes rewrite flag; it is recorded here and not recommended now.
- Effort: M
- Rewrite flag: No

### POR-024

- ID: POR-024
- Severity: P3
- Location: src/App.js, TasksView `Time: <span ...>{detail.due_time}</span>`, AssignedTasksView `" at " + detail.due_time` and `" at " + task.due_time`, MyProfileView `a.shift_start + " - " + a.shift_end`.
- What: Four places print time-of-day fields raw from the API, which arrive as 24-hour HH:MM:SS. Every other clock in the portal is 12-hour with AM and PM. The roadmap calls for 12-hour everywhere.
- Impact: A due time reads "17:30:00" on the same screen where the clock reads "5:30 PM".
- Evidence:
```
{detail.due_time && <div style={{ fontSize: 11, color: t.textMut }}>Time: <span style={{ color: t.text, fontWeight: 500 }}>{detail.due_time}</span></div>}
...
{detail.due_time ? " at " + detail.due_time : ""}
...
{task.due_time ? " at " + task.due_time : ""}
...
{a.shift_start ? " | " + a.shift_start + " - " + a.shift_end : ""}
```
- Recommended fix: Hoist MyScheduleSection's fmtTm to module scope next to formatTime and apply it in the four places. Rides along with the first portal batch per the roadmap.
- Effort: S
- Rewrite flag: No

### POR-025

- ID: POR-025
- Severity: P3
- Location: src/App.js, every JSX string literal; `toLocaleTimeString("en-US"` and `toLocaleDateString("en-US"` (12 calls); `const dayNames = ["Mon", "Tue", ...]`; fallback option arrays in getOpts callers; MyProfileView `preferredLanguage: u.preferredLanguage || "English"` with a free-text input.
- What: All user-facing text is inline English, dates and times are pinned to en-US, and the preferred language is a free-text field, with no lookup-driven select. Recorded for the planned English, Spanish, French toggle.
- Impact: The multi-language pass has to touch every component; the free-text language field cannot drive the toggle.
- Evidence:
```
const formatTime = (d) => new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
...
const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
...
<input value={form.preferredLanguage || ""} onChange={e => setForm({ ...form, preferredLanguage: e.target.value })} style={inputSt} />
```
- Recommended fix: When the language pass is scoped, introduce a single `L(key)` lookup with the three dictionaries, pass the locale into formatTime and formatDate, and turn preferredLanguage into a select over the three supported values. No change now.
- Effort: L
- Rewrite flag: No

### POR-026

- ID: POR-026
- Severity: P3
- Location: public/index.html `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />`; src/App.js ChatView `height: "calc(100vh - 128px)"`; bottom nav `padding: "8px 0 12px"`.
- What: Pinch zoom is disabled, the chat panel is sized from 100vh (which on mobile Safari and Chrome includes the collapsed browser toolbar), and neither the bottom nav nor the header pads for safe-area insets while the page asks to run as a home-screen app with a translucent status bar.
- Impact: The chat input can sit under the browser toolbar until the page is scrolled; the home indicator overlaps the nav on iPhones in standalone mode and the header buttons may sit under the status bar (NV-8). Zoom lock is an accessibility complaint waiting to happen. None of this blocks a shift.
- Evidence:
```
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
...
<div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 128px)" }}>
...
<div style={{ position: "fixed", bottom: 0, ... padding: "8px 0 12px", zIndex: 100, ... }}>
```
- Recommended fix: In the responsive pass: drop maximum-scale and user-scalable, use `100dvh` with a 100vh fallback for the chat panel, add `viewport-fit=cover` plus `env(safe-area-inset-bottom)` on the nav and `env(safe-area-inset-top)` on the header.
- Effort: S
- Rewrite flag: No

### POR-027

- ID: POR-027
- Severity: P3
- Location: src/App.js, `fontSize: 7`, `fontSize: 8`, `fontSize: 9` (1, 9, and 48 occurrences); TasksView checkbox `width: 22, height: 22`; InspectView back button `fontSize: 20, lineHeight: 1` with `padding: 4`; MyScheduleSection `gridTemplateColumns: "repeat(7, 1fr)"` in compact mode; header icon buttons with no aria-label (grep for aria- returns 0).
- What: 58 text runs render at 9 px or smaller, including the schedule entries (9 px times, 8 px site names, 7 px pickup status) squeezed into a 7-column grid that is about 40 px per column on a 360 px phone. The checklist checkbox is 22 px; the row text is also tappable, which is why this stays P3. The theme, logout, and inspection back buttons are under 30 px. Icon-only buttons have no accessible name.
- Impact: Schedule text is unreadable on a phone without zoom (which POR-026 disables); the small targets cause mis-taps; screen readers announce unlabeled buttons.
- Evidence:
```
{fmtTm(p.start_time)} <span style={{ fontSize: 7, textTransform: "uppercase" }}>{p.status === "approved" ? "approved" : "claimed"}</span>
...
<button onClick={() => toggleTask(task.id)} style={{ width: 22, height: 22, ...
...
<button onClick={handleLogout} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><LogOutIco sz={18} c="#8899AA" /></button>
```
- Recommended fix: In the responsive pass: raise the floor to 11 px for anything a cleaner reads, show the compact week as a vertical list of the next 3 days instead of 7 columns, make every button at least 44 px on its shortest side (minWidth and minHeight, as the profile button already does), and add aria-label to the icon-only buttons.
- Effort: M
- Rewrite flag: No

### POR-028

- ID: POR-028
- Severity: P3
- Location: src/App.js, IssuesView `accept="image/*" capture="environment"` next to the button text "Take Photo or Choose from Gallery"; PickupView `window.confirm("Release this shift? ...")`; PickupView `showToast("Shift claimed (overtime warning: ...", "error")`.
- What: The issue photo input forces the rear camera on phones while its label promises a gallery choice. The release action uses the browser's confirm dialog while every other confirmation in the app is an inline panel. A successful claim with an overtime warning is shown as a red error toast.
- Impact: A cleaner who photographed the problem a minute ago cannot pick it from the gallery; the confirm dialog looks foreign in standalone mode; a successful claim reads as a failure.
- Evidence:
```
<input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: "none" }} />{!photoPreview ? (<button ...><div>Take Photo or Choose from Gallery</div>
...
if (!window.confirm("Release this shift? It will go back to the open pool for someone else to claim.")) return;
...
showToast("Shift claimed (overtime warning: " + Math.round(result.weekly_minutes / 60) + "h this week)", "error");
```
- Recommended fix: Drop `capture` on the issue photo input (keep it on the completion photo where a fresh photo is the point), replace window.confirm with an inline confirm panel in the drop-request pattern, and add a third toast type or use the success color with the warning text.
- Effort: S
- Rewrite flag: No

### POR-029

- ID: POR-029
- Severity: P3
- Location: src/App.js `const LOGO_SM = "data:image/png;base64,` (16,825 bytes) and `const LOGO_LG = "data:image/png;base64,` (48,505 bytes); `const API = process.env.REACT_APP_API_URL || "https://ocsa-api-production.up.railway.app";`; public/index.html `<title>OCSA Staff Portal</title>`; src/clientConfig.js fields company.name, brandTag, location, confidentialLabel, footerLine, employee.idPrefix.
- What: Two logos are inlined as base64 (65 KB of the 223 KB file), the production API URL is a fallback literal in App.js, the page title is hardcoded, and six clientConfig fields are defined and never read (only brand.gold, brand.navy, brand.navyDark, and company.shortName are used). CLAUDE.md says branding comes from the API settings endpoint and no new client literals go in App.js.
- Impact: Templating this portal for another client means editing App.js and index.html; the dead config fields suggest a migration that stopped halfway.
- Evidence:
```
const API = process.env.REACT_APP_API_URL || "https://ocsa-api-production.up.railway.app";
...
<title>OCSA Staff Portal</title>
```
grep for `clientConfig.` in App.js matches only `clientConfig.brand.gold`, `clientConfig.brand.navy`, `clientConfig.brand.navyDark`, and `clientConfig.company.shortName` (twice).
- Recommended fix: Move the API fallback into clientConfig (or require the env var and fail loudly), move the logos to public/ or to the settings endpoint's branding payload, set document.title from clientConfig at boot, and delete the unused clientConfig fields or start using them.
- Effort: S
- Rewrite flag: No

### POR-030

- ID: POR-030
- Severity: P3
- Location: src/App.js, TasksView `Clock in to check off tasks. You can view your task list below.` with `standardTasks.length === 0 ? <EmptyState ... text="No tasks loaded. ..."`; LoginScreen `Connected to Live API`; SuppliesView the `QR` tile and `scanMethod: "manual"`; IssuesView `visibleIssues`; MyProfileView comment `// Compress to 512x512 max, JPEG quality 80%` above `compressImage(file, 800, 0.85)`; MyScheduleSection `const now = new Date();` shadowing the module `const now = () => new Date();`; compressImage `img.src = URL.createObjectURL(file);` never revoked; PickupView two mount effects both loading.
- What: Dead paths and misleading copy. The pre-clock-in task list can never render because handleClockOut clears tasks and loadTasks requires a shift, so the copy promises a list that never appears. "Connected to Live API" is static text. The "QR" tile and qr_code text imply scanning but the portal has no scanner and always sends scanMethod manual. The visibleIssues filter is unused for non-admins. The comment describes different numbers from the code. `now` is shadowed. The object URL leaks per photo. PickupView calls loadAvailable and loadMyPickups on mount and then again from the tab effect.
- Impact: Maintenance confusion and wasted requests; the copy tells a cleaner to expect something the app does not do.
- Evidence:
```
<div style={{ fontSize: 12, color: ORANGE }}>Clock in to check off tasks. You can view your task list below.</div></div>
{standardTasks.length === 0 ? <EmptyState icon={CheckIco} text="No tasks loaded. Clock in to a site to see your checklist." t={t} /> : ...
...
setTasks([]); setCompletedTaskIds(new Set()); setSelectedSite(null); showToast("Clocked out. ...
...
// Compress to 512x512 max, JPEG quality 80%
const compressed = await compressImage(file, 800, 0.85);
...
useEffect(() => { loadAvailable(); loadMyPickups(); }, []);
useEffect(() => { if (tab === "available") loadAvailable(); else loadMyPickups(); }, [tab]);
```
- Recommended fix: Change the pre-clock-in copy to "Clock in to a site to load your checklist." and delete the unreachable list branch, delete the "Connected to Live API" line (with POR-001), relabel the QR tile as a plain item icon until a scanner exists, delete visibleIssues (with POR-018), fix the comment, rename the local `now` variables, call URL.revokeObjectURL in the image onload, and drop the mount effect in PickupView.
- Effort: S
- Rewrite flag: No

### POR-031

- ID: POR-031
- Severity: P3
- Location: src/App.js, `async function uploadPhoto` and `async function uploadTaskMedia`; `const fmtDate =` (three definitions) and `const fmtTm =` (two definitions); the inline style `fontSize: 9, color: GOLD, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700` (19 copies) beside `const mkLabel = (t) =>`; `const isAdmin = user?.role === "admin" || user?.role === "supervisor";` beside InspectView `const isManager = user?.role === "admin" || user?.role === "supervisor" || user?.role === "custodial_lead";`.
- What: Two upload helpers differ only by bucket and return shape, date and time formatters are redefined per component with different behavior, a gold section label style is hand-copied 19 times instead of using mkLabel, and the management role check is defined twice with different membership.
- Impact: Each future fix lands in several places or in the wrong one; custodial leads can schedule inspections while the Issues list view stays hidden from them, which is either intended or an accident nobody can tell from the code.
- Evidence:
```
async function uploadPhoto(file, token) { ... "/api/uploads?bucket=issue-photos&ext=" ... return data.url; }
async function uploadTaskMedia(file, token) { ... "/api/uploads?bucket=task-media&ext=" ... return res.json(); }
...
const isAdmin = user?.role === "admin" || user?.role === "supervisor";
...
const isManager = user?.role === "admin" || user?.role === "supervisor" || user?.role === "custodial_lead";
```
- Recommended fix: One `uploadFile(file, token, bucket)` returning the JSON, module-level fmtDate and fmtTm next to formatTime, a `mkSubLabel(t)` helper for the 9 px gold labels, and a single `MANAGEMENT_ROLES` set used by both checks, with Ibrahim confirming whether custodial_lead belongs in it.
- Effort: S
- Rewrite flag: No

### POR-032

- ID: POR-032
- Severity: P3
- Location: package.json `"react-scripts": "5.0.1"`; no .github directory; CLAUDE.md "Build, the real check: npm run build must pass with no errors."
- What: The toolchain is Create React App 5.0.1, which has had no release since 2022 and is no longer maintained. There is no CI, so the build gate runs only when a person runs it or when Vercel builds. The verification build compiled with zero lint warnings, so the code is clean against the react-app ESLint config today.
- Impact: Dependency vulnerabilities in the CRA tree accumulate with no upgrade path, and a warning introduced later would only be caught at deploy time (NV-7 on whether Vercel's CI flag turns warnings into failures).
- Evidence:
```
"react-scripts": "5.0.1"
```
Verification build output: `Compiled successfully.` and `125.44 kB  build/static/js/main.ea145601.js`.
- Recommended fix: No action in the fix batches. Record a Vite migration as a later maintainability item (would carry a Yes rewrite flag when scoped). Add a GitHub Actions workflow that runs npm ci and CI=true npm run build on pull requests, so drift and warnings fail before Vercel.
- Effort: S for the workflow
- Rewrite flag: No

### POR-033

- ID: POR-033
- Severity: P3
- Location: src/App.js, `const handleLogin = async (phone, pin) =>`.
- What: Login is three sequential round trips (login, me, status) plus three background calls, and setToken runs before the later awaits. A failure on me or status leaves the token in state and the user on the login screen with a raw error. The profile fetch exists only to pick up the photo URL.
- Impact: Sign-in takes three round trips on a slow link, a partial failure shows a confusing state, and the extra call is one more thing to fail.
- Evidence:
```
const data = await api("/api/auth/login", { method: "POST", body: { phone, pin } });
setToken(data.token);
const me = await api("/api/auth/me", { token: data.token });
setUser(me.user); setSites(me.sites);
api("/api/users/profile/me", { token: data.token }).then(p => { if (p?.user?.profilePhotoUrl) setUser(prev => ({ ...prev, profilePhotoUrl: p.user.profilePhotoUrl })); }).catch(() => {});
const cs = await api("/api/clock/status", { token: data.token });
```
- Recommended fix: Run me and status with Promise.all, call setToken only after both resolve, and ask the API to include profilePhotoUrl in /api/auth/me (CR-4, NV-10) so the extra call goes away.
- Effort: S
- Rewrite flag: No

## Needs Verification

- NV-1. Login failure status. If POST /api/auth/login returns 401 for a wrong PIN, api() dispatches ocsa-session-expired and the user sees "Session expired" instead of the API's message. Check the route; if it is 401, skip the session-expired dispatch when `!opts.token`.
- NV-2. DELETE /api/clock/tasks/:id/complete response body. api() calls res.json() unconditionally, so a 204 or empty body throws after the server succeeded and the box stays checked. If the route returns 204, make api() return null on 204 or empty content-length.
- NV-3. POST /api/clock/out response shape. The toast reads data.shiftRecord.duration_minutes; if shiftRecord is absent the toast line throws inside the try, the clock-out has already applied, and the user sees an error.
- NV-4. Whether GET /api/sites/:id/tasks?user_id= or GET /api/clock/status carries per-task completion for the active shift record. Needed for POR-002; the portal reads only tasks.total and tasks.completed from status.
- NV-5. personalNotes ownership. Employee-owned or admin-only decides whether POR-019 is a stale-write bug or a data exposure.
- NV-6. ocsa_qr_token. The portal never reads or writes it. Confirm whether the QR page flow expects the portal to consume that key on a supply scan; if so the portal side of the contract is unbuilt and the "QR" tile in SuppliesView is the place it would land.
- NV-7. Vercel install and CI settings for this project. Whether the install step is npm install (tolerates POR-022) or npm ci (would fail), and whether CI is set so that lint warnings fail the build.
- NV-8. iOS standalone rendering. With apple-mobile-web-app-capable and black-translucent, check on a device whether the header's profile and logout buttons sit under the status bar and whether the nav sits under the home indicator (POR-026).
- NV-9. scheduled_date serialization from /api/pickups/my-schedule. If it arrives as a date-only string or a midnight-UTC timestamp, the scheduled and pickup bucketing is correct; if it ever arrives as a local timestamp the same UTC slice defect as POR-007 applies.
- NV-10. Whether /api/auth/me already includes profilePhotoUrl; the extra call in handleLogin suggests it does not.
- NV-11. Android pickers that return a File with an empty type. uploadPhoto sends `"Content-Type": file.type`, which would be an empty header; POR-017's compression path makes this moot for images.
- NV-12. Whether me.sites is expected to refresh during a session. A site assigned mid-shift by the admin is invisible until re-login because sites is set only in handleLogin.
- NV-13. Admin parity for the API base derivation, the api() helper shape, and the 401 handling. To be checked against the Audit 2 register in consolidation.

## Cross References

- CR-1 (API, clock.js). POST /api/clock/in must reject a siteId that is not one of the caller's active assignments; the portal can send a stale id after session expiry (POR-003).
- CR-2 (API, issues.js). GET /api/issues returns other staff's issues to a staff role; scope by reporter unless the caller has the issues capability (POR-018).
- CR-3 (API, chat.js). The missing canAccessChannel check already in the security gate list makes the stale-channel exposure in POR-003 worse; keep both fixes.
- CR-4 (API, auth.js and users.js). Publish the exact field lists of /api/auth/me and /api/users/profile/me; confirm no rate, pin_hash, or admin note fields; decide personalNotes (POR-019, NV-5); consider adding profilePhotoUrl to /me (POR-033).
- CR-5 (API, users.js). PATCH /api/users/profile/me must coerce "" to null for birthday and the text columns regardless of the portal fix (POR-012, and the API audit's coercion finding).
- CR-6 (API, clock.js). Completion POST and DELETE carry only the task id; the route must scope to the caller's open shift record, and a per-task completed flag for that record is needed on the tasks response (POR-002, NV-4).
- CR-7 (API, clock.js). Response body of DELETE /api/clock/tasks/:id/complete (NV-2) and shape of POST /api/clock/out (NV-3).
- CR-8 (API, auth.js). Status code for a wrong PIN (NV-1); the planned login rate limiter should count the double Enter submit noted in POR-016 as two attempts, which is another reason to guard it.
- CR-9 (API, auth.js). A pin_hash placeholder such as RESET_REQUIRED must never compare equal; the portal only limits input length and sends the PIN verbatim.
- CR-10 (API, sites.js and inspections.js). Stop sending cims_category to portal-facing task and inspection item payloads, or send a plain label field instead (POR-011).
- CR-11 (API, uploads.js). The extension allowlist and content-type-from-extension items in the security gate should tolerate the portal's current `ext` derived from file.name and an empty file.type (POR-017, NV-11).
- CR-12 (API, auth.js). POST /api/auth/register receives "" for lastName and email when left blank; validate server-side (POR-016).
- CR-13 (API, issues.js). Accept photoUrl in the POST /api/issues body so the two-step create-then-attach in the portal can become one request (POR-004).
- CR-14 (API, pickups.js). POST /api/pickups/request-drop currently receives the reason code as the notes text when notes is empty; treat that value as null until POR-006 ships.
- CR-15 (API, inspections.js). POST /api/inspections/scheduled/:id/complete accepts all-zero scores with no unscored marker; if the inspection report defect in the roadmap traces to score data, POR-020 is related.
- CR-16 (Database). Confirm users.birthday is a date column (POR-012) and note the cims_category column name on task_templates and inspection template items for the rename discussion (POR-011).
- CR-17 (Admin). Compare the admin's API base derivation, api() helper, 401 handling, and toast behavior with this register in consolidation (NV-13).
