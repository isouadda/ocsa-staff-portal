# OCSA Scout: ocsa-staff-portal, read-only, v2

Where the deployed staff portal loads its task list, what it needs before it will, and what a rewire onto `site_sessions` faces. Quoted from source so a build prompt can copy every component name, state variable, route string and user-facing string verbatim. Read against the two API scouts, the Block 2 addendum, the earlier portal scout and the dashboard scout.

## Repo state

| Field | Value |
| --- | --- |
| Repository | ocsa-staff-portal |
| Branch read | `main` at `30a32d5` (merge commit of pull request 3, dated 2026-06-29). The session branch `claude/new-session-hgekc8` points at the same commit |
| Mode | read-only scout |
| Files read | all 9 tracked files, `src/App.js` in full (1,561 lines, 223,061 bytes), plus the six bundle documents |
| Code changes made | none |
| Files written into the repository | one, this report, per the delivery instruction at the end of the prompt |
| Commits | one, carrying this file only |
| Working tree at end | clean apart from this file |
| Report generated | 2026-09-09 |

Everything below was located by text pattern. Line numbers are a navigation aid at commit `30a32d5`. Code is quoted verbatim, with elisions marked `...`. The two base64 image literals on lines 57 and 58 are shown as `<BASE64_ELIDED>` where they appear inside a quoted line. The earlier portal scout, `SCOUT_OUTPUT_PORTAL.md`, was read as a prior claim; every claim it makes that this report relies on was re-verified against the source, and the places where it is wrong or stale are named in section 10.

> **CRITICAL: Read this before writing the rewire prompt**
>
> 1. **Stated plainly: a cleaner cannot see a task list today, and cannot complete a task today.** The task fetch runs only when `clockStatus?.clockedIn` is true and `clockStatus?.shift?.siteId` is set (`src/App.js:207`, `:219`). `clockStatus` is written only from `GET /api/clock/status` and from the clock in and clock out handlers. The only portal action that can make the API report an active session is `POST /api/clock/in` (`:197`), which answers 410 while `TIMEKEEPING_ENABLED` is off. `site_sessions` holds zero rows and nothing in this repository calls `/api/shift-sessions/` (zero occurrences). So `clockedIn` is false for every cleaner at every site, the Tasks tab renders the banner "Clock in to check off tasks. You can view your task list below." over the empty state "No tasks loaded. Clock in to a site to see your checklist." (`:771`, `:772`), and `toggleTask` is unreachable. Section 2.
> 2. **The earlier portal scout's four-layer analysis is confirmed line for line.** Layer 1 is the effect at `:219`, layer 2 is the early return at `:207`, layer 3 is the branch at `:769`, layer 4 is `handleClockOut` at `:203`. That scout read the same commit, `30a32d5`, and nothing has been committed to `main` since. Section 2.
> 3. **Login itself depends on the clock router answering.** `handleLogin` awaits `GET /api/clock/status` inside its `try` at `:176`, between `/api/auth/me` and `setScreen("main")`. The Block 2 scout says that route stays live and branches on the flag with no 410. If that ever changes, or if the route throws for a user with no session, `handleLogin` toasts the error and never reaches `setScreen("main")`, and nobody can log in. The rewire should move or guard that call. Section 2.
> 4. **The reshaped `GET /api/clock/status` response is unquoted by any scout.** The portal reads `clockedIn`, `shift.siteId`, `shift.siteName`, `shift.buildingName`, `shift.floorNumber`, `shift.clockInTime`, `tasks.total` and `tasks.completed` from it. The Block 2 scout says the flag-off branch "sources from `site_sessions`" and lists which columns it reads, and never quotes the JSON it returns. Whether a `site_sessions` row makes that route answer `clockedIn: true` with a `shift` object in the old shape decides whether the existing `TasksView` would light up unchanged once a session exists. One authenticated call settles it. Section 2 and the questions list.
> 5. **A task completion sends `{}` and names no site.** `POST /api/clock/tasks/:taskId/complete` with `body: {}` at `:208`. The API takes the site from the caller's most recent session. The portal never reads `site_id` on a task row; the only site it knows is `clockStatus.shift.siteId`. Section 2.
> 6. **`completedTaskIds` is never hydrated from the server.** It starts as `new Set()` (`:143`), grows only through `toggleTask`, and is cleared by clock out and logout. The API's completion count (`tasks.completed`) drives the percentage while the checkboxes are session-local, so a refresh or re-login shows a percentage with no checks. The rewire needs a completed-ids read that the API does not currently expose per the scouts. Section 4.
> 7. **No activation screen and no reset screen exist, and the app never reads the URL.** `screen` takes exactly three values, `"login"`, `"register"`, `"main"` (`:138`). There is no router, no `window.location` read, no `URLSearchParams`. The mailer's links to `/activate?token=` and `/reset-pin?token=` land on the login card with the token sitting unused in the address bar. Every invite sent before the rewire ships lands on a dead link. Section 5.
> 8. **`GET /api/lookups/all` answers 403 to every staff account, and the portal hides it.** The route is gated `manage_lookups`, admin only by default. The portal calls it at login (`:180`) with `.catch(e => console.warn(...))`, so `lookups` stays `[]`, every `getOpts(slug)` returns `[]`, and every select falls through to its hardcoded English array. The `authenticate`-only sibling `GET /api/lookups` is the route this app should call. Section 9.
> 9. **The token lives only in React state. A refresh logs the cleaner out.** `const [token, setToken] = useState(null)` at `:135`; `localStorage` holds one key, `ocsa-staff-theme`. Section 5.
> 10. **Two live credentials ship in the bundle.** `LoginScreen` renders a "Demo Accounts (Live Data)" block with `isouadda@ocsaco.com` / `2580` and `daniel.evans@ocsa.temp` / `1357` (`:352` to `:355`, `:369` to `:371`). The API scouts confirm the login lockout counts failures only, so a correct PIN in the bundle bypasses it. Section 5.
> 11. **No block field, `frequency`, `days_of_week`, `shift_label`, `block_label` or `anchor_time` appears anywhere in the source.** `sort_order` appears once, inside `getOpts` for lookup values (`:163`). The checklist groups on `floor_number` and `zone` only (`groupTasksByFloorZone`, `:751`) and keeps the API's row order inside a group. Section 4.
> 12. **Chat is a single-line input polling every 12 seconds with no history paging and no system-message rendering.** `ChatView` (`:815` to `:841`) renders one bubble style for people, tinted by role, and reads `msg.senderId`, `msg.senderRole`, `msg.senderName`, `msg.text`, `msg.sentAt`. A compliance agent tab can copy the shell and needs its own message model. Section 6.
> 13. **The smallest tap target on the Tasks view is a 22 by 22 pixel checkbox.** `width: 22, height: 22` on the button at `:810`, below the 44 pixel minimum the header avatar button already observes (`:253`). Section 7.
> 14. **`src/App.js` can be split mechanically.** Every component is a top-level `function` declaration, hoisted, taking everything through props; no component closes over another's scope. The only definition-order dependency is that module-level `const` tokens (colors, fonts, `DARK`, `LIGHT`, `api`, icons, `mk*` helpers, `LOGO_*`) are read at render time, after module evaluation. Section 10.
> 15. **The riskiest single thing about a one-commit replacement is the 65,332 bytes of base64 on lines 57 and 58.** Together they are 29.3 percent of the file. A delete-and-recreate that mistypes one character of either string ships a broken logo to every screen that renders it, and there is no test, no lint script and no CI to catch it before Vercel deploys. Section 10.

## Table of contents

1. Inventory
2. The task loading path, in full
3. Session start and site selection
4. Rendering the checklist
5. Authentication, activation and the token
6. The existing chat surface
7. Mobile
8. Language
9. Every API route this repository calls
10. What the rewire faces

Closing

- Questions I could not answer from the code
- Completeness audit, items 1 through 10

---

# 1. Inventory

## 1.1 Every tracked file with its line count

**Locate:** command: `git ls-files | while read f; do wc -l < "$f"; done` | tracked files: `9`

| File | Lines | Bytes | What it is |
| --- | --- | --- | --- |
| package-lock.json | 17251 | 650159 | the npm lockfile, committed |
| src/App.js | 1561 | 223061 | the entire portal |
| CLAUDE.md | 27 | 1707 | project rules |
| .gitignore | 21 | 223 | ignores node_modules, build, coverage, `.env.*.local`, logs |
| src/clientConfig.js | 20 | | client name, colors, ID prefix |
| public/index.html | 20 | | HTML shell, viewport meta, Google Fonts link, theme color placeholder |
| package.json | 18 | 402 | dependencies and scripts |
| src/index.js | 6 | | `ReactDOM.createRoot` render of `<App />` in StrictMode |
| .env | 1 | 32 | `REACT_APP_THEME_COLOR="#0A1628"` |

**`src/App.js` is 1,561 lines and 223,061 bytes.** There is no test directory, no `.github` directory, no `vercel.json`, no `README`, no `src/*.css`, no `public/manifest.json`, no service worker. Git history holds 54 commits on `main`; the newest, `30a32d5`, is the merge of pull request 3 on 2026-06-29.

> **CONFIRMED: package-lock.json is committed**
>
> `git ls-files | grep -i lock` returns `package-lock.json`. `.gitignore` does not name it. This differs from the dashboard repository, where the lockfile is ignored. Vercel builds of the same commit resolve identically here.

The two longest lines, by `awk '{ print length($0) "\t" NR }'`:

| Line | Characters | Content |
| --- | --- | --- |
| 58 | 48505 | `const LOGO_LG = "data:image/png;base64,<BASE64_ELIDED>";` |
| 57 | 16825 | `const LOGO_SM = "data:image/png;base64,<BASE64_ELIDED>";` |

Fifteen further lines exceed 900 characters, the longest of which are 960 (2461), 894 (2135), 832 (1725), 810 (1695) and 870 (1499). Lines 810 and 774 are the two checklist renders, each one JSX expression on a single line.

## 1.2 Every component in src/App.js, in definition order

**Locate:** command: `grep -nE '^(function [A-Za-z]|const [A-Z][A-Za-z_]* = |export default|async function)' src/App.js`

Module-level helpers first, then every component. Line ranges run from the definition to the line before the next definition. Byte counts were measured with `awk` over those ranges.

| Lines | Name | Kind | Bytes | Renders or does |
| --- | --- | --- | --- | --- |
| 1-2 | imports | | | `useState, useEffect, useCallback, useRef` from react; `clientConfig` |
| 4 | `API` | const | | base URL, section 1.5 |
| 6-17 | `uploadPhoto(file, token)` | function | | raw `fetch` POST to `/api/uploads?bucket=issue-photos`, returns `data.url` |
| 19-29 | `uploadTaskMedia(file, token)` | function | | raw `fetch` POST to `/api/uploads?bucket=task-media`, returns the whole JSON |
| 31-33 | `GOLD`, `GOLD_LIGHT`, `GREEN`, `RED`, `ORANGE`, `BLUE`, `NAVY`, `NAVY_DARK` | consts | 1618 (lines 1-33) | brand colors, three from `clientConfig.brand` |
| 35-56 | `compressImage(file, maxSize, quality)` | function | 876 | canvas resize to JPEG, used once |
| 57-58 | `LOGO_SM`, `LOGO_LG` | consts | 65332 | base64 PNG data URIs |
| 60-62 | `FONT_HEAD`, `FONT_BODY`, `R` | consts | | Montserrat, Inter, the radius scale `{ sm: 8, md: 10, lg: 14, pill: 999 }` |
| 64-78 | `DARK` | const | | the dark theme token set, 40 keys |
| 79-93 | `LIGHT` | const | | the light theme token set, same keys |
| 95-102 | `api(path, opts)` | function | | the JSON fetch wrapper every `api(...)` call goes through |
| 104-106 | `formatTime`, `formatDate`, `now` | consts | | `en-US` formatters |
| 108-128 | `Ico`, `ClockIco`, `CheckIco`, `AlertIco`, `BoxIco`, `MapIco`, `CamIco`, `ChatIco`, `SendIco`, `LogOutIco`, `MinusIco`, `PlusIco`, `ChevIco`, `SunIco`, `MoonIco`, `WrkIco`, `ClipIco`, `SwapIco`, `CalIco`, `HomeIco`, `LockIco` | components | 6770 (lines 59-133) | 21 inline SVG icons |
| 130-132 | `mkLabel(t)`, `mkInput(t)`, `mkQtyBtn(t)` | consts | | the shared style helpers |
| 134-345 | `OCSAStaffPortal` | component, default export | 22520 | all state, every handler, login gate, header, tab switch, More overlay, bottom nav, toast, the global `<style>` block |
| 347-377 | `LoginScreen` | component | 4220 | identifier plus PIN card, register link, the demo accounts block, theme toggle |
| 379-402 | `RegisterScreen` | component | 3229 | six-field registration card |
| 404-700 | `MyScheduleSection` | component | 23311 | week grid, month grid, shift detail bottom sheet, drop request form |
| 702-749 | `ClockView` | component | 5519 | wall clock, "Your Assigned Sites" picker, "Time on Site" card, Clock In or Clock Out button |
| 751-756 | `groupTasksByFloorZone(taskList)` | function | 724 | groups task rows on `floor_number` and `zone` |
| 758-813 | `TasksView` | component | 9794 | the checklist: clocked-out branch, task detail, clocked-in checklist |
| 815-841 | `ChatView` | component | 6048 | channel pills, admin DM button, message list, single-line composer |
| 843-897 | `AssignedTasksView` | component | 16330 | assigned task list, detail, resolve panel, cannot-resolve panel |
| 899-930 | `IssuesView` | component | 7873 | report form with photo, admin issue list |
| 932-964 | `SuppliesView` | component | 9108 | request form, clocked-out branch, supply list with quantity stepper, "This Shift's Log" |
| 966-968 | `EmptyState` | component | 354 | icon plus one line of text in a card |
| 970-1154 | `PickupView` | component | 11841 | Available and My Pickups tabs, claim and release |
| 1156-1407 | `InspectView` | component | 15523 | inspection list, scoring view, schedule modal |
| 1409-1561 | `MyProfileView` | component | 12070 | photo, personal information read and edit, site assignments |

Fourteen components, four module-level functions (`uploadPhoto`, `uploadTaskMedia`, `compressImage`, `api`), one grouping helper, 21 icons. There is no nesting, no folder, no barrel file and no second component file.

## 1.3 How navigation works

**Locate:** file: `src/App.js` | find: `const [screen, setScreen] = useState("login")` | line: `138` | find: `const [activeTab, setActiveTab] = useState("clock")` | line: `139` | router library: `none`

Navigation is two strings in React state. There is no router dependency in `package.json`, no `window.location` read, no `history` call, no hash handling, and the URL never changes.

The outer switch, `screen`:

```js
      {screen === "login" && <LoginScreen onLogin={handleLogin} onGoRegister={() => setScreen("register")} loading={loading} showToast={showToast} t={t} toggleTheme={toggleTheme} themeMode={themeMode} />}
      {screen === "register" && <RegisterScreen onRegister={handleRegister} onBack={() => setScreen("login")} loading={loading} t={t} />}
      {screen === "main" && (
```

Three values. Set at `:138` (initial `"login"`), `:181` (`"main"` on login success), `:188` (`"login"` after register), `:192` (`"login"` on logout), `:160` (`"login"` on the 401 event), `:246` and `:247` (the two screen links).

The inner switch, `activeTab`, lines 271 to 280, every tab key with its component and props:

| Tab key | Component | Props passed | Reached from |
| --- | --- | --- | --- |
| clock | `ClockView` then `MyScheduleSection compact` | clockStatus, currentTime, selectedSite, setSelectedSite, onClockIn, onClockOut, sites, loading, t; then token, t, compact, showToast, getOpts, lkHasOther | bottom nav "Home", the default tab |
| schedule | `MyScheduleSection` | token, t, showToast, getOpts, lkHasOther | bottom nav "Schedule" |
| tasks | `TasksView` | clockStatus, tasks, completedTaskIds, toggleTask, t | bottom nav "Tasks" |
| chat | `ChatView` | channels, messages, activeChannel, setActiveChannel, sendMessage, user, t, token | bottom nav "Chat" |
| issuetasks | `AssignedTasksView` | assignedTasks, resolveTask, showToast, t, token, lkColorMap | More menu "Assigned" |
| issues | `IssuesView` | clockStatus, issues, submitIssue, showToast, user, sites, t, token, getOpts, lkColorMap | More menu "Issues" or "Report" |
| supplies | `SuppliesView` | clockStatus, supplies, supplyLogs, logSupplyUsage, submitRequest, showToast, t, getOpts, lkColorMap | More menu "Supplies" |
| pickup | `PickupView` | token, user, showToast, t | More menu "Pickup" |
| inspect | `InspectView` | token, user, showToast, t | More menu "Inspect" |
| profile | `MyProfileView` | token, user, showToast, t, setUser, setActiveTab | the avatar button in the header only, `:253` |

The two tab arrays, verbatim:

```js
  const primaryTabs = [
    { id: "clock", label: "Home", icon: HomeIco },
    { id: "schedule", label: "Schedule", icon: CalIco },
    { id: "tasks", label: "Tasks", icon: CheckIco },
    { id: "chat", label: "Chat", icon: ChatIco },
  ];
  const moreTabs = [
    { id: "issuetasks", label: "Assigned", icon: WrkIco, badge: assignedCount },
    { id: "issues", label: isAdmin ? "Issues" : "Report", icon: AlertIco },
    { id: "supplies", label: "Supplies", icon: BoxIco },
    { id: "pickup", label: "Pickup", icon: SwapIco },
    { id: "inspect", label: "Inspect", icon: ClipIco },
  ];
```

Sub-navigation inside components is also state: `view` in `MyScheduleSection` (`"week"`, `"month"`), `detail` in `MyScheduleSection`, `TasksView` and `AssignedTasksView` (an object or null), `activePanel` in `AssignedTasksView` (`"resolve"`, `"cantresolve"`, null), `tab` in `PickupView` (`"available"`, `"mine"`), `active` and `scheduleModal` in `InspectView`, `editing` in `MyProfileView`, `showForm` in `IssuesView`, `reqForm` and `scanning` in `SuppliesView`, `showMore` in the root.

## 1.4 Every import and every dependency with its version

**Locate:** file: `src/App.js` | lines: `1 to 2`

```js
import { useState, useEffect, useCallback, useRef } from "react";
import clientConfig from './clientConfig';
```

Two imports. Every other identifier in the file is defined in the file. `src/index.js`:

```js
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<React.StrictMode><App /></React.StrictMode>);
```

`package.json` in full:

```json
{
  "name": "ocsa-staff-portal",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-scripts": "5.0.1"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build"
  },
  "browserslist": {
    "production": [">0.2%", "not dead", "not op_mini all"],
    "development": ["last 1 chrome version"]
  }
}
```

Three dependencies, no devDependencies, no `test` script, no `lint` script. **`package-lock.json` is committed** (17,251 lines).

`src/clientConfig.js` in full:

```js
const clientConfig = {
  company: {
    name: 'OCSA Cleaning Inc.',
    shortName: 'OCSA Cleaning',
    brandTag: 'OCSA',
    location: 'Philadelphia, PA',
    confidentialLabel: 'Confidential Record',
    footerLine: 'OCSA Cleaning Inc. | Philadelphia, PA | Confidential Record',
  },
  brand: {
    navy: '#0A1628',
    gold: '#C8A84E',
    navyDark: '#0F1D32',
  },
  employee: {
    idPrefix: 'OCSA',
  },
};

export default clientConfig;
```

`src/App.js` reads exactly four of these: `clientConfig.brand.gold` (`:31`), `clientConfig.brand.navy` (`:32`), `clientConfig.brand.navyDark` (`:33`), and `clientConfig.company.shortName` twice as an `<img alt>` (`:360`, `:388`). `company.name`, `company.brandTag`, `company.location`, `company.confidentialLabel`, `company.footerLine` and `employee.idPrefix` are declared and never read.

## 1.5 The API base URL and every environment variable the build reads

**Locate:** file: `src/App.js` | find: `const API = process.env.REACT_APP_API_URL` | line: `4`

```js
const API = process.env.REACT_APP_API_URL || "https://ocsa-api-production.up.railway.app";
```

Every request in the file goes through `API`: the `api()` wrapper at `:98`, and three raw `fetch` calls at `:8`, `:21` and `:1433`. No other base URL literal exists.

| Variable | Read at | Default |
| --- | --- | --- |
| `REACT_APP_API_URL` | `src/App.js:4` | `https://ocsa-api-production.up.railway.app` |
| `REACT_APP_THEME_COLOR` | `public/index.html` lines 6 and 14 as `%REACT_APP_THEME_COLOR%` | none in HTML; `.env` supplies `#0A1628` |

`.env` is committed with one line, `REACT_APP_THEME_COLOR="#0A1628"`. `REACT_APP_API_URL` is not in `.env`; whether Vercel injects it cannot be read from the repository, and the fallback is the production Railway host either way.

`public/index.html` in full:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <meta name="theme-color" content="%REACT_APP_THEME_COLOR%" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <title>OCSA Staff Portal</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:wght@600;700;800&display=swap" rel="stylesheet" />
  <style>
    body { margin: 0; padding: 0; background: %REACT_APP_THEME_COLOR%; font-family: 'Inter', -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
  </style>
</head>
<body>
  <div id="root"></div>
</body>
</html>
```

---

# 2. The task loading path, in full

**Locate:** file: `src/App.js` | find: `const loadTasks = async () =>` | line: `207` | effect: `:219` | view gate: `:769`

## 2.1 Every condition that must be true before the task list fetches

The chain, in the order it is evaluated:

| # | Condition | Line | Source of the value |
| --- | --- | --- | --- |
| 1 | `screen === "main"` | 248 | set by `handleLogin` at `:181` after `POST /api/auth/login`, `GET /api/auth/me` and `GET /api/clock/status` all succeed |
| 2 | `activeTab === "tasks"` | 219 | the bottom nav "Tasks" button, `:307` |
| 3 | `clockStatus?.clockedIn` is truthy | 219 (the effect) and 207 (the early return) | `GET /api/clock/status` only, sections 2.3 and 2.4 |
| 4 | `clockStatus?.shift?.siteId` is truthy | 207 | the same response |
| 5 | `user.id` is defined | 207 | `me.user` from `GET /api/auth/me`, `:174`; read without optional chaining |
| 6 | `token` is set | 207 | `data.token` from login, `:172` |

The effect that calls the loader, verbatim:

```js
  useEffect(() => { if (activeTab === "tasks" && clockStatus?.clockedIn) loadTasks(); if (activeTab === "issues") loadIssues(); if (activeTab === "issuetasks") loadAssignedTasks(); if (activeTab === "supplies") loadSupplies(); if (activeTab === "chat") loadChannels(); }, [activeTab, clockStatus?.clockedIn]);
```

Dependencies are `[activeTab, clockStatus?.clockedIn]`. A change of `clockStatus.shift.siteId` with `clockedIn` unchanged does not re-run it. A cleaner who somehow gained a session while sitting on the Tasks tab would see the list only after `clockedIn` flipped, because that is the dependency the effect watches.

The loader, verbatim:

```js
  const loadTasks = async () => { if (!clockStatus?.clockedIn || !clockStatus?.shift?.siteId) return; try { let taskUrl = "/api/sites/" + clockStatus.shift.siteId + "/tasks?user_id=" + user.id; if (clockStatus.shift.buildingName) taskUrl += "&building_name=" + encodeURIComponent(clockStatus.shift.buildingName); if (clockStatus.shift.floorNumber) taskUrl += "&floor_number=" + encodeURIComponent(clockStatus.shift.floorNumber); const tt = await api(taskUrl, { token }); setTasks(tt); const cs = await api("/api/clock/status", { token }); setClockStatus(cs); } catch (err) { console.error(err); } };
```

The early return at the top is the second gate. The `catch` swallows to `console.error`, so a failed fetch leaves `tasks` at its previous value and the screen at whatever it was showing.

## 2.2 The exact URL the task fetch builds

From `:207`:

```
"/api/sites/" + clockStatus.shift.siteId + "/tasks?user_id=" + user.id
```

with two optional suffixes:

```
"&building_name=" + encodeURIComponent(clockStatus.shift.buildingName)
"&floor_number=" + encodeURIComponent(clockStatus.shift.floorNumber)
```

**The site id is `clockStatus.shift.siteId`.** It comes from the clock status response and from nowhere else. `user.id` comes from `me.user` (`:174`). The building and floor filters come from the same `shift` object. The `sites` array from `/api/auth/me` (`:137`, `:174`) and `selectedSite` (`:141`) are never used to build this URL.

The route it hits is `GET /api/sites/:id/tasks`, quoted in the Block 2 scout section 9: it filters on `tt.site_id`, `ta.user_id` (through an active assignment), `tt.is_active`, and the two optional exact matches, and the addendum says session two changed its ORDER BY to put `sort_order` ahead of `zone` and left join the block fields. It does not filter on `task_type`, so the portal filters client-side at `:760`.

## 2.3 Every route this repository calls under /api/clock/

| Line | Call as written | Method | On the task path | What it does |
| --- | --- | --- | --- | --- |
| 162 | `api("/api/clock/tasks/assigned", { token: tkn \|\| token })` | GET | elsewhere | `loadAssignedTasks`, the Assigned tab list and its badge count |
| 176 | `api("/api/clock/status", { token: data.token })` | GET | **yes**, it seeds `clockStatus` at login | inside `handleLogin`, awaited, inside the `try` |
| 197 | `api("/api/clock/in", { method: "POST", body: { siteId: selectedSite }, token })` | POST | **yes**, the only portal action that can make `clockedIn` true | `handleClockIn`; answers 410 today |
| 197 | `api("/api/clock/status", { token })` | GET | yes | refetch after clock in |
| 203 | `api("/api/clock/out", { method: "POST", body: {}, token })` | POST | yes, it erases the list | `handleClockOut`; answers 410 today |
| 207 | `api("/api/clock/status", { token })` | GET | yes | refetch inside `loadTasks` after the task fetch |
| 208 | `api("/api/clock/tasks/" + taskId + "/complete", { method: "DELETE", token })` | DELETE | **yes**, the uncheck | `toggleTask` |
| 208 | `api("/api/clock/tasks/" + taskId + "/complete", { method: "POST", body: {}, token })` | POST | **yes**, the completion | `toggleTask` |
| 208 | `api("/api/clock/status", { token })` | GET | yes | refetch after every toggle |
| 210 | `api("/api/clock/tasks/resolve/" + taskId, { method: "PATCH", body: { resolutionStatus: status, resolutionNote: note \|\| undefined, photoUrl: photoUrl \|\| undefined }, token })` | PATCH | elsewhere | `resolveAssignedTask`, the Assigned tab |

Nine call sites, six distinct routes. Per the Block 2 scout section 4, `/api/clock/in` and `/api/clock/out` carry `requireTimekeeping` and answer 410 with `{ error: "Timekeeping is switched off. Clock in, clock out and payroll are recorded in ADP.", code: "TIMEKEEPING_DISABLED" }`. `/api/clock/status` branches on the flag inside the handler and stays live. The four `/tasks/...` routes and the two completion routes stay live and are outside the gate.

The portal has no branch on status 410 or on `code: "TIMEKEEPING_DISABLED"`. `api()` at `:100` turns any non-2xx into `throw new Error(err.error || "Request failed")`, so tapping Clock In today produces a red toast reading the API's timekeeping message, and `clockStatus` is unchanged.

The two handlers, verbatim:

```js
  const handleClockIn = async () => {
    if (!selectedSite) { showToast("Select a site first", "error"); return; }
    setLoading(true);
    try { await api("/api/clock/in", { method: "POST", body: { siteId: selectedSite }, token }); const cs = await api("/api/clock/status", { token }); setClockStatus(cs); showToast("Clocked in at " + formatTime(now())); } catch (err) { showToast(err.message, "error"); }
    setLoading(false);
  };

  const handleClockOut = async () => {
    setLoading(true);
    try { const data = await api("/api/clock/out", { method: "POST", body: {}, token }); setClockStatus({ clockedIn: false, shift: null, tasks: { total: 0, completed: 0 } }); setTasks([]); setCompletedTaskIds(new Set()); setSelectedSite(null); showToast("Clocked out. Duration: " + data.shiftRecord.duration_minutes + " minutes"); } catch (err) { showToast(err.message, "error"); }
    setLoading(false);
  };
```

`handleClockOut` reads `data.shiftRecord.duration_minutes` from the response, a `shift_records` shape that the API no longer writes.

## 2.4 Every write to clockStatus

**Locate:** find: `setClockStatus(` | lines: `140, 177, 192, 197, 203, 207, 208`

| Line | Value written | Trigger |
| --- | --- | --- |
| 140 | `null` | initial state |
| 177 | `cs` from `GET /api/clock/status` | login |
| 192 | `null` | logout |
| 197 | `cs` from `GET /api/clock/status` | after `POST /api/clock/in` succeeds |
| 203 | `{ clockedIn: false, shift: null, tasks: { total: 0, completed: 0 } }` | after `POST /api/clock/out` succeeds |
| 207 | `cs` from `GET /api/clock/status` | inside `loadTasks` |
| 208 | `cs` from `GET /api/clock/status` | inside `toggleTask` |

**Every non-null value comes from `GET /api/clock/status`.** The portal never constructs a clocked-in status itself. So `clockedIn` is true only when that route says so.

> **CRITICAL: The response the portal reads from GET /api/clock/status, and what no scout has quoted**
>
> Every key the portal reads from the status response, with its line:
>
> | Key | Read at |
> | --- | --- |
> | `clockedIn` | 178, 192, 207, 219, 262, 703, 769, 913, 918, 949 |
> | `shift.siteId` | 178, 207, 211, 212, 213, 214, 913 |
> | `shift.siteName` | 741, 807 |
> | `shift.buildingName` | 207, 742, 807 |
> | `shift.floorNumber` | 207, 742, 807 |
> | `shift.clockInTime` | 704, 740 |
> | `tasks.total`, `tasks.completed` | 707, 743 |
>
> The first API scout, item 21, quotes the pre-Block-1 handler: `{ clockedIn: false, shift: null }` with no session, and `{ clockedIn: true, shift: {...}, tasks: { total, completed } }` with one. The Block 2 scout says the flag-off branch now "sources from `site_sessions`" and reads `building_name`, `floor_number`, `source`, `scheduled_shift_id`, `is_assigned_site` from that table, and never quotes the JSON it returns. Whether the key is still `clockedIn`, whether the nested object is still `shift`, and whether it still carries `siteId`, `siteName` and `clockInTime` (the last of which `site_sessions` does not have, it has `started_at`) are all unknown from the bundle. `ClockView` at `:704` computes `new Date(clockStatus.shift.clockInTime)`; a missing key yields `NaN` and a timer reading `NaN:NaN:NaN`. One authenticated call to the deployed route, for a user with and without a `site_sessions` row, settles the whole question and should be the first thing the rewire session does.

## 2.5 What the Tasks view renders when the loading condition is false

**Locate:** find: `if (!clockStatus?.clockedIn) return (` inside `function TasksView` | line: `769`

The branch, verbatim:

```jsx
  if (!clockStatus?.clockedIn) return (
    <div style={{ padding: "16px" }}>
      <div style={{ padding: "12px 14px", marginBottom: 14, background: t.orangeSubtle, borderRadius: R.md, border: "1px solid " + t.orangeBorder, boxShadow: t.shadow }}><div style={{ fontSize: 12, color: ORANGE }}>Clock in to check off tasks. You can view your task list below.</div></div>
      {standardTasks.length === 0 ? <EmptyState icon={CheckIco} text="No tasks loaded. Clock in to a site to see your checklist." t={t} /> : (() => {
        const groups = groupTasksByFloorZone(standardTasks); let lastFloor = undefined;
        return groups.map((g, gi) => { const showFloor = g.floor && g.floor !== lastFloor; lastFloor = g.floor; return (<div key={gi} style={{ marginBottom: 16 }}>{showFloor && (<div style={{ ...floorHeadSt, marginTop: gi > 0 ? 10 : 0 }}>Floor {g.floor}</div>)}<div style={{ ...zoneSt, paddingLeft: g.floor ? 8 : 0 }}>{g.zone}</div>{g.tasks.map(task => { const hasInfo = task.has_details || task.description || task.media_url; return (<div key={task.id} onClick={() => hasInfo ? setDetail(task) : null} style={{ ...rowBase, background: t.card, border: "1px solid " + t.borderSolid, cursor: hasInfo ? "pointer" : "default", opacity: 0.6, marginLeft: g.floor ? 8 : 0 }}><div style={{ width: 22, height: 22, borderRadius: R.sm, border: "2px solid " + t.textMut, background: "transparent", flexShrink: 0, marginTop: 1 }} /><div style={{ flex: 1, fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", gap: 5, color: t.text }}>{task.label}{hasInfo && <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: BLUE, flexShrink: 0 }} />}</div></div>); })}</div>); });
      })()}
    </div>
  );
```

The right side of the ternary renders `tasks` with the checkbox as a plain `<div>` and `opacity: 0.6`. Because `loadTasks` never runs while `clockedIn` is false, `standardTasks` is `[]` in every real case and the left side renders. The two strings a cleaner sees today are:

```
Clock in to check off tasks. You can view your task list below.
No tasks loaded. Clock in to a site to see your checklist.
```

`EmptyState` at `:966`:

```jsx
function EmptyState({ icon: Icon, text, t }) {
  return (<div style={{ padding: "48px 24px", textAlign: "center", background: t.card, borderRadius: R.md, border: "1px solid " + t.border, boxShadow: t.shadow }}><Icon sz={40} c={t.borderSolid} /><div style={{ fontSize: 15, color: t.textMut, marginTop: 16, fontFamily: FONT_HEAD }}>{text}</div></div>);
}
```

The second gate inside the clocked-in path, at `:778`:

```jsx
  if (standardTasks.length === 0) return <EmptyState icon={CheckIco} text="Loading tasks..." t={t} />;
```

That string renders for a site with zero assigned tasks and for a failed fetch alike; there is no loading flag.

## 2.6 Whether anything calls /api/shift-sessions/

**Locate:** command: `grep -c "shift-sessions" src/App.js` | result: `0`

Nothing. `shift-sessions`, `shift_sessions`, `site_sessions`, `siteSession`, `sessionDate`, `startedAt` and `elapsedMinutes` each return zero occurrences across `src/` and `public/`.

## 2.7 How a task completion is posted

**Locate:** find: `const toggleTask = async (taskId) =>` | line: `208`

```js
  const toggleTask = async (taskId) => { try { if (completedTaskIds.has(taskId)) { await api("/api/clock/tasks/" + taskId + "/complete", { method: "DELETE", token }); setCompletedTaskIds(prev => { const n = new Set(prev); n.delete(taskId); return n; }); } else { await api("/api/clock/tasks/" + taskId + "/complete", { method: "POST", body: {}, token }); setCompletedTaskIds(prev => new Set(prev).add(taskId)); showToast("Task completed"); } const cs = await api("/api/clock/status", { token }); setClockStatus(cs); } catch (err) { showToast(err.message, "error"); } };
```

| | |
| --- | --- |
| Route, complete | `POST /api/clock/tasks/{taskId}/complete` |
| Route, uncomplete | `DELETE /api/clock/tasks/{taskId}/complete` |
| Body, complete | `{}`, serialized as `"{}"` by `api()` at `:98` |
| Body, uncomplete | none |
| What the portal sends as the site | **nothing** |
| Auth | `Authorization: Bearer <token>` |
| After either | `GET /api/clock/status` and `setClockStatus(cs)` |

The API accepts `notes` and `photoUrl` in the body per the Block 2 scout section 3; the portal sends neither. The API takes `site_id` and `site_session_id` from the caller's most recent `site_sessions` row for today and answers 409 `{ error: "No site session for today. Use Start Shift to choose your site first.", code: "NO_SITE_SESSION" }` when there is none. The portal surfaces that as a red toast.

`toggleTask` is reachable from three places, all inside the clocked-in branch of `TasksView`: the checkbox button at `:810`, the row body at `:810` when the task has no detail, and the "Mark Complete" or "Uncheck Task" button at `:797`. None of them exists in the clocked-out branch.

## 2.8 Whether the portal reads site_id on the task row

**Locate:** command: `grep -n -o "site_id" src/App.js` | results: `212, 1173, 1195, 1201, 1390`

Five occurrences and none is on a task row: `:212` is the `?site_id=` query on the supplies URL, and the other four are `schedForm.site_id` inside `InspectView`. The task row fields the portal reads are listed in section 4.1; `site_id` is absent. **The portal infers the site from `clockStatus.shift.siteId`** everywhere the site is needed: the task URL (`:207`), the issue submit fallback (`:211`), the supplies URL (`:212`), the supply usage body (`:213`), the supply request body (`:214`) and the issue form (`:913`).

## 2.9 Stated plainly

**Can a cleaner see a task list today? No.** `clockedIn` is false for everyone because the only route that could make it true from this app answers 410, `site_sessions` is empty, and the effect at `:219` and the early return at `:207` both refuse to fetch while it is false.

**Can a cleaner complete a task today? No.** `toggleTask` is reachable only from the clocked-in branch of `TasksView`, which never renders, and even a direct call would receive 409 `NO_SITE_SESSION` from the API.

The Assigned tab is the one task surface that works today: `AssignedTasksView` reads `assignedTasks` from `GET /api/clock/tasks/assigned` (`:162`) and resolves through `PATCH /api/clock/tasks/resolve/:taskId` (`:210`), and neither reads `clockStatus`.

---

# 3. Session start and site selection

## 3.1 Whether any screen lets a person choose which site they are working at

Three places let a person pick a site. None of them starts a session.

**a. `ClockView`, "Your Assigned Sites".** `:717` to `:735`.

```jsx
        <label style={{ ...labelSt, display: "block", marginBottom: 10 }}>Your Assigned Sites</label>
        {sites.length === 0 && <div style={{ padding: "28px 20px", textAlign: "center", background: t.card, borderRadius: R.md, border: "1px solid " + t.border, fontSize: 13, color: t.textMut, boxShadow: t.shadow }}>No sites assigned yet.</div>}
        {sites.map(site => {
          const sel = selectedSite === site.siteId;
          return (
            <button key={site.siteId} onClick={() => !ci && setSelectedSite(site.siteId)} style={{ ... }}>
              ...
                <div style={{ fontSize: 13, fontWeight: 600 }}>{site.siteName}</div>
                <div style={{ fontSize: 10, color: t.textSec, marginTop: 2 }}>{site.address}, {site.city}</div>
                {site.shiftName && <div style={{ fontSize: 10, color: GOLD, marginTop: 3, fontWeight: 600 }}>{site.roleAtSite} | {site.shiftName} shift</div>}
```

Source: `sites` state (`:137`), set from `me.sites` at `:174` after `GET /api/auth/me`. Fields read per row: `siteId`, `siteName`, `address`, `city`, `roleAtSite`, `shiftName`. The selection is stored in `selectedSite` (`:141`) and consumed by exactly one thing, `handleClockIn` at `:195` and `:197`. Selection is disabled while clocked in (`!ci &&`). With `ci` permanently false the picker is always live and the only thing it feeds answers 410.

Note the shape difference with the shift-sessions router: `GET /api/shift-sessions/sites` returns `{ today, timeZone, scheduled, assigned, all }`, and its `assigned` rows carry `siteId`, `siteName`, `address`, `city`, `role_at_site`, `shift_name` per the Block 2 scout section 2 (the projection is elided there as `({ ... })`, so the exact key casing of the assigned rows is unconfirmed). The portal's `me.sites` rows are camelCase.

**b. `IssuesView`, the site select.** `:918`, rendered only when clocked out:

```jsx
        {!clockStatus?.clockedIn && sites && sites.length > 0 && (<div style={{ marginBottom: 10 }}><label style={labelSt}>Site</label><select value={selSite} onChange={e => setSelSite(e.target.value)} style={inputSt}><option value="">Select site...</option>{sites.map(s => <option key={s.siteId} value={s.siteId}>{s.siteName}</option>)}</select></div>)}
```

Local state `selSite` (`:901`), consumed at `:913`: `const siteId = clockStatus?.clockedIn ? clockStatus.shift.siteId : selSite;`. This is the one site choice that reaches the API today, on `POST /api/issues`.

**c. `InspectView`, the schedule modal.** `:1390`, managers only (`isManager` at `:1262`), reading `GET /api/sites` (`:1191`) into a local `sites` state that shadows the root one. Consumed by `POST /api/inspections/scheduled` as `site_id`.

## 3.2 Whether geolocation is requested

**Locate:** command: `grep -n -i "geolocation\|navigator\.\|getCurrentPosition\|watchPosition\|latitude\|longitude\|coords" src/App.js public/index.html` | result: `none in code`

The only hits are inside the two base64 strings. No permission is requested, nothing is sent, and there is no branch for refusal. `handleClockIn` sends `{ siteId: selectedSite }` and nothing else. The first API scout item 23 records that the API side is advisory too, and the Block 2 scout says the geofence write was removed in Block 1.

## 3.3 Whether the portal holds a current session or shift in state, and every field it reads

The one holder is `clockStatus` (`:140`). Every field read from it is tabulated in section 2.4. The shape the portal expects, reconstructed from those reads:

```js
{
  clockedIn: boolean,
  shift: { siteId, siteName, buildingName, floorNumber, clockInTime } | null,
  tasks: { total, completed }
}
```

`selectedSite` (`:141`) holds a site id chosen for clock in and nothing else. `supplyLogs` (`:147`) is a per-shift usage log kept client-side only, appended by `logSupplyUsage` at `:213` and never loaded from the API (`GET /api/supplies/my-usage` is uncalled). `currentTime` (`:151`) ticks every second for the wall clock and the elapsed timer:

```js
  useEffect(() => { const i = setInterval(() => setCurrentTime(now()), 1000); return () => clearInterval(i); }, []);
```

That interval re-renders the whole root every second regardless of tab.

## 3.4 What happens on first load for someone who has just activated and has no session

There is no activation screen (section 5.2), so "just activated" means the person set a PIN through some other client and opened the portal URL.

1. `screen` starts at `"login"` (`:138`). `LoginScreen` renders with the label "Phone Number or Email" and placeholder "2155550101 or name@email.com" (`:365`). A badge number typed into that field reaches the API as `phone`, which the Block 2 scout section 6 confirms the login route accepts and matches against `badge_number` first.
2. `handleLogin` (`:168`) runs five calls in order: `POST /api/auth/login`, `GET /api/auth/me`, `GET /api/users/profile/me` (not awaited), `GET /api/clock/status` (awaited), `GET /api/clock/tasks/assigned` (not awaited), `GET /api/lookups/all` (not awaited, answers 403 for staff). Then `setScreen("main")` and the toast `"Welcome, " + me.user.firstName`.
3. `activeTab` is `"clock"` (`:139`). The person sees `ClockView`: the date, the wall clock at 44 pixels, "Your Assigned Sites" from `me.sites` or "No sites assigned yet.", and a gold "Clock In" button. Below it, `MyScheduleSection compact` loads `GET /api/pickups/my-schedule` for the current week.
4. Tapping "Clock In" with a site selected produces the red toast "Timekeeping is switched off. Clock in, clock out and payroll are recorded in ADP." Tapping it with none selected produces "Select a site first".
5. Tapping "Tasks" renders section 2.5.

The header shows the person's name, their role title-cased from `user.role` (`:258`), and no "ON SITE" pill (`:262`, gated on `clockedIn`).

---

# 4. Rendering the checklist

## 4.1 Every field of a task row the portal currently displays, in display order

**Locate:** find: `function TasksView(` | lines: `758 to 813`

The filter applied before anything renders, `:760`:

```js
  const standardTasks = tasks.filter(tk => !tk.task_type || tk.task_type === "standard");
```

**The clocked-in list, `:805` to `:811`, in display order:**

| Order | Where | Field or value | How it is rendered |
| --- | --- | --- | --- |
| 1 | header card | `clockStatus.shift.siteName` | under the label "Your Assignment" |
| 2 | header card | `clockStatus.shift.buildingName`, `clockStatus.shift.floorNumber` | `{buildingName}{floorNumber ? " - Floor " + floorNumber : ""}` |
| 3 | header card | `pct` | `Math.round((completed / standardTasks.length) * 100)` plus a progress bar |
| 4 | group header | `g.floor` (from `task.floor_number`) | `Floor {g.floor}`, shown once per floor change |
| 5 | group label | `g.zone` (from `task.zone`, default `"General"`) | uppercase gold label |
| 6 | row | `completedTaskIds.has(task.id)` | checkbox button, green when done |
| 7 | row | `task.label` | 12 pixel text, `line-through` when done |
| 8 | row | `task.has_details \|\| task.description \|\| task.media_url` | a 7 pixel blue dot after the label |
| 9 | row | `task.priority === "high"` | the chip `PRIORITY` |
| 10 | row | `task.cims_category` | a muted chip with the raw value |

The row, verbatim from `:810`:

```jsx
{g.tasks.map(task => { const done = completedTaskIds.has(task.id); const hasInfo = task.has_details || task.description || task.media_url; return (<div key={task.id} style={{ ...rowBase, background: done ? t.greenSubtle : t.card, border: done ? "1px solid " + t.greenBorder : "1px solid " + t.borderSolid, marginLeft: g.floor ? 8 : 0 }}><button onClick={() => toggleTask(task.id)} style={{ width: 22, height: 22, borderRadius: R.sm, border: "2px solid " + (done ? GREEN : t.textMut), background: done ? GREEN : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1, cursor: "pointer", padding: 0 }}>{done && <CheckIco sz={12} c="#F8F7F4" />}</button><div onClick={() => hasInfo ? setDetail(task) : toggleTask(task.id)} style={{ flex: 1, cursor: "pointer" }}><div style={{ fontSize: 12, fontWeight: 500, textDecoration: done ? "line-through" : "none", opacity: done ? 0.6 : 1, display: "flex", alignItems: "center", gap: 5, color: t.text }}>{task.label}{hasInfo && <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: BLUE, flexShrink: 0 }} />}</div></div><div style={{ display: "flex", gap: 4, flexShrink: 0, marginTop: 2 }}>{task.priority === "high" && <span style={chipPriority}>PRIORITY</span>}<span style={chipCat}>{task.cims_category}</span></div></div>); })}
```

Tapping the row body on a task without detail toggles it; with detail it opens the detail view.

**The detail view, `:783` to `:801`, in display order:**

| Order | Field | How it is rendered |
| --- | --- | --- |
| 1 | `detail.label` | 16 pixel heading |
| 2 | `detail.priority === "high"` | `PRIORITY` chip |
| 3 | `detail.cims_category` | muted chip |
| 4 | `detail.floor_number`, `detail.zone` | `{floor_number ? "Floor " + floor_number + " - " : ""}{zone}` |
| 5 | `detail.description` | under "Instructions", `whiteSpace: "pre-wrap"` |
| 6 | `detail.media_url` with `detail.media_type === "video"` | under "Reference Video", a `<video controls>` |
| 7 | `detail.media_url` otherwise | under "Reference Photo", an `<img>` |
| 8 | `detail.due_date` | "Due Date: " plus `toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })` |
| 9 | `detail.due_time` | "Time: " plus the raw value |
| 10 | `completedTaskIds.has(detail.id)` | the button label `"Uncheck Task"` or `"Mark Complete"` |

`due_time` is printed raw, so `14:30:00` renders as `14:30:00` beside 12-hour times elsewhere.

The complete set of task row keys the portal reads, across both views: `id`, `label`, `task_type`, `floor_number`, `zone`, `has_details`, `description`, `media_url`, `media_type`, `priority`, `cims_category`, `due_date`, `due_time`. Thirteen. **Never read on a task row:** `site_id`, `building_name`, `frequency`, `days_of_week`, `sort_order`, `estimated_minutes`, `shift_label`, `block_label`, `anchor_time`, `site_shift_block_id`, `assignment_id`.

## 4.2 Whether any grouping exists today, and what it groups on

**Locate:** find: `function groupTasksByFloorZone(taskList)` | lines: `751 to 756`

```js
function groupTasksByFloorZone(taskList) {
  const groups = []; const floorMap = {};
  taskList.forEach(t => { const floor = t.floor_number || null; const zone = t.zone || "General"; const key = (floor || "_none_") + "|" + zone; if (!floorMap[key]) { floorMap[key] = { floor, zone, tasks: [] }; groups.push(floorMap[key]); } floorMap[key].tasks.push(t); });
  groups.sort((a, b) => { if (a.floor && !b.floor) return -1; if (!a.floor && b.floor) return 1; if (a.floor && b.floor && a.floor !== b.floor) { const aNum = parseInt(a.floor); const bNum = parseInt(b.floor); if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum; return a.floor.localeCompare(b.floor); } return a.zone.localeCompare(b.zone); });
  return groups;
}
```

Groups on the pair `(floor_number, zone)`. `building_name` is ignored, so two buildings with the same floor number and zone collapse into one group. The default zone string `"General"` is hardcoded English.

## 4.3 Whether zone, frequency or any block field appears anywhere in the source

**Locate:** command: `grep -n -o "shift_label\|block_label\|anchor_time\|frequency\|days_of_week\|sort_order\|\.zone\|building_name\|floor_number" src/App.js`

| Term | Occurrences | Where |
| --- | --- | --- |
| `.zone` | 8 | `:753`, `:754` (grouping), `:774`, `:791`, `:810` (TasksView), `:854` (AssignedTasksView location string), `:927` (issue card), `:1300` (inspection item) |
| `floor_number` | 11 | `:207` (as `floorNumber` on the shift), `:637`, `:640` (schedule modal), `:753` (grouping), `:791` (detail), `:854` (AssignedTasksView), `:1078`, `:1132` (PickupView) |
| `building_name` | 7 | `:637`, `:639` (schedule modal), `:854` (AssignedTasksView), `:1077`, `:1131` (PickupView); never in TasksView |
| `sort_order` | 1 | `:163`, inside `getOpts`, sorting lookup values |
| `shift_label`, `block_label`, `anchor_time`, `frequency`, `days_of_week` | **0** | |

**Stated plainly: none of the block fields the checklist read now returns is read, displayed, grouped on or sorted by anywhere in this repository.**

## 4.4 How the list is sorted client-side

Groups are sorted by `groupTasksByFloorZone`: floors with a value before floors without, numerically when both parse as integers, else by `localeCompare`, and by `zone.localeCompare` within a floor. **Tasks inside a group keep the order the API returned them**, which after session two is `building_name, floor_number, sort_order, zone, label` per the addendum. Because the client regroups on floor and zone and ignores building, the API's building-first order is partly undone: rows from two buildings interleave inside a shared floor and zone group in API order.

`standardTasks.filter` at `:760` and the `.length === 0` checks are the only other list operations. There is no client-side sort on `label`, `priority` or any time.

## 4.5 Whether completed tasks are separated from open ones, and how completion state is held

They are not separated. Done and open rows sit in the same group in the same order; a done row gets `background: t.greenSubtle`, a green border, a filled green checkbox, `textDecoration: "line-through"` and `opacity: 0.6`.

Completion state is `completedTaskIds` (`:143`):

```js
  const [completedTaskIds, setCompletedTaskIds] = useState(new Set());
```

| Written at | Value |
| --- | --- |
| 143 | `new Set()` |
| 192 | `new Set()` on logout |
| 203 | `new Set()` on clock out |
| 208 | add or delete one id after a successful toggle |

**It is never read from the server.** Neither `GET /api/sites/:id/tasks` nor `GET /api/clock/status` supplies completed ids; the status route supplies only the pair `tasks: { total, completed }`, which drives the progress bar in `ClockView` (`:743`). The percentage in the `TasksView` header card is computed from `completedTaskIds` (`:780`, `:781`), so the two percentages on the Home and Tasks screens come from different sources and disagree after any refresh.

> **CRITICAL: The rewire needs a completed-ids read the API does not expose**
>
> The Block 2 scout enumerates every reader of `task_completions`: two counts (`sessionTaskProgress`, the by-site view), the report counter, the timeline detail branch and a cascade delete. No route returns the list of `task_template_id` values completed in the current session. Without one, the checkbox state on the rewired Tasks view will still be session-local. `GET /api/shift-sessions/today` returns `{ today, session, tasks }` with `tasks` as `{ total, completed }`, the same pair. This is an API addition the portal rewire depends on, or a known defect the rewire ships with.

---

# 5. Authentication, activation and the token

## 5.1 The login route, the request body, and where the token is stored

**Locate:** find: `const handleLogin = async (phone, pin) =>` | line: `168`

```js
  const handleLogin = async (phone, pin) => {
    setLoading(true);
    try {
      const data = await api("/api/auth/login", { method: "POST", body: { phone, pin } });
      setToken(data.token);
      const me = await api("/api/auth/me", { token: data.token });
      setUser(me.user); setSites(me.sites);
      api("/api/users/profile/me", { token: data.token }).then(p => { if (p?.user?.profilePhotoUrl) setUser(prev => ({ ...prev, profilePhotoUrl: p.user.profilePhotoUrl })); }).catch(() => {});
      const cs = await api("/api/clock/status", { token: data.token });
      setClockStatus(cs);
      if (cs.clockedIn) setSelectedSite(cs.shift.siteId);
      loadAssignedTasks(data.token);
      api("/api/lookups/all", { token: data.token }).then(setLookups).catch(e => console.warn("Lookups:", e.message));
      setScreen("main"); showToast("Welcome, " + me.user.firstName);
    } catch (err) { showToast(err.message, "error"); }
    setLoading(false);
  };
```

Route `POST /api/auth/login`. Body `{ phone, pin }`. The `phone` key carries whatever was typed into the field labeled "Phone Number or Email"; the Block 2 scout section 6 confirms the API reads `identifier` first and falls back to `phone`, and resolves a badge number, a phone or an email from it. The response fields read are `data.token` and nothing else; `user` comes from the separate `/api/auth/me` call as `me.user` and `me.sites`.

**Where the token is stored.** `:135`:

```js
  const [token, setToken] = useState(null);
```

React state only. `localStorage` is touched in exactly two places, both for the theme (`:155`, `:157`). No `sessionStorage`, no cookie, no IndexedDB. The token is threaded by prop to seven components (`MyScheduleSection`, `ChatView`, `AssignedTasksView`, `IssuesView`, `PickupView`, `InspectView`, `MyProfileView`) and passed per call as `{ token }`.

The login card inputs, `:365` and `:366`:

```jsx
        <div style={{ marginBottom: 16 }}><label style={labelSt}>Phone Number or Email</label><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="2155550101 or name@email.com" style={inputSt} onKeyDown={e => e.key === "Enter" && onLogin(phone, pin)} /></div>
        <div style={{ marginBottom: 24 }}><label style={labelSt}>PIN</label><input value={pin} onChange={e => setPin(e.target.value)} placeholder="4-digit PIN" type="password" maxLength={4} style={{ ...inputSt, letterSpacing: "8px", textAlign: "center", fontSize: 20 }} onKeyDown={e => e.key === "Enter" && onLogin(phone, pin)} /></div>
```

Neither input has `name`, `id`, `inputMode`, `pattern` or `autoComplete`. The PIN field opens the full keyboard on a phone.

> **CRITICAL: Two live credentials on the login card**
>
> `:352` to `:355` and `:369` to `:371`:
>
> ```js
>   const demos = [
>     { name: "Ibrahim Souadda", role: "Admin (test)", phone: "isouadda@ocsaco.com", pin: "2580" },
>     { name: "Daniel Evans", role: "Custodial Laborer | PLA", phone: "daniel.evans@ocsa.temp", pin: "1357" },
>   ];
> ```
>
> ```jsx
>           <div style={{ fontSize: 10, color: GOLD, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8, fontWeight: 600 }}>Demo Accounts (Live Data)</div>
>           {demos.map(d => (<button key={d.phone} onClick={() => { setPhone(d.phone); setPin(d.pin); }} style={{ ... }}><div><span style={{ fontSize: 12, fontWeight: 600 }}>{d.name}</span><span style={{ fontSize: 10, color: t.textMut, marginLeft: 8 }}>{d.role}</span></div><span style={{ fontSize: 10, color: t.textMut, fontFamily: "monospace" }}>PIN: {d.pin}</span></button>))}
> ```
>
> The dashboard scout found the same admin PIN in the dashboard bundle. The earlier portal scout reported this and it is unchanged. The line `Connected to Live API` at `:363` is a static string with no check behind it.

## 5.2 Whether the activation and reset link targets exist as screens

**Locate:** command: `grep -n -i "activate\|reset-pin\|resetpin\|window.location\|URLSearchParams\|location.search\|location.hash" src/App.js` | result: `none`

**Stated plainly: `/activate?token=` renders nothing of its own, and `/reset-pin?token=` renders nothing of its own.** Both paths load the same bundle, `screen` starts at `"login"`, and the login card renders with the token untouched in the address bar. There is no code that reads `window.location`, `document.location`, `URLSearchParams` or the hash anywhere in the repository. `screen` has three values and no fourth. Vercel serves the SPA for any path by default, so neither link produces a 404; each produces the login card.

The mailer per the Block 2 scout section 7 builds `STAFF_PORTAL_URL + "/activate?token=..."` and `STAFF_PORTAL_URL + "/reset-pin?token=..."`, and the addendum section 4 proves a real reset link resolved to `https://ocsa-staff-portal.vercel.app/reset-pin?token=...`. Every activation email sent before the rewire ships points at a screen that does not exist.

The routes the screens would call, all public per the Block 2 scout section 6: `GET /api/auth/activate/:token`, `POST /api/auth/activate` (body carries `pin`, `badgeNumber`, a language, per the handler at `auth.js:285`), `POST /api/auth/reset/request`, `GET /api/auth/reset/:token`, `POST /api/auth/reset`. The `api()` wrapper at `:95` already supports a token-less call, which is how login and register use it.

`RegisterScreen` (`:379` to `:402`) is the closest existing model for a token-less full-page card. Its PIN confirm fails silently, `:397`:

```jsx
        <button onClick={() => { if (pin !== pin2) return; onRegister(fn, ln, ph, em, pin); }} disabled={loading} ...>{loading ? "Registering..." : "Register"}</button>
```

`RegisterScreen` does not receive `showToast`, which is why. An activation screen should take it.

## 5.3 What happens on a 401

**Locate:** find: `ocsa-session-expired` | lines: `13, 26, 99, 160, 1436`

Four dispatchers (`uploadPhoto`, `uploadTaskMedia`, `api`, the inline profile-photo fetch), one listener:

```js
  useEffect(() => { const h = () => { setToken(null); setUser(null); setScreen("login"); }; window.addEventListener("ocsa-session-expired", h); return () => window.removeEventListener("ocsa-session-expired", h); }, []);
```

It clears `token` and `user` and shows the login card. It does **not** clear `clockStatus`, `sites`, `tasks`, `completedTaskIds`, `assignedTasks`, `issues`, `supplies`, `supplyLogs`, `channels`, `messages`, `activeChannel`, `lookups`, `selectedSite` or `activeTab`. `handleLogout` at `:192` clears six of those (`clockStatus`, `sites`, `tasks`, `completedTaskIds`, `selectedSite`, `activeTab`). So after a 401 the next login inherits stale lists and the previous `activeTab`, and the `useEffect` at `:219` fires against the old tab immediately. There is no toast, no message, no refresh token and no retry. No branch exists for 403, 409 or 410 beyond the generic `err.error` toast.

## 5.4 Whether a session survives a page refresh

**No.** The token is in memory only (5.1). A refresh, a new tab, a browser restart, or iOS evicting a backgrounded tab returns the person to the login card. The 12-hour JWT expiry the first API scout quotes is never reached in practice. The theme choice is the only thing that survives.

---

# 6. The existing chat surface

## 6.1 Every component involved in chat, with its line range

| Lines | Name | Role |
| --- | --- | --- |
| 148-150 | `channels`, `messages`, `activeChannel` | root state |
| 215 | `loadChannels` | `GET /api/chat/channels` into `channels` |
| 216 | `loadMessages(channelId)` | `GET /api/chat/channels/:id/messages` into `messages` (replace, never append) |
| 217 | `sendMessage(channelId, text)` | `POST /api/chat/channels/:id/messages` then appends `data.message` |
| 219 | the tab effect | calls `loadChannels()` when `activeTab === "chat"` |
| 220 | the channel effect | on `activeChannel` change: `loadMessages(activeChannel)` then `setTimeout(() => loadChannels(), 600)` |
| 221 | the polling effect | `setInterval(() => loadMessages(activeChannel), 12000)` while `activeTab === "chat"` and `activeChannel` is set |
| 230 | `{ id: "chat", label: "Chat", icon: ChatIco }` | the primary tab |
| 275 | the mount line | `<ChatView channels={channels} messages={messages} activeChannel={activeChannel} setActiveChannel={setActiveChannel} sendMessage={sendMessage} user={user} t={t} token={token} />` |
| 815-841 | `ChatView` | the whole screen |
| 115, 116, 128 | `ChatIco`, `SendIco`, `LockIco` | icons |

`ChatView` receives `token` and never reads it; every fetch is in the root. The three root functions and the three effects, verbatim:

```js
  const loadChannels = async () => { try { const data = await api("/api/chat/channels", { token }); setChannels(data); } catch (err) { console.error(err); } };
  const loadMessages = async (channelId) => { try { const data = await api("/api/chat/channels/" + channelId + "/messages", { token }); setMessages(data); } catch (err) { console.error(err); } };
  const sendMessage = async (channelId, text) => { try { const data = await api("/api/chat/channels/" + channelId + "/messages", { method: "POST", body: { text }, token }); setMessages(prev => [...prev, data.message]); } catch (err) { showToast(err.message, "error"); } };
```

```js
  useEffect(() => { if (activeChannel) { loadMessages(activeChannel); setTimeout(() => loadChannels(), 600); } }, [activeChannel]);
  useEffect(() => { if (activeTab !== "chat" || !activeChannel) return; const iv = setInterval(() => loadMessages(activeChannel), 12000); return () => clearInterval(iv); }, [activeTab, activeChannel]);
```

## 6.2 The routes it calls, the polling interval, and how messages are rendered

| Route | Method | Body | Response fields read |
| --- | --- | --- | --- |
| `/api/chat/channels` | GET | | an array; per row `id`, `type` (`"site"`, `"general"`, `"admin_dm"`), `name`, `siteName`, `unreadCount` |
| `/api/chat/channels/{id}/messages` | GET | | an array; per row `id`, `senderId`, `senderRole`, `senderName`, `text`, `sentAt` |
| `/api/chat/channels/{id}/messages` | POST | `{ text }` | `data.message`, appended as-is |

**Polling interval: 12,000 milliseconds**, one `GET .../messages` per tick, replacing the whole `messages` array. It runs only while the Chat tab is active and a channel is selected, and clears on tab change. There is no `before` or `limit` query, so each poll fetches the API's default page (50 per the first API scout item 6, maximum 100). Channels are refreshed on tab entry and 600 milliseconds after each channel switch (for the unread count), never on the poll.

The message render, `:832`:

```jsx
        {messages.map((msg, idx) => { const isMe = msg.senderId === user?.id; const isAdm = msg.senderRole === "admin" || msg.senderRole === "supervisor"; const showName = idx === 0 || messages[idx - 1].senderId !== msg.senderId; return (<div key={msg.id} style={{ display: "flex", flexDirection: isMe ? "row-reverse" : "row", gap: 8, marginBottom: showName ? 12 : 4, alignItems: "flex-end" }}>{!isMe && showName && (<div style={{ width: 28, height: 28, borderRadius: "50%", background: isAdm ? (isDm ? "rgba(52,152,219,0.15)" : t.goldBg) : t.cardAlt, border: "1px solid " + (isAdm ? (isDm ? BLUE : GOLD) : t.borderSolid), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: isAdm ? (isDm ? BLUE : GOLD) : t.textSec, flexShrink: 0, fontFamily: FONT_HEAD }}>{msg.senderName?.split(" ").map(n => n[0]).join("")}</div>)}{!isMe && !showName && <div style={{ width: 28, flexShrink: 0 }} />}<div style={{ maxWidth: "75%" }}>{!isMe && showName && <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 3, color: isAdm ? (isDm ? BLUE : GOLD) : t.textSec, fontFamily: FONT_HEAD }}>{msg.senderName}</div>}<div style={{ padding: "8px 12px", borderRadius: isMe ? "12px 12px 2px 12px" : "12px 12px 12px 2px", background: isMe ? (isDm ? BLUE : GOLD) : (isDm && isAdm ? t.blueSubtle : t.card), border: isMe ? "none" : "1px solid " + (isDm && isAdm ? t.blueBorder : t.borderSolid), color: isMe ? (isDm ? "#F8F7F4" : NAVY) : t.text, fontSize: 13, lineHeight: 1.45 }}>{msg.text}</div><div style={{ fontSize: 9, color: t.textMut, marginTop: 2, textAlign: isMe ? "right" : "left", fontFamily: FONT_HEAD, fontVariantNumeric: "tabular-nums" }}>{formatTime(msg.sentAt)}</div></div></div>); })}
```

Three visual variants: mine (right-aligned, gold or blue fill), theirs from management (initials avatar and name in gold or blue), theirs from staff (avatar and name in the muted color). Consecutive messages from one sender collapse the avatar and name. `msg.text` is rendered as plain text in a `<div>`, so newlines collapse and nothing is parsed as markdown or links.

The channel header, `:825` and `:826`: site and general channels as pill buttons labeled `ch.name || ch.siteName`; the admin DM as a wide button labeled "Admin (Private)" with the copy "Only you and management can see these messages" and a red unread count. The DM banner at `:828`: "Private conversation with admin."

## 6.3 How the message list handles a long conversation, and whether input is a single line

The list container, `:829`:

```jsx
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 12px 0" }}>
```

inside a column whose height is `calc(100vh - 128px)` (`:823`). Every render scrolls to the bottom:

```js
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);
```

There is no load-more, no scroll-position preservation, no `before` cursor, and no cap. A conversation longer than the API's default page shows only the newest page and never the rest; a poll that returns the same count leaves the scroll alone, and a poll that returns a new message scrolls to the bottom whether or not the person was reading older messages.

The composer, `:836` and `:837`:

```jsx
        <input value={text} onChange={e => setText(e.target.value)} placeholder={isDm ? "Private message to admin..." : "Type a message..."} style={{ flex: 1, padding: "10px 14px", borderRadius: R.pill, border: "1px solid " + (isDm ? t.blueBorder : t.borderSolid), background: t.card, color: t.text, fontSize: 13, outline: "none", fontFamily: FONT_BODY }} onKeyDown={e => e.key === "Enter" && handleSend()} />
        <button onClick={handleSend} style={{ width: 38, height: 38, borderRadius: "50%", ... }}><SendIco sz={16} c={text.trim() ? (isDm ? "#F8F7F4" : NAVY) : t.textMut} /></button>
```

**A single-line `<input>`.** Enter sends. There is no multiline entry, no Shift plus Enter, and the send button is 38 by 38 pixels. `handleSend` at `:821` trims and refuses empty text.

## 6.4 Whether anything renders a system-authored message differently from a person's

**No.** The only sender distinctions are `isMe` (by `senderId`) and `isAdm` (by `senderRole` in `admin` or `supervisor`). A message with no `senderName` renders an empty avatar circle; a message with a `senderRole` outside those two values renders in the staff style. There is no `senderType`, no `isSystem`, no bot flag, no typing indicator, no delivery state, no citation or source rendering, and no message kind other than text. A compliance agent tab that reuses `ChatView` inherits a person-to-person model; the `agent_conversations` and `agent_messages` tables the bundle README names have no counterpart in this file.

---

# 7. Mobile

## 7.1 Every viewport meta tag, media query and responsive layout technique in use

**Viewport meta**, `public/index.html:5`:

```html
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
```

`user-scalable=no` and `maximum-scale=1` disable pinch zoom. Two Apple tags follow (`apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`) with no manifest behind them.

**Media queries: exactly one**, inside the `<style>` block at `:328` to `:342`:

```jsx
      <style>{`
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }
        @keyframes slideUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        html { -webkit-text-size-adjust: 100%; }
        input::placeholder, textarea::placeholder { color: ${t.textMut}; }
        select { color-scheme: ${themeMode}; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: ${t.scrollThumb}; border-radius: 2px; }
        .sp-content > div { flex: 1; display: flex; flex-direction: column; animation: slideUp 0.2s ease-out; }
        .sp-content { padding: 0 12px; }
        @media (min-width: 640px) { .sp-content { padding: 0 20px; } }
        button:active { opacity: 0.8; }
      `}</style>
```

The one query widens horizontal padding from 12 to 20 pixels above 640 pixels. `sp-content` is the only CSS class in the app.

**Responsive layout techniques**, every one inline:

| Technique | Where |
| --- | --- |
| `maxWidth: 960, margin: "0 auto"` centering | header `:251`, content `:270`, bottom nav `:302`, the two bottom sheets `:593`, `:1376` |
| `position: "fixed"` bottom nav with `padding: "8px 0 12px"` and body `padding: "0 0 76px 0"` | `:302`, `:269` |
| `position: "fixed"` More overlay, `width: "calc(100% - 32px)", maxWidth: 400` | `:285`, `:286` |
| bottom-sheet modals, `alignItems: "flex-end"`, `borderRadius: "16px 16px 0 0"`, a drag handle | `:592` to `:594`, `:1375`, `:1376` |
| `display: "grid"` with fixed column counts | seven columns `:499`, `:555`, `:558`; three columns `:287`; two columns `:598`, `:610`, `:638`, `:870`, `:1519`, `:1524`, `:1537`; `"2fr 1fr 1fr"` `:1532` |
| `flex: 1` rows and `flexWrap: "wrap"` chip rows | throughout; `:894`, `:940`, `:1076`, `:1130` |
| `height: "calc(100vh - 128px)"` | `ChatView` `:823` |
| `maxHeight: "85vh", overflowY: "auto"` | the inspection schedule modal `:1376` |
| `WebkitLineClamp: 2` | assigned task description `:894` |
| toast `maxWidth: "90%"` | `:326` |

There is no `dvh`, no `env(safe-area-inset-*)`, no `window.innerWidth` read, no orientation handling.

**Stated plainly: this is usable on a phone for the screens that work.** The layout is mobile-first (bottom tabs, bottom sheets, camera capture, 12 pixel gutters). The weak spots are the seven-column week grid at roughly 44 pixels per day on a 360 pixel phone with 9 and 8 pixel text inside each cell (`:499` to `:532`), the `100vh` chat height under a collapsing mobile Safari toolbar (`:823`), the three-column City, State, Zip row (`:1532`), and the disabled zoom.

## 7.2 The smallest tap target on the Tasks view

**Locate:** find: `width: 22, height: 22` | lines: `774, 810`

The checkbox: `width: 22, height: 22, borderRadius: R.sm, border: "2px solid " + (done ? GREEN : t.textMut), ... padding: 0` on a `<button>` at `:810`. **22 by 22 pixels.** The row around it is `padding: "11px 13px"` (`rowBase`, `:764`), so the row body beside the checkbox is a taller target, and tapping the label on a task without detail also toggles it. The 7 pixel blue dot is decoration on the label, not a target. Other targets on the view: "Back to checklist" (`padding: "8px 13px"`, 12 pixel text, about 34 pixels tall, `:787`), "Mark Complete" (`padding: "14px"`, full width, `:797`), and the bottom nav buttons (22 pixel icon plus 9 pixel label plus 8 pixels of padding, about 45 pixels tall, `:307`). The header avatar is the only element with an explicit `minWidth: 44, minHeight: 44` (`:253`).

## 7.3 Whether anything assumes a hover state

**Locate:** command: `grep -n -o ":hover\|onMouseEnter\|onMouseOver\|title=" src/App.js` | result: `one title= at :263`

No `:hover` rule exists; the one interaction rule is `button:active { opacity: 0.8; }`. The single hover-dependent affordance is the tooltip on the theme toggle:

```jsx
                <button onClick={toggleTheme} title={themeMode === "dark" ? "Light mode" : "Dark mode"} style={{ ... }}>{themeMode === "dark" ? <SunIco sz={15} c="#A8B8C8" /> : <MoonIco sz={15} c="#A8B8C8" />}</button>
```

A `title` attribute never shows on touch. `cursor: "pointer"` appears 70 times and is harmless on touch. Nothing else assumes a pointer.

## 7.4 Whether photo capture uses the camera directly, and what the upload path is

**Locate:** command: `grep -n -o 'type="file"[^/]*' src/App.js` | lines: `862, 892, 923, 1311, 1494`

| Line | Component | Input | Capture |
| --- | --- | --- | --- |
| 862, 892 | `AssignedTasksView` | `<input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: "none" }} />` | rear camera directly |
| 923 | `IssuesView` | same attributes | rear camera directly |
| 1311 | `InspectView` | `<input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={...} />` | rear camera directly |
| 1494 | `MyProfileView` | `<input type="file" accept="image/*" style={{ display: "none" }} onChange={...} />` | gallery or camera, no `capture` |

**The Tasks view has no photo capture at all.** Task completion sends `body: {}`; the API's optional `photoUrl` on the completion route is never used.

The upload path, `uploadPhoto` at `:6`:

```js
async function uploadPhoto(file, token) {
  const ext = file.name.split(".").pop().toLowerCase();
  const res = await fetch(API + "/api/uploads?bucket=issue-photos&ext=" + encodeURIComponent(ext), {
    method: "POST",
    headers: { "Authorization": "Bearer " + token, "Content-Type": file.type },
    body: file,
  });
  if (res.status === 401) { window.dispatchEvent(new Event("ocsa-session-expired")); throw new Error("Session expired"); }
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Photo upload failed"); }
  const data = await res.json();
  return data.url;
}
```

The raw `File` is the request body; no `FormData`, no multipart field. `uploadTaskMedia` at `:19` is the same against `bucket=task-media` and returns the whole JSON (`result.url` read at `:1233`). `MyProfileView` at `:1432` compresses first (`compressImage(file, 800, 0.85)`) and posts `bucket=profile-photos&ext=jpg`. The Block 2 scout says Block 1 reduced the bucket allowlist to four and derives the content type from the extension server-side, so `file.type` in the header is now ignored; all three buckets this app uses remain allowed.

Size gates: 10 MB in `AssignedTasksView` and `IssuesView` (`:850`, `:911`), 20 MB in `MyProfileView` (`:1428`), none in `InspectView`. Only the profile path compresses; the resolve-task photo, which the API requires for a `resolved` status, uploads the full-resolution original.

---

# 8. Language

## 8.1 Whether any string appears in Spanish anywhere

**Locate:** command: `grep -n -i "spanish\|espanol\|lang=" src/App.js public/index.html` | result: `public/index.html:2 <html lang="en">` only

No Spanish string exists in `src/`, `public/`, `package.json` or `CLAUDE.md`. Every user-facing string is English.

## 8.2 Whether a locale is held in state or read from the user record

No locale is held in state. The one language value in the app is `preferredLanguage` on the profile, and it is displayed and edited without being consumed:

```js
      preferredLanguage: u.preferredLanguage || "English", personalNotes: u.personalNotes || ""
```

```jsx
            <div style={{ fontSize: 11, color: t.textMut }}>Language<div style={valSt}>{u.preferredLanguage || "English"}</div></div>
```

```jsx
          <div style={{ marginBottom: 10 }}><label style={labelSt}>Preferred Language</label><input value={form.preferredLanguage || ""} onChange={e => setForm({ ...form, preferredLanguage: e.target.value })} style={inputSt} /></div>
```

(`:1455`, `:1521`, `:1541`, saved by `PATCH /api/users/profile/me` with the whole `form` at `:1463`.) It is a free-text input that defaults to the string `"English"`. The bundle README says the API normalized every row to `en`; the first cleaner who opens Edit and taps Save writes `English` over `en`, the same defect the dashboard scout found on the admin side. Nothing reads it back to change any behavior. There is no i18n library, no dictionary, no translate function, and the identifier `t` is the theme object on roughly 700 lines. Date and time formatting is pinned to `"en-US"` in 12 calls.

## 8.3 Every user-facing string that would need translating on the Tasks view, counted

Every literal a person can read on the Tasks tab, its detail view and the toggle toast, with the line it lives on:

| # | String | Line |
| --- | --- | --- |
| 1 | `Tasks` (the tab label) | 229 |
| 2 | `Task completed` (toast) | 208 |
| 3 | `General` (default zone) | 753 |
| 4 | `Clock in to check off tasks. You can view your task list below.` | 771 |
| 5 | `No tasks loaded. Clock in to a site to see your checklist.` | 772 |
| 6 | `Floor ` (the floor header prefix, also used as `"Floor " + n + " - "` and `" - Floor " + n`) | 774, 791, 807, 810 |
| 7 | `Loading tasks...` | 778 |
| 8 | `Back to checklist` | 787 |
| 9 | `PRIORITY` | 790, 810 |
| 10 | `Instructions` | 792 |
| 11 | `Reference Video` | 793 |
| 12 | `Reference Photo` | 794 |
| 13 | `Task reference` (image alt text) | 794 |
| 14 | `Due Date: ` | 795 |
| 15 | `Time: ` | 795 |
| 16 | `Uncheck Task` | 797 |
| 17 | `Mark Complete` | 797 |
| 18 | `Your Assignment` | 807 |

**Eighteen distinct strings.** Excluded from the count: the API error text surfaced by `showToast(err.message, "error")` at `:208` (25 such call sites across the file, untranslatable from this repository), the `en-US` date format at `:795`, and the admin-authored content rendered from task rows (`label`, `zone`, `description`, `cims_category`, `floor_number`), which a dictionary cannot reach.

---

# 9. Every API route this repository calls

**Locate:** command: `grep -n -o '"/api/[^"]*"' src/App.js` plus the three `API + "` raw fetches

Every call site, in file order. Method is what the call sends; path is quoted as written; body keys are the literal keys in the `body` object.

| # | Method | Path as written | Body | Line | Calling function, component |
| --- | --- | --- | --- | --- | --- |
| 1 | POST (raw) | `API + "/api/uploads?bucket=issue-photos&ext=" + encodeURIComponent(ext)` | the `File` | 8 | `uploadPhoto`, called from `AssignedTasksView.handleResolve` (852) and `IssuesView.handleSubmit` (913) |
| 2 | POST (raw) | `API + "/api/uploads?bucket=task-media&ext=" + encodeURIComponent(ext)` | the `File` | 21 | `uploadTaskMedia`, called from `InspectView.handlePhotoUpload` (1232) |
| 3 | GET | `"/api/clock/tasks/assigned"` | | 162 | `loadAssignedTasks`, `OCSAStaffPortal` |
| 4 | POST | `"/api/auth/login"` | `{ phone, pin }` | 171 | `handleLogin` |
| 5 | GET | `"/api/auth/me"` | | 173 | `handleLogin` |
| 6 | GET | `"/api/users/profile/me"` | | 175 | `handleLogin` (photo only) |
| 7 | GET | `"/api/clock/status"` | | 176 | `handleLogin` |
| 8 | GET | `"/api/lookups/all"` | | 180 | `handleLogin` |
| 9 | POST | `"/api/auth/register"` | `{ firstName, lastName, phone, email, pin }` | 188 | `handleRegister` |
| 10 | POST | `"/api/clock/in"` | `{ siteId: selectedSite }` | 197 | `handleClockIn` |
| 11 | GET | `"/api/clock/status"` | | 197 | `handleClockIn` |
| 12 | POST | `"/api/clock/out"` | `{}` | 203 | `handleClockOut` |
| 13 | GET | `"/api/sites/" + clockStatus.shift.siteId + "/tasks?user_id=" + user.id` plus optional `&building_name=`, `&floor_number=` | | 207 | `loadTasks` |
| 14 | GET | `"/api/clock/status"` | | 207 | `loadTasks` |
| 15 | DELETE | `"/api/clock/tasks/" + taskId + "/complete"` | | 208 | `toggleTask` |
| 16 | POST | `"/api/clock/tasks/" + taskId + "/complete"` | `{}` | 208 | `toggleTask` |
| 17 | GET | `"/api/clock/status"` | | 208 | `toggleTask` |
| 18 | GET | `"/api/issues?limit=20"` | | 209 | `loadIssues` |
| 19 | PATCH | `"/api/clock/tasks/resolve/" + taskId` | `{ resolutionStatus, resolutionNote, photoUrl }` | 210 | `resolveAssignedTask` |
| 20 | POST | `"/api/issues"` | `{ siteId, title, description, zone, severity }` | 211 | `submitIssue` |
| 21 | POST | `"/api/issues/" + data.issue.id + "/photos"` | `{ photoUrl }` | 211 | `submitIssue` |
| 22 | GET | `"/api/supplies?site_id=" + clockStatus.shift.siteId` or `"/api/supplies"` | | 212 | `loadSupplies` |
| 23 | POST | `"/api/supplies/log-usage"` | `{ supplyId, quantity, siteId: clockStatus.shift.siteId, scanMethod: "manual" }` | 213 | `logSupplyUsage` |
| 24 | POST | `"/api/supplies/requests"` | `{ requestType, itemName, description, urgency, supplyId, siteId }` | 214 | `submitSupplyRequest` |
| 25 | GET | `"/api/chat/channels"` | | 215 | `loadChannels` |
| 26 | GET | `"/api/chat/channels/" + channelId + "/messages"` | | 216 | `loadMessages` |
| 27 | POST | `"/api/chat/channels/" + channelId + "/messages"` | `{ text }` | 217 | `sendMessage` |
| 28 | GET | `"/api/pickups/my-schedule?start_date=" + sd + "&end_date=" + ed` | | 439 | `MyScheduleSection.loadSchedule` |
| 29 | POST | `"/api/pickups/request-drop"` | `{ scheduled_shift_id, reason, notes }` | 686 | `MyScheduleSection` drop form |
| 30 | GET | `"/api/pickups/available"` | | 985 | `PickupView.loadAvailable` |
| 31 | GET | `"/api/pickups/my-pickups"` | | 994 | `PickupView.loadMyPickups` |
| 32 | POST | `"/api/pickups/" + id + "/claim"` | | 1006 | `PickupView.claimShift` |
| 33 | POST | `"/api/pickups/" + id + "/release"` | | 1021 | `PickupView.releaseShift` |
| 34 | GET | `"/api/inspections/scheduled?status=scheduled"` | | 1179 | `InspectView.loadList` |
| 35 | GET | `"/api/inspections/templates"` | | 1190 | `InspectView.openScheduleModal` |
| 36 | GET | `"/api/sites"` | | 1191 | `InspectView.openScheduleModal` |
| 37 | POST | `"/api/inspections/scheduled"` | `{ template_id, site_id, scheduled_date, assigned_to }` | 1206 | `InspectView.submitSchedule` |
| 38 | GET | `"/api/inspections/scheduled/" + id` | | 1214 | `InspectView.openInspection` |
| 39 | POST | `"/api/inspections/scheduled/" + active.id + "/complete"` | `{ scores: [{ template_item_id, score, notes, photo_url }], overall_notes }` | 1249 | `InspectView.submit` |
| 40 | GET | `"/api/users/profile/me"` | | 1418 | `MyProfileView.loadProfile` |
| 41 | POST (raw) | `API + "/api/uploads?bucket=profile-photos&ext=jpg"` | the compressed JPEG | 1433 | `MyProfileView.handlePhotoUpload` |
| 42 | POST | `"/api/users/profile/photo"` | `{ photoUrl }` | 1439 | `MyProfileView.handlePhotoUpload` |
| 43 | PATCH | `"/api/users/profile/me"` | the whole `form` object (`birthday`, `addressLine1`, `addressLine2`, `city`, `state`, `zipCode`, `emergencyContactName`, `emergencyContactPhone`, `preferredLanguage`, `personalNotes`) | 1463 | `MyProfileView.saveProfile` |

Forty-three call sites, 37 distinct method-and-path pairs (the uploads route counted once).

## 9.1 Routes called that do not exist, or answer as if they did not, per the API scouts

| Call | Rows | Status per the scouts | What the cleaner sees |
| --- | --- | --- | --- |
| `POST /api/clock/in` | 10 | exists, `requireTimekeeping`, **410** while the flag is off (Block 2 section 4) | red toast: "Timekeeping is switched off. Clock in, clock out and payroll are recorded in ADP." |
| `POST /api/clock/out` | 12 | same, **410** | same toast; unreachable anyway because the button reads "Clock In" while `ci` is false |
| `GET /api/lookups/all` | 8 | exists, gated `requireCapability("manage_lookups")`, admin only by default (Block 2 section 11); **403** for every staff role | nothing; `console.warn("Lookups:", ...)`, `lookups` stays `[]`, every `getOpts` select uses its hardcoded fallback array, `lkHasOther` is always false, `lkColorMap` is always `{}` |
| `POST /api/supplies/log-usage` with `siteId: clockStatus.shift.siteId` | 23 | exists; answers **409** `NO_SITE_SESSION` when the body has no `siteId` and no session (Block 2 section 3) | unreachable: `SuppliesView` returns its clocked-out branch at `:949` and never renders the "Log Usage" button; if reached, `clockStatus.shift` is null and `:213` throws a TypeError before the request |
| `POST /api/clock/tasks/:id/complete`, `DELETE` | 15, 16 | exist, live, answer **409** `NO_SITE_SESSION` with no session | unreachable today, section 2.9 |
| `GET /api/clock/status` | 7, 11, 14, 17 | exists, reshaped, **response unquoted** (section 2.4) | today, presumably a no-session shape; the portal reads `cs.clockedIn` as falsy either way |

Routes whose existence the scouts do not confirm, listed rather than declared dead: `GET /api/issues?limit=20` and `POST /api/issues` (the dashboard scout lists `issues.js` `GET /` as unverified; `POST /api/issues/:id/photos` is confirmed by the first API scout item 9); `GET /api/inspections/scheduled`, `POST /api/inspections/scheduled`, `GET /api/inspections/scheduled/:id` (the first scout quotes `GET /templates` at item 15 and `POST /scheduled/:id/complete` at item 18, and enumerates nothing else in `inspections.js`). Every other row resolves to a route a scout names.

## 9.2 Routes the API exposes for staff that nothing here calls

| Route | Why it matters for the rewire |
| --- | --- |
| `GET /api/shift-sessions/sites` | the site choices for Start Shift, `{ today, timeZone, scheduled, assigned, all }`; the replacement for "Your Assigned Sites" |
| `GET /api/shift-sessions/today` | `{ today, session, tasks }`; the replacement for `GET /api/clock/status` on the task path, with `session` in the `sessionView` shape (`id`, `userId`, `siteId`, `siteName`, `sessionDate`, `buildingName`, `floorNumber`, `source`, `scheduledShiftId`, `isAssignedSite`, `startedAt`, `elapsedMinutes`) |
| `POST /api/shift-sessions` | Start Shift, body `{ siteId, scheduledShiftId?, buildingName?, floorNumber? }`; the replacement for `POST /api/clock/in` |
| `GET /api/supplies/my-usage` | "This Shift's Log" from the server, `{ session, entries, totals }`; replaces the client-only `supplyLogs` |
| `GET /api/lookups` | the `authenticate`-only lookup list; replaces the 403 at `:180` |
| `GET /api/lookups/category/:slug`, `GET /api/lookups/site/:siteId` | per-category and per-site (zones, buildings, floors) reads |
| `GET /api/auth/activate/:token`, `POST /api/auth/activate`, `POST /api/auth/reset/request`, `GET /api/auth/reset/:token`, `POST /api/auth/reset` | the six public routes behind the two dead links in section 5.2 |
| `GET /api/clock/tasks/activity/:taskId` | assigned task history, unused |
| `GET /api/issues/my-tasks` | issue-linked tasks, unused (the Assigned tab reads `/api/clock/tasks/assigned` instead) |
| `GET /api/sites/:id` | site detail, unused |
| `GET /api/sites/:siteId/shift-blocks` | the block list session two built; gate unquoted by the scouts; nothing here reads blocks |

---

# 10. What the rewire faces

## 10.1 What state the Tasks view depends on, and where each piece originates

| State | Declared | Written by | Read by `TasksView` or its loader |
| --- | --- | --- | --- |
| `clockStatus` | 140 | `GET /api/clock/status` at 177, 197, 207, 208; literals at 140, 192, 203 | `clockedIn` (gate), `shift.siteId` (URL and header), `shift.siteName`, `shift.buildingName`, `shift.floorNumber` (URL and header) |
| `tasks` | 142 | `setTasks(tt)` at 207; `[]` at 192, 203 | the list, filtered to `task_type` standard |
| `completedTaskIds` | 143 | 143, 192, 203, 208 | checkbox state and the percentage |
| `user` | 136 | `me.user` at 174; photo merge at 175, 1441 | `user.id` in the URL |
| `token` | 135 | 172; null at 160, 192 | every `api()` call |
| `activeTab` | 139 | the nav buttons, 289, 307; `"clock"` at 192, 1481 | the effect at 219 |
| `t` | 156 | derived from `themeMode` | styling |
| `detail` (local) | 759 | 774, 787, 797, 810 | the detail view |

Nothing in `TasksView` reads `sites`, `selectedSite`, `lookups` or `currentTime`.

## 10.2 Anything that would break if the clock dependency were removed outright

Every read of `clockStatus` outside the Tasks path, with what happens when it is null or `clockedIn` is permanently false:

| Line | Read | Effect of removal |
| --- | --- | --- |
| 178 | `if (cs.clockedIn) setSelectedSite(cs.shift.siteId)` | dead branch |
| 192 | `if (clockStatus?.clockedIn) { showToast("Clock out before logging out", "error"); return; }` | dead guard; if a stub ever reports true, nobody can log out |
| 197, 203 | `handleClockIn`, `handleClockOut` | delete with `ClockView` |
| 211 | `const actualSiteId = siteId \|\| clockStatus?.shift?.siteId;` | falls to the explicit `siteId` from the issue form; safe |
| 212 | `clockStatus?.shift?.siteId ? "/api/supplies?site_id=" + ... : "/api/supplies"` | falls to the bare list; the Block 2 scout says the bare route scopes to the session's site, so the result with no session is undocumented |
| 213 | `siteId: clockStatus.shift.siteId` | **throws** `TypeError` on a null `shift`; the one unguarded read |
| 214 | `const siteId = clockStatus?.shift?.siteId \|\| null;` | sends null; the API fills it from the session, or stores null |
| 262 | the "ON SITE" pill | disappears |
| 702-749 | `ClockView` entire | the Home tab becomes a wall clock and a site list whose selection feeds nothing |
| 769, 807 | `TasksView` gate and `clockStatus.shift.siteName` in the header card | the gate is the subject of the rewire; the header read at `:807` has no optional chaining and throws if `clockedIn` is true with `shift` null |
| 913, 918 | `IssuesView` site fallback and the select's visibility | improves: the select always shows |
| 949 | `SuppliesView` clocked-out branch | permanent; the supply list and "Log Usage" never render |
| 159 | the one-second `currentTime` ticker | only `ClockView` consumes it; delete together or it keeps re-rendering the tree every second |
| 463 onward | `MyScheduleSection` `data.actual` lane, `clock_in_time`, `clock_out_time`, `duration_minutes`, `shift_status === "active"`, the "Worked" legend, "Still on site" | the API already returns an empty `actual` lane while the flag is off, so these render nothing; copy and legend remain |
| 1144 | `Clock in at the normal time and your daily tasks will load automatically.` | a false promise on the approved pickup card |

Copy strings that name clocking, all of which the rewire has to change or delete: `Clock in to check off tasks. You can view your task list below.`, `No tasks loaded. Clock in to a site to see your checklist.`, `Clock in to log usage. Requests can be submitted anytime.`, `Clock out before logging out`, `Clocked in at `, `Clocked out. Duration: `, `Select a site first`, `Time on Site`, `ON SITE`, `On Site`, `Still on site`, `Clock In`, `Clock Out`, `Clock in at the normal time and your daily tasks will load automatically.`, `This Shift's Log`, `Your Assignment`.

## 10.3 Whether src/App.js can be split

**Stated plainly: yes, mechanically. Nothing depends on definition order at call time, and no component reaches into another's closure.**

What the split has to carry:

1. **Module-level values read by more than one component.** `API` (`:4`), `uploadPhoto`, `uploadTaskMedia`, `compressImage`, the eight color consts (`:31` to `:33`), `LOGO_SM`, `LOGO_LG`, `FONT_HEAD`, `FONT_BODY`, `R`, `DARK`, `LIGHT`, `api`, `formatTime`, `formatDate`, `now`, the 21 icons, `mkLabel`, `mkInput`, `mkQtyBtn`, and `clientConfig`. Every one is a plain `const` or `function` that a `theme.js`, `api.js`, `icons.js` and `logos.js` can export. They are read at render time or call time, after every module has evaluated, so the order in which files import them does not matter.

2. **Function declarations used before their definition.** `LoginScreen` (`:347`) is rendered at `:246`; `EmptyState` (`:966`) is rendered inside `TasksView` at `:772` and `:778`; `groupTasksByFloorZone` (`:751`) is called at `:773` and `:779`; every view component is rendered at `:271` to `:280` and defined later. All are hoisted `function` declarations, so the order does not matter today and stops mattering with imports.

3. **Shared closure scope: none across components.** Each component takes everything through props. The root component's handlers (`loadTasks`, `toggleTask`, `loadIssues`, `submitIssue`, `loadSupplies`, `logSupplyUsage`, `submitSupplyRequest`, `loadChannels`, `loadMessages`, `sendMessage`, `resolveAssignedTask`, `loadAssignedTasks`, `getOpts`, `lkMap`, `lkColorMap`, `lkHasOther`) close over root state and are passed down. Only four of them use `useCallback` (`:161` to `:166`); the rest are recreated every render, which the one-second ticker makes every second.

4. **The `<style>` block.** It interpolates `t.textMut`, `themeMode` and `t.scrollThumb` (`:334` to `:337`), so it belongs with the root or with a theme provider.

5. **`InspectView` declares a local `sites` state (`:1172`) that shadows the root `sites` by name.** It receives no `sites` prop, so nothing breaks, and a split should rename it.

6. **Duplicate helpers a split can consolidate.** `fmtTm` in `MyScheduleSection` (`:420`) and `PickupView` (`:978`); `fmtDate` in `PickupView` (`:977`), `InspectView` (`:1159`) and `MyProfileView` (`:1424`); `fmtClockTm` (`:421`) duplicating `formatTime` (`:104`); the photo preview and `handlePhoto` pair in `AssignedTasksView` (`:850`) and `IssuesView` (`:911`).

The earlier portal scout's proposed fifteen-file split (its closing list 3) is consistent with the code as it stands and remains the right shape; only its `ClockScreen.js` row is moot once the clock goes.

## 10.4 The riskiest single thing about replacing this file in one commit

**The 65,332 bytes of base64 on lines 57 and 58, reproduced by hand in the same commit that changes the logic.** They are 29.3 percent of the file. `LOGO_LG` renders on the login card (`:360`); `LOGO_SM` on the register card (`:388`). A single dropped or altered character in either string makes the image fail to decode with no build error, since `npm run build` validates JavaScript and never decodes a data URI. There is no test, no lint script and no CI; a push to `main` deploys to Vercel automatically per `CLAUDE.md`, and the only check that exists is `npm run build`.

Two mitigations, both cheap: move the two constants into `src/assets/logos.js` in a commit that touches nothing else, so the rewire commit never has to carry them; or source the logo from the settings endpoint per the template-model rule in `CLAUDE.md`, which the dashboard scout notes the dashboard already does for report exports.

The second risk, close behind: every screen lives in one module, so one syntax error in the rewired `TasksView` takes down login, chat, schedule and the pickup board together, and the token-in-memory design means every verification pass on the deployed build starts from the login card.

Two things the earlier portal scout reported that this read corrects: it counted `EmptyState` at lines 966 to 969 and `MyScheduleSection` at 404 to 701, both one line long (the definitions end at 968 and 700); and it named the drop request `otherText` defect as sent nowhere, which is confirmed (`:686` sends `reason` and `notes` only). Everything else in that scout's Block 1 and Part B sections matches the source as read today.

---

# Closing

## Questions I could not answer from the code, and what would answer each

1. **The exact JSON `GET /api/clock/status` returns while the flag is off, with and without a `site_sessions` row.** No scout quotes it. `curl -H "Authorization: Bearer <token>" https://ocsa-api-production.up.railway.app/api/clock/status` for a user with no session, then once more after a `POST /api/shift-sessions` for the same user, answers it. This decides whether `TasksView` would work unchanged once a session exists, and whether `ClockView` at `:704` gets a `clockInTime` to subtract from.
2. **Whether `GET /api/supplies` with no query returns anything for a caller with no session.** The Block 2 scout says it scopes to the session's site unless `site_id` or `all=true` is passed. `loadSupplies` at `:212` sends neither when clocked out. One call answers it. The dashboard scout raised the same question for admins.
3. **Whether `GET /api/issues?limit=20`, `POST /api/issues`, `GET /api/inspections/scheduled`, `POST /api/inspections/scheduled` and `GET /api/inspections/scheduled/:id` exist with those paths.** They are in files the scouts did not enumerate. `grep -n "router\.\(get\|post\|patch\|delete\)" routes/issues.js routes/inspections.js` in `ocsa-api` settles all five.
4. **The key casing of the `assigned` and `scheduled` rows from `GET /api/shift-sessions/sites`.** The Block 2 scout elides the projections as `({ ... })`. The rewired site picker reads whichever keys they carry; the SQL aliases are `site_id`, `site_name`, `address_line1`, `city`, `role_at_site`, `shift_name`, `shift_start`, `shift_end`, and the `all` rows are mapped to `siteId`, `siteName`, `address`, `city`. One call or one read of `routes/shiftSessions.js:352` answers it.
5. **Whether any route returns the completed task ids for the current session.** The Block 2 scout's enumeration of `task_completions` readers says no. If that is right, the rewire either adds one to the API (`GET /api/shift-sessions/today` could carry `completedTaskIds`) or ships the session-local checkbox defect. `grep -n "task_completions" routes/*.js helpers/*.js` confirms the list.
6. **Whether the deployed Vercel build sets `REACT_APP_API_URL`.** The fallback is the production host, so the answer changes nothing today; it decides whether a preview deploy can ever point at a staging API.
7. **What `POST /api/chat/channels/:id/messages` returns.** `sendMessage` at `:217` appends `data.message` and the list render reads `senderId`, `senderName`, `senderRole`, `text`, `sentAt` from it. The first API scout quotes the INSERT `RETURNING *` (snake_case columns) and says nothing about the response projection. If the response is the raw row, the appended bubble renders with an empty name and `formatTime(undefined)` until the next poll replaces it. One send in the deployed app answers it.
8. **Whether the PIN `2580` at `:353` is still the live PIN for the admin account.** The dashboard scout raised the same question. Rotating it and deleting the block are both needed regardless.

## Completeness audit, items 1 through 10

| # | Item | Status | Files quoted from |
| --- | --- | --- | --- |
| 1 | Inventory: every file with line count, every component in order with range, navigation, imports and versions, lockfile, base URL and env vars | ANSWERED. 9 files, 1,561 lines, 14 components plus helpers and 21 icons with byte counts, two state strings and ten tab keys, 2 imports and 3 dependencies, lockfile committed, 2 env vars | src/App.js, package.json, .env, .gitignore, public/index.html, src/index.js, src/clientConfig.js |
| 2 | The task loading path: every condition with its line, the exact URL, every `/api/clock/` call with on-path or elsewhere, the false branch quoted, shift-sessions, completion route and body and site, `site_id` on the row, the two plain sentences | ANSWERED. Six conditions, the URL and its two suffixes, nine call sites over six routes, the branch at `:769` quoted in full, zero shift-sessions calls, `POST .../complete` with `{}` and no site, `site_id` never read on a row. No, and no | src/App.js, SCOUT_OUTPUT_API_BLOCK2.md, SCOUT_OUTPUT_API.md |
| 3 | Session start and site selection: any site chooser, geolocation, session state and every field, first load with no session | ANSWERED. Three pickers, none starting a session; no geolocation; `clockStatus` with eight fields read; the five-step first load | src/App.js |
| 4 | Rendering the checklist: every displayed field in order, grouping, block fields in source, client sort, completed separation and state | ANSWERED. Ten list fields and ten detail fields in order, thirteen row keys read; groups on floor and zone; zero block fields; group sort only; not separated, `completedTaskIds` never hydrated | src/App.js |
| 5 | Auth: login route and body and token storage, the two link targets, 401, refresh | ANSWERED. `POST /api/auth/login` `{ phone, pin }`, React state only; neither `/activate` nor `/reset-pin` renders anything; the 401 listener quoted with what it leaves behind; no survival | src/App.js, SCOUT_OUTPUT_API_BLOCK2.md, SCOUT_BLOCK2_ADDENDUM.md |
| 6 | Chat: every component with range, routes and interval and rendering, long conversations and input, system messages | ANSWERED. Eleven locations, three routes, 12,000 ms, the render quoted, no paging and a single-line input, no system rendering | src/App.js |
| 7 | Mobile: viewport and media queries and techniques, smallest Tasks tap target, hover, camera and upload path | ANSWERED. One viewport tag, one media query, ten techniques tabulated; 22 by 22 pixels; one `title` tooltip; `capture="environment"` on four inputs, raw `File` body to `/api/uploads`; the Tasks view captures nothing | src/App.js, public/index.html |
| 8 | Language: Spanish, locale state, Tasks view strings counted | ANSWERED. None; none, `preferredLanguage` free text defaulting to "English"; 18 strings | src/App.js, public/index.html |
| 9 | Every API route: the table, dead calls, unused staff routes | ANSWERED. 43 call sites over 37 method-and-path pairs; five dead or degraded calls plus five unverifiable ones listed separately; eighteen unused staff routes in eleven rows | src/App.js, all three API documents |
| 10 | The rewire: Tasks state and origins, clock removal breakage, split, riskiest thing | ANSWERED. Eight state values with origins; fifteen breakage rows and sixteen copy strings; split is mechanical with six carry items; the base64 lines | src/App.js, SCOUT_OUTPUT_PORTAL.md |

Totals: 10 items, 10 ANSWERED. Two sub-questions depend on `ocsa-api` and are carried in the list above with the command that settles each: the reshaped status response (item 2) and the existence of five routes (item 9).

Read-only, as instructed, with the one exception the prompt names. No code file was modified, `src/App.js`, `package.json` and every other tracked file are byte-identical to `30a32d5`, and the only commit on the branch adds this report.
