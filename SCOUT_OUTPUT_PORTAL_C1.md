# OCSA Scout: ocsa-staff-portal, completion hydration, read-only (C1)

Where completion state lives in the staff portal, every write and read of it, whether anything populates it from the server, the full boot sequence, what the checkbox reads, what the site picker shows for a building with no task templates, and seven exact edit anchors for the build that consumes the new `completedTaskIds` and `siteCompletedTaskIds` keys. Quoted from source so the build prompt can copy every find-string verbatim. Read against `SCOUT_OUTPUT_PORTAL_V2.md`, `SCOUT_OUTPUT_API_BLOCK2.md` and `SCOUT_BLOCK2_ADDENDUM.md`.

## Repo state

| Field | Value |
| --- | --- |
| Repository | ocsa-staff-portal |
| Branch read | `origin/main` at `1e173dd` (merge commit of pull request 6, dated 2026-09-09). The session checkout `claude/new-session-8ayt1a` points at the same commit. The local `main` ref in this container is stale at `30a32d5` and was not read |
| Mode | read-only scout |
| Files read | all 10 tracked files, `src/App.js` in full (2,031 lines, 251,727 bytes), plus the four bundle documents |
| Code changes made | none |
| Files written into the repository | one, this report, per the delivery instruction at the end of the prompt |
| Commits | one, carrying this file only |
| Working tree at end | clean apart from this file |
| `src/App.js` md5 at read time | `57cfea632322e8254bf4a727979a6805` |
| Report generated | 2026-09-10 |

Everything below was located by text pattern. Line numbers are a navigation aid at commit `1e173dd`. Code is quoted verbatim, with elisions marked `...`. The two base64 image literals on lines 57 and 58 are shown as `<BASE64_ELIDED>` where they appear inside a quoted line. `SCOUT_OUTPUT_PORTAL_V2.md` was read as a prior claim at `30a32d5`; every claim it makes that this report relies on was re-verified against the source at `1e173dd`, and the places where it is now stale are named in section 8.5.

> **CRITICAL: Read this before writing the hydration build prompt**
>
> 1. **The claim in the brief is verified. `completedTaskIds` starts as `new Set()` on every load, and nothing populates it from the server today.** It is declared at `src/App.js:217`, written by exactly five statements (the declaration, the 401 listener at `:234`, `handleLogout` at `:304`, and the add and delete inside `toggleTask` at `:314`), and none of them reads a response body. The server count `clockStatus.tasks.completed` drives the Home tab bar at `:1165`, so the count survives a reload and the boxes do not. Section 2.
> 2. **The portal never calls `GET /api/shift-sessions/today`. Zero occurrences.** The session fetch on every path is `GET /api/clock/status`, called at `:250` (boot and login, inside `hydrateSession`), `:309` (after Start Shift), `:313` (after the task fetch) and `:314` (after every tick and untick). The Block 2 scout says the same helper, `sessionTaskProgress`, is "the count behind GET /today and GET /clock/status". **Whether the API build puts the four new keys on `GET /api/clock/status` as well as on `/today` decides whether the portal edit is one line or a new fetch.** Section 0 says "every response carrying a task progress object", which covers it if the build honors that sentence. Confirm it with one call before writing the portal edit. Sections 3 and 8.
> 3. **The edit is one write, at one of four places, and the state shape does not change.** The state is a `Set` of template ids. The server sends an array. The write is `setCompletedTaskIds(new Set(cs.tasks.completedTaskIds || []))` beside `setClockStatus(cs)`. The cleanest single site is `:250` in `hydrateSession`, which runs on boot, on login and on activation. Putting it beside every `setClockStatus(cs)` (`:250`, `:309`, `:313`, `:314`) makes the server the source of truth on every refetch, and introduces the double-tap race in section 4.6. Section 7 gives a unique anchor for each. Section 8.
> 4. **The riskiest single line is a type mismatch, and there is no error boundary to catch it.** `completedTaskIds.has(...)` is called at `:314`, `:1208`, `:1212` and `:1238`. Writing the server array into state as an array makes `.has` throw `TypeError` on the first render of the Tasks tab, and because every screen lives in one root component with no error boundary (`grep -c 'componentDidCatch\|ErrorBoundary'` returns 0 in both source files), that exception blanks the whole portal. The build must wrap the array in `new Set(...)`. Section 8.2.
> 5. **Starting a shift at another site does not clear `completedTaskIds` or `tasks`.** `handleStartSession` at `:306` to `:311` writes `clockStatus` and `selectedSite` and switches the tab; the Set keeps the previous site's ids. Today that is invisible because template ids differ per site. Once hydration lands, a write on the `:309` path replaces the stale Set with the new session's list; a write only at `:250` leaves the stale Set until the next reload. Section 3.6.
> 6. **The two scopes cost the same one line in the portal and differ in three consequences.** `completedTaskIds` (this caller, this session) matches the count the Home bar already shows, matches the untick route's own scope (`DELETE` filters `user_id` and `site_session_id`), and shows only this person's boxes. `siteCompletedTaskIds` (anyone at this site today) makes the Tasks tab percentage at `:1208` and the Home bar at `:1165` disagree unless the Home bar also moves to `siteTotal`, lets a box show checked that this caller cannot uncheck (the `DELETE` updates zero rows for another person's completion), and lets a tick insert a second completion row for a template someone else already completed. This report does not recommend one. Section 8.1.
> 7. **A site with zero task templates is selectable and lands on the string "Loading tasks..." forever.** The site picker (`renderSite`, `:1134` to `:1150`) shows `siteName`, address and city, and building and floor, and no count. Nothing in the response it reads carries a task count. After Start Shift the Tasks tab fetches `GET /api/sites/:id/tasks?user_id=`, gets `[]`, and `:1206` renders `<EmptyState icon={CheckIco} text="Loading tasks..." t={t} />`. There is no loading flag, so an empty site, a failed fetch and a fetch still in flight all render the same card. Thirteen School District buildings hit this today. Section 5.
> 8. **The brief names the wrong third view for "Clock in".** The three lines are the Schedule worked-shift detail sheet (`:1029` "Clock In" and `:1033` "Clock Out"), the Supplies view (`:1379` "Clock in to log usage. Requests can be submitted anytime.") and the Pickup view approved card (`:1572` "Clock in at the normal time and your daily tasks will load automatically."). The profile screen (`MyProfileView`, `:1837` to `:2031`) carries no clock string; its only match is `setActiveTab("clock")`. Section 6.1.
> 9. **The word CIMS appears eight times in `src/App.js`, all as identifiers, and never as rendered text.** `task.cims_category` at `:1238` and `detail.cims_category` at `:1218` render the raw category value (for example `SD`) in a chip on the Tasks tab; `CIMS_C` at `:1585` and `item.cims_category` three times at `:1725` do the same on the Inspect tab. No other certification framework term appears anywhere in the repository. Report only, per the prompt. Section 6.2.
> 10. **No tick is guarded against a double tap.** `toggleTask` at `:314` reads `completedTaskIds.has(taskId)` from the render closure, awaits the request, then patches the Set. The checkbox button at `:1238` has no `disabled` attribute and `toggleTask` never touches `loading`. Two taps before the first response resolves send two `POST`s. Section 4.6.
> 11. **The prior scout's "cannot see a task list, cannot complete a task" is stale.** Both are possible today through `POST /api/shift-sessions` at `:309`. The one thing that does not survive a reload is the checkbox. Section 8.4.
> 12. **`src/App.js` is 2,031 lines and 251,727 bytes; lines 57 and 58 still hold the two base64 literals**, 16,825 and 48,505 characters (65,332 bytes with their two newlines), md5 `510001a18b8e2b1eb5061e656519918c` and `8eb693e5b163a72b16ac176b2a4b47e1` respectively. None of the seven anchors in section 7 is within 150 lines of them. Any tool that rewrites the whole file must leave those two lines byte-identical; the two md5 values are the check. Section 1.

## Table of contents

0. The API contract this portal will consume
1. Inventory, current
2. Completion state, in full
3. Boot and hydration
4. The task list and the checkbox
5. The site picker, and a site with no task templates
6. Two known strings
7. Edit anchors for the build that follows
8. What the build faces

Closing

- Questions I could not answer from the code
- Completeness audit, items 1 through 8

---

# 0. The API contract this portal will consume

Quoted from the API build prompt running in parallel, as the scout prompt quotes it. It is the authoritative statement and this report does not restate it in different words.

```json
{
  "tasks": {
    "total": 15,
    "completed": 4,
    "siteTotal": 131,
    "completedTaskIds": ["4f0e...", "9a21..."],
    "siteCompletedTaskIds": ["4f0e...", "9a21...", "c73b..."]
  }
}
```

- `total` and `completed` are unchanged.
- `siteTotal` is active task templates at the site, all of them, regardless of assignment.
- `completedTaskIds` is the distinct template ids behind `completed`: this caller, this session.
- `siteCompletedTaskIds` is the distinct template ids completed by anybody at this site on this session date.
- Both arrays are always present, never null, empty is `[]`, and neither carries an order guarantee.

Two scopes ship because the choice between them is a portal decision and it is not yet made. Section 8.1 reports what each would cost here. This report does not recommend one.

**What the portal reads from that object today**, so the build knows which of the four new keys land on code that already exists: `tasks.total` and `tasks.completed`, both read only inside `ClockView` at `:1123` and `:1165`. Section 3.4. `siteTotal`, `completedTaskIds` and `siteCompletedTaskIds` have zero occurrences in the repository today:

**Locate:** command: `grep -c "siteCompletedTaskIds\|siteTotal" src/App.js` | result: `0`

---

# 1. Inventory, current

## 1.1 src/App.js, the two base64 lines, and every tracked file

**Locate:** command: `wc -l -c src/App.js` | result: `2031 251727 src/App.js`

| Measure | Value at `1e173dd` | Value at `30a32d5` per the v2 scout |
| --- | --- | --- |
| Lines | 2,031 | 1,561 |
| Bytes | 251,727 | 223,061 |
| `useState(` | 108 | |
| `useEffect(` | 14 | |
| `useCallback(` | 8 | |
| `useRef(` | 4 | |

> **CONFIRMED: lines 57 and 58 still hold the base64 literals, and they have not moved**
>
> **Locate:** command: `grep -n -o 'data:image/[a-z]*;base64' src/App.js` | result: `57:data:image/png;base64` and `58:data:image/png;base64`, and nothing else
>
> | Line | Characters | Bytes with newline | md5 of the line with newline | Content |
> | --- | --- | --- | --- | --- |
> | 57 | 16,825 | 16,826 | `510001a18b8e2b1eb5061e656519918c` | `const LOGO_SM = "data:image/png;base64,<BASE64_ELIDED>";` |
> | 58 | 48,505 | 48,506 | `8eb693e5b163a72b16ac176b2a4b47e1` | `const LOGO_LG = "data:image/png;base64,<BASE64_ELIDED>";` |
>
> Together 65,330 characters, 65,332 bytes with the two newlines, which is the figure the brief carries. They are 26.0 percent of the file now (29.3 at `30a32d5`). Measured with `sed -n '57p' src/App.js | wc -c` and `sed -n '57p' src/App.js | md5sum`. A build session can run the same two commands after its edit and compare.

Every tracked file:

**Locate:** command: `git ls-files` | tracked files: `10`

| File | Lines | Bytes | What it is |
| --- | --- | --- | --- |
| package-lock.json | 17251 | 650159 | the npm lockfile, committed |
| src/App.js | 2031 | 251727 | the entire portal |
| SCOUT_OUTPUT_PORTAL_V2.md | 1226 | 103313 | the prior scout, committed by pull request 4 |
| .gitignore | 21 | 223 | ignores node_modules, build, coverage, `.env.*.local`, logs |
| CLAUDE.md | 27 | 1707 | project rules |
| public/index.html | 20 | | HTML shell, viewport meta, Google Fonts link, theme color placeholder |
| src/clientConfig.js | 20 | | client name, colors, ID prefix |
| package.json | 18 | 402 | dependencies and scripts |
| src/index.js | 6 | | `ReactDOM.createRoot` render of `<App />` in StrictMode |
| .env | 1 | 32 | `REACT_APP_THEME_COLOR="#0A1628"` |

There is still no test directory, no `.github` directory, no `vercel.json`, no `README`, no `lint` script and no `test` script. The only check that exists is `npm run build`.

The twelve longest lines, by `awk '{ print length($0) "\t" NR }' src/App.js | sort -rn | head -12`:

| Characters | Line | What it is |
| --- | --- | --- |
| 48505 | 58 | `LOGO_LG` |
| 16825 | 57 | `LOGO_SM` |
| 2461 | 1388 | `SuppliesView` supply list |
| 2135 | 1322 | `AssignedTasksView` list |
| 1725 | 1260 | `ChatView` message render |
| 1695 | 1238 | **`TasksView` checklist row, the checkbox** |
| 1499 | 1298 | `AssignedTasksView` detail chips |
| 1350 | 1305 | `AssignedTasksView` resolve panel |
| 1325 | 1351 | `IssuesView` photo field |
| 1111 | 1202 | **`TasksView` pre-shift list** |
| 1107 | 1294 | `AssignedTasksView` detail |
| 1085 | 1355 | `IssuesView` issue card |

Two of the seven anchor targets (the checkbox at `:1238` and the pre-shift list at `:1202`) are single lines over 1,100 characters. Section 7 gives short unique substrings for each so the build never has to match a whole line.

## 1.2 Every component in src/App.js, in definition order

**Locate:** command: `grep -nE '^(function |const [A-Za-z_]+ = |export default|async function )' src/App.js`

Module-level helpers first, then every component. Line ranges run from the definition to the closing brace. The three byte counts were measured with `awk` over the range.

| Lines | Name | Kind | Renders or does |
| --- | --- | --- | --- |
| 1-2 | imports | | `useState, useEffect, useCallback, useRef` from react; `clientConfig` |
| 4 | `API` | const | base URL, section 1.4 |
| 6-17 | `uploadPhoto(file, token)` | function | raw `fetch` POST to `/api/uploads?bucket=issue-photos`, returns `data.url` |
| 19-29 | `uploadTaskMedia(file, token)` | function | raw `fetch` POST to `/api/uploads?bucket=task-media`, returns the whole JSON |
| 31-33 | `GOLD`, `GOLD_LIGHT`, `GREEN`, `RED`, `ORANGE`, `BLUE`, `NAVY`, `NAVY_DARK` | consts | brand colors, three from `clientConfig.brand` |
| 35-56 | `compressImage(file, maxSize, quality)` | function | canvas resize to JPEG, used once by `MyProfileView` |
| 57-58 | `LOGO_SM`, `LOGO_LG` | consts | base64 PNG data URIs |
| 60-62 | `FONT_HEAD`, `FONT_BODY`, `R` | consts | Montserrat, Inter, the radius scale `{ sm: 8, md: 10, lg: 14, pill: 999 }` |
| 64-78 | `DARK` | const | the dark theme token set |
| 79-93 | `LIGHT` | const | the light theme token set |
| 95-102 | `api(path, opts)` | function | the JSON fetch wrapper; dispatches `ocsa-session-expired` on 401 unless `opts.noAuthEvent`; attaches `e.status` and `e.code` to thrown errors |
| 104-106 | `formatTime`, `formatDate`, `now` | consts | `en-US` formatters |
| 108-128 | `Ico`, `ClockIco`, `CheckIco`, `AlertIco`, `BoxIco`, `MapIco`, `CamIco`, `ChatIco`, `SendIco`, `LogOutIco`, `MinusIco`, `PlusIco`, `ChevIco`, `SunIco`, `MoonIco`, `WrkIco`, `ClipIco`, `SwapIco`, `CalIco`, `HomeIco`, `LockIco` | components | 21 inline SVG icons |
| 130-132 | `mkLabel(t)`, `mkInput(t)`, `mkQtyBtn(t)` | consts | the shared style helpers |
| 134-142 | `SUPPORT_LINE`, `PIN_RE`, `PIN_INPUT_PROPS`, `mkPinInput`, `mkFieldErr`, `mkHelp`, `mkPrimaryBtn`, `mkGhostBtn`, `mkCardText` | consts | auth-card strings and style helpers added by the launch gate |
| 146-159 | `weakPinReason(pin, badgeNumber)` | function | client-side weak PIN rules |
| 163-170 | `readEntryFromUrl()` | function | reads `window.location.pathname` and `?token=` once at module scope; returns `{ screen: "activate" \| "reset", token }` or null |
| 172-175 | `ENTRY` | const | the result, and a `history.replaceState` that strips the token from the address bar |
| 179-182 | `leaveEntryPath()` | function | resets the address bar to `/` |
| 186-187 | `AUTH_KEY`, `AUTH_MAX_AGE_MS` | consts | `"ocsa_auth"`, 12 hours |
| 189-191 | `saveAuth(tok)` | function | `localStorage.setItem(AUTH_KEY, JSON.stringify({ token, savedAt }))` |
| 192-201 | `readAuth()` | function | reads and age-checks the stored token, returns the token or null |
| 202-204 | `clearAuth()` | function | removes the key |
| 206-456 | `OCSAStaffPortal` | component, default export, 25,064 bytes | all state (24 `useState`), every handler, the boot effect, the screen switch, header, tab switch, More overlay, bottom nav, toast, the global `<style>` block |
| 458-481 | `LoginScreen` | component | identifier plus PIN card, forgot link, register link, theme toggle |
| 483-506 | `RegisterScreen` | component | six-field registration card |
| 508-520 | `AuthCard` | component | the shared card shell for the auth screens |
| 522-532 | `BootSplash` | component | logo and "Loading..." while a stored session hydrates |
| 534-541 | `LangPicker` | component | English or Spanish toggle on the activation card |
| 543-546 | `fmtExpiry`, `ERR_GENERIC`, `ERR_PIN_MISMATCH`, `MSG_LINK_INVALID` | consts | auth strings |
| 548-653 | `ActivateScreen` | component | `/activate?token=` flow, six phases |
| 655-738 | `ResetScreen` | component | `/reset-pin?token=` flow, six phases |
| 740-782 | `ForgotScreen` | component | reset request card |
| 787-818 | `SetPinScreen` | component | the forced PIN set, rendered as its own `screen` value |
| 820-1116 | `MyScheduleSection` | component | week grid, month grid, shift detail bottom sheet, drop request form |
| 1118-1177 | `ClockView` | component, 6,177 bytes | wall clock, "Time on Site" card with the task progress bar, the shift session site picker |
| 1179-1184 | `groupTasksByFloorZone(taskList)` | function | groups task rows on `floor_number` and `zone` |
| 1186-1241 | `TasksView` | component, 9,810 bytes | the checklist: pre-shift branch, empty branch, detail view, the checkbox list |
| 1243-1269 | `ChatView` | component | channel pills, admin DM button, message list, single-line composer |
| 1271-1325 | `AssignedTasksView` | component | assigned task list, detail, resolve and cannot-resolve panels |
| 1327-1358 | `IssuesView` | component | report form with photo, admin issue list |
| 1360-1392 | `SuppliesView` | component | request form, pre-shift branch, supply list with quantity stepper, "This Shift's Log" |
| 1394-1396 | `EmptyState` | component | icon plus one line of text in a card |
| 1398-1582 | `PickupView` | component | Available and My Pickups tabs, claim and release |
| 1584-1835 | `InspectView` | component | inspection list, scoring view, schedule modal |
| 1837-2031 | `MyProfileView` | component | photo, personal information read and edit, change PIN, site assignments |

Twenty components (fourteen at `30a32d5` plus `AuthCard`, `BootSplash`, `LangPicker`, `ActivateScreen`, `ResetScreen`, `ForgotScreen` and `SetPinScreen`, minus none), four module-level fetch or image functions, seven auth helpers, one grouping helper, 21 icons. There is no nesting, no folder and no second component file.

## 1.3 How navigation works

**Locate:** file: `src/App.js` | find: `const [screen, setScreen] = useState(ENTRY ? ENTRY.screen : "login");` | line: `210` | find: `const [activeTab, setActiveTab] = useState("clock");` | line: `212` | router library: `none`

Navigation is two strings in React state. There is no router dependency. The launch gate added one read of `window.location` at module scope (`readEntryFromUrl`, `:163`) and two `history.replaceState` calls (`:174`, `:181`); nothing else reads or writes the URL.

**Every value `screen` takes**, from `grep -n -o 'setScreen("[a-z]*")\|screen: "[a-z]*"\|screen === "[a-z]*"' src/App.js`:

| Value | Set at | Rendered at | Component |
| --- | --- | --- | --- |
| `"login"` | `:210` (initial when no entry link), `:234` (401 listener), `:271` (boot failure), `:292` (activation or reset hydration failure), `:296` (`goLogin`), `:300` (after register), `:304` (logout), `:353`, `:354` | `:353` | `LoginScreen` |
| `"register"` | `:353` | `:354` | `RegisterScreen` |
| `"activate"` | `:167` (`ENTRY.screen` when the path is `/activate`) | `:355` | `ActivateScreen` |
| `"reset"` | `:168` (`ENTRY.screen` when the path is `/reset-pin`) | `:356` | `ResetScreen` |
| `"forgot"` | `:353`, `:356` | `:357` | `ForgotScreen` |
| `"setpin"` | `:257` (`me.mustSetPin === true` inside `hydrateSession`) | `:358` | `SetPinScreen` |
| `"main"` | `:257` (`hydrateSession`), `:295` (`handlePinSet`) | `:359` | the header, tab content and bottom nav |

Seven values. The outer switch, `:352` to `:359`:

```jsx
      {booting && <BootSplash t={t} themeMode={themeMode} />}
      {!booting && screen === "login" && <LoginScreen onLogin={handleLogin} onGoRegister={() => setScreen("register")} onGoForgot={() => setScreen("forgot")} loading={loading} showToast={showToast} t={t} toggleTheme={toggleTheme} themeMode={themeMode} />}
      {screen === "register" && <RegisterScreen onRegister={handleRegister} onBack={() => setScreen("login")} loading={loading} t={t} />}
      {screen === "activate" && <ActivateScreen token={ENTRY ? ENTRY.token : null} onActivated={handleAuthSuccess} onGoLogin={goLogin} showToast={showToast} t={t} />}
      {screen === "reset" && <ResetScreen token={ENTRY ? ENTRY.token : null} onReset={handleAuthSuccess} onGoLogin={goLogin} onGoForgot={() => setScreen("forgot")} showToast={showToast} t={t} />}
      {screen === "forgot" && <ForgotScreen onGoLogin={goLogin} showToast={showToast} t={t} />}
      {screen === "setpin" && <SetPinScreen token={token} user={user} onDone={handlePinSet} onSignOut={handleLogout} showToast={showToast} t={t} />}
      {!booting && screen === "main" && (
```

`booting` (`:211`) is a separate boolean, `useState(!ENTRY && !!readAuth())`, true only while a stored token is being hydrated; it gates the login card and the main screen and nothing else.

**The inner switch, `activeTab`**, `:382` to `:391`, every tab key with its component and props:

| Tab key | Component | Props passed | Reached from |
| --- | --- | --- | --- |
| clock | `ClockView` then `MyScheduleSection compact` | clockStatus, currentTime, selectedSite, onStartSession, siteChoices, loading, t; then token, t, compact, showToast, getOpts, lkHasOther | bottom nav "Home", the default tab |
| schedule | `MyScheduleSection` | token, t, showToast, getOpts, lkHasOther | bottom nav "Schedule" |
| tasks | `TasksView` | clockStatus, tasks, completedTaskIds, toggleTask, t | bottom nav "Tasks", and `setActiveTab("tasks")` at `:309` after Start Shift |
| chat | `ChatView` | channels, messages, activeChannel, setActiveChannel, sendMessage, user, t, token | bottom nav "Chat" |
| issuetasks | `AssignedTasksView` | assignedTasks, resolveTask, showToast, t, token, lkColorMap | More menu "Assigned" |
| issues | `IssuesView` | clockStatus, issues, submitIssue, showToast, user, sites, t, token, getOpts, lkColorMap | More menu "Issues" or "Report" |
| supplies | `SuppliesView` | clockStatus, supplies, supplyLogs, logSupplyUsage, submitRequest, showToast, t, getOpts, lkColorMap | More menu "Supplies" |
| pickup | `PickupView` | token, user, showToast, t | More menu "Pickup" |
| inspect | `InspectView` | token, user, showToast, t | More menu "Inspect" |
| profile | `MyProfileView` | token, user, showToast, t, setUser, setActiveTab | the avatar button in the header only, `:364` |

The `tasks` mount line, verbatim, `:384`:

```jsx
              {activeTab === "tasks" && <TasksView clockStatus={clockStatus} tasks={tasks} completedTaskIds={completedTaskIds} toggleTask={toggleTask} t={t} />}
```

The two tab arrays, `:332` to `:344`, are unchanged from the v2 scout: `clock` "Home", `schedule`, `tasks`, `chat` in the bar; `issuetasks` "Assigned", `issues`, `supplies`, `pickup`, `inspect` behind More.

## 1.4 The API base URL and every environment variable the build reads

**Locate:** file: `src/App.js` | find: `const API = process.env.REACT_APP_API_URL` | line: `4`

```js
const API = process.env.REACT_APP_API_URL || "https://ocsa-api-production.up.railway.app";
```

**Locate:** command: `grep -rn 'process.env\|REACT_APP' src public .env` | result: three files

| Variable | Read at | Default |
| --- | --- | --- |
| `REACT_APP_API_URL` | `src/App.js:4` | `https://ocsa-api-production.up.railway.app` |
| `REACT_APP_THEME_COLOR` | `public/index.html:6` (`<meta name="theme-color" content="%REACT_APP_THEME_COLOR%" />`) and `:14` (`body { ... background: %REACT_APP_THEME_COLOR%; ... }`) | none in HTML; `.env` supplies `"#0A1628"` |

Every request goes through `API`: the `api()` wrapper at `:95`, and three raw `fetch` calls at `:8`, `:21` and `:1887`.

## 1.5 Whether package-lock.json is committed

**Locate:** command: `git ls-files | grep -i lock` | result: `package-lock.json`

**Yes.** 17,251 lines, 650,159 bytes, and `.gitignore` does not name it. Unchanged from the v2 scout.

---

# 2. Completion state, in full

## 2.1 The declaration

**Locate:** file: `src/App.js` | find: `const [completedTaskIds, setCompletedTaskIds] = useState(new Set());` | line: `217` | grep count: `1`

```js
  const [completedTaskIds, setCompletedTaskIds] = useState(new Set());
```

Name: `completedTaskIds`. Setter: `setCompletedTaskIds`. **Type: a JavaScript `Set` of task template ids** (the `id` field of a task row, a string per the API). It lives in the root component `OCSAStaffPortal` and reaches `TasksView` as a prop at `:384`. The initializer `new Set()` is evaluated on every render of the root and discarded after the first; harmless, and it means the initial value is always empty.

## 2.2 Every write to it

**Locate:** command: `grep -n -o 'setCompletedTaskIds([^;]*' src/App.js` | occurrences of `setCompletedTaskIds`: `5`

| # | Line | Surrounding function | What it sets | Reads a response body |
| --- | --- | --- | --- | --- |
| 1 | 217 | the declaration | `new Set()` | no |
| 2 | 234 | the `ocsa-session-expired` listener (the 401 handler) | `new Set()` | no |
| 3 | 304 | `handleLogout` | `new Set()` | no |
| 4 | 314 | `toggleTask`, the untick branch | a copy of the previous Set with `taskId` deleted | no |
| 5 | 314 | `toggleTask`, the tick branch | a copy of the previous Set with `taskId` added | no |

Line 234, verbatim:

```js
  useEffect(() => { const h = () => { clearAuth(); setToken(null); setUser(null); setSites([]); setScreen("login"); setClockStatus(null); setSelectedSite(null); setSessionSites(null); setTasks([]); setCompletedTaskIds(new Set()); setActiveTab("clock"); }; window.addEventListener("ocsa-session-expired", h); return () => window.removeEventListener("ocsa-session-expired", h); }, []);
```

Line 304, verbatim:

```js
  const handleLogout = () => { clearAuth(); setToken(null); setUser(null); setSites([]); setScreen("login"); setClockStatus(null); setSelectedSite(null); setSessionSites(null); setTasks([]); setCompletedTaskIds(new Set()); setActiveTab("clock"); };
```

Line 314, verbatim, the only function that ever adds to the Set:

```js
  const toggleTask = async (taskId) => { try { if (completedTaskIds.has(taskId)) { await api("/api/clock/tasks/" + taskId + "/complete", { method: "DELETE", token }); setCompletedTaskIds(prev => { const n = new Set(prev); n.delete(taskId); return n; }); } else { await api("/api/clock/tasks/" + taskId + "/complete", { method: "POST", body: {}, token }); setCompletedTaskIds(prev => new Set(prev).add(taskId)); showToast("Task completed"); } const cs = await api("/api/clock/status", { token }); setClockStatus(cs); } catch (err) { showToast(err.message, "error"); } };
```

The two writes inside `toggleTask` run after the request succeeds and before the status refetch. They use the functional form, so concurrent toggles on different ids compose correctly.

## 2.3 Every read of it

**Locate:** command: `grep -n -o 'completedTaskIds[^;]\{0,60\}' src/App.js` | occurrences of `completedTaskIds.has`: `4`

| # | Line | Where | What renders or branches on the result |
| --- | --- | --- | --- |
| 1 | 314 | `toggleTask`, first statement | branches: `has` true sends `DELETE`, false sends `POST` |
| 2 | 384 | the tab switch | passes the Set to `TasksView` as the `completedTaskIds` prop |
| 3 | 1186 | `TasksView` signature | receives the prop |
| 4 | 1208 | `TasksView`, after the empty gate | `const completed = standardTasks.filter(tk => completedTaskIds.has(tk.id)).length;` feeds `pct` at `:1209`, the percentage pill and bar in the Tasks header card at `:1235` and `:1236` |
| 5 | 1212 | `TasksView`, detail view | `const done = completedTaskIds.has(detail.id);` chooses the button label `"Uncheck Task"` or `"Mark Complete"` and its color at `:1225` |
| 6 | 1238 | `TasksView`, the checklist row | `const done = completedTaskIds.has(task.id);` chooses the row background and border, the checkbox fill and the check icon, and the label `line-through` and opacity |

Lines 1208 and 1209, verbatim:

```js
  const completed = standardTasks.filter(tk => completedTaskIds.has(tk.id)).length;
  const pct = Math.round((completed / standardTasks.length) * 100);
```

Line 1212, verbatim:

```js
    const done = completedTaskIds.has(detail.id);
```

The row at `:1238` is quoted in full in section 4.3.

## 2.4 Every place it is reset or reinitialized

| Event | Line | Resets `completedTaskIds` | Resets `tasks` | Resets `clockStatus` |
| --- | --- | --- | --- | --- |
| Initial render | 217 | `new Set()` | `[]` (`:216`) | `null` (`:213`) |
| A 401 from any `api()` call, `uploadPhoto`, `uploadTaskMedia` or the profile photo fetch | 234 | `new Set()` | `[]` | `null` |
| Logout button, and "Not you? Sign out" on the forced PIN screen | 304 | `new Set()` | `[]` | `null` |
| **Site change mid-session** (`handleStartSession`, `:306` to `:311`) | | **no** | **no**, until the tab effect refetches | replaced by `GET /api/clock/status` |
| Screen change (`setScreen` at any of its nine call sites) | | **no** | no | no |
| Boot failure (`hydrateSession` rejects on a stored token) | 271 | **no** | no | no |
| Activation or reset hydration failure | 292 | **no** | no | no |
| Page reload | | `new Set()`, because the state is in memory only | `[]` | `null` |

`localStorage` holds two keys, `ocsa_auth` (the JWT and its save time, `:186` to `:204`) and `ocsa-staff-theme` (`:229`, `:231`). Neither carries completion state:

**Locate:** command: `grep -n -o '.\{0,30\}localStorage.\{0,40\}' src/App.js` | lines: `190, 194, 203, 229, 231`

## 2.5 Whether anything populates it from the server today

**Stated plainly: no.** Every write is listed in 2.2. Three set it to an empty Set and two add or remove the single id that was just toggled. No write reads `cs`, `tt`, `data` or any other response. The claim in the brief is verified.

## 2.6 Whether any other state duplicates completion knowledge

Yes, one. `clockStatus.tasks` holds `{ total, completed }` from `GET /api/clock/status`, written at `:250`, `:309`, `:313` and `:314`. It is read in exactly two places, both in `ClockView`:

```js
  const tk = clockStatus?.tasks || { total: 0, completed: 0 };
  const pct = tk.total > 0 ? Math.round((tk.completed / tk.total) * 100) : 0;
```

(`:1123`, `:1124`) and the bar at `:1165`:

```jsx
          {tk.total > 0 && (<div style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><div style={{ flex: 1, maxWidth: 180, height: 6, borderRadius: R.pill, background: t.cardAlt, overflow: "hidden" }}><div style={{ height: "100%", borderRadius: R.pill, background: pct === 100 ? GREEN : "linear-gradient(90deg," + GOLD + "," + GOLD_LIGHT + ")", width: pct + "%", transition: "width 0.3s ease" }} /></div><span style={{ fontSize: 11, color: GOLD, fontWeight: 700, fontFamily: FONT_HEAD }}>{tk.completed}/{tk.total}</span></div>)}
```

So two things can disagree:

| Surface | Reads | Survives a reload |
| --- | --- | --- |
| Home tab, "Time on Site" card, the bar and `{tk.completed}/{tk.total}` | `clockStatus.tasks` from the server | yes |
| Tasks tab header card, the percentage pill and bar | `completedTaskIds` through `:1208` | no |
| Tasks tab checkbox, row styling, detail button label | `completedTaskIds` through `:1238` and `:1212` | no |

**The checkbox reads `completedTaskIds` and nothing else.** No per-task flag exists; the portal never reads a `completed`, `is_completed`, `completed_at` or similar key on a task row (section 4.2 lists every key it does read). There is no derived list.

---

# 3. Boot and hydration

## 3.1 The full boot sequence from load

**Locate:** file: `src/App.js` | find: `const bootRan = useRef(false);` | line: `262` | find: `const hydrateSession = useCallback(async (tok) => {` | line: `246`

Module evaluation, before any render:

| Step | Line | What runs |
| --- | --- | --- |
| M1 | 172 | `const ENTRY = readEntryFromUrl();` reads `window.location.pathname` and `?token=`; non-null only on `/activate` or `/reset-pin` |
| M2 | 173-175 | if `ENTRY.token`, `history.replaceState` strips the query string |

First render of `OCSAStaffPortal`:

| Step | Line | State |
| --- | --- | --- |
| R1 | 210 | `screen` is `ENTRY.screen` or `"login"` |
| R2 | 211 | `booting` is `!ENTRY && !!readAuth()`, so `readAuth()` runs once here and reads `localStorage["ocsa_auth"]` |
| R3 | 212 | `activeTab` is `"clock"` |
| R4 | 213-217 | `clockStatus` null, `selectedSite` null, `sessionSites` null, `tasks` `[]`, `completedTaskIds` `new Set()` |

Effects after the first render, in declaration order:

| Step | Line | Effect | What it does on the first pass |
| --- | --- | --- | --- |
| E1 | 233 | `setInterval(() => setCurrentTime(now()), 1000)` | starts the one-second ticker |
| E2 | 234 | adds the `ocsa-session-expired` listener | nothing yet |
| E3 | 263-273 | the boot effect | see below |
| E4 | 325 | the tab effect, deps `[activeTab, clockStatus?.clockedIn]` | `activeTab === "clock" && token` is false because `token` is still null; every other branch is false; **fetches nothing** |
| E5 | 326 | the channel effect | `activeChannel` is null; nothing |
| E6 | 327 | the chat poll | returns early; nothing |

The boot effect, verbatim:

```js
  // Boot from a stored session. An emailed link wins over a stored session.
  const bootRan = useRef(false);
  useEffect(() => {
    if (bootRan.current) return;
    bootRan.current = true;
    if (ENTRY) return;
    const tok = readAuth();
    if (!tok) return;
    setToken(tok);
    hydrateSession(tok)
      .catch(() => { clearAuth(); setToken(null); setUser(null); setScreen("login"); })
      .finally(() => setBooting(false));
  }, [hydrateSession]);
```

`bootRan` guards against StrictMode's double invocation in development and against `hydrateSession` changing identity. `readAuth()` runs a second time here (the first was R2).

`hydrateSession`, verbatim, the one bootstrap shared by the boot path, the login path and the activation and reset path:

```js
  // One bootstrap for the login path, the boot path and the activation
  // path, so the three cannot drift. Only /api/auth/me is awaited before
  // the screen switches, since the main screen reads user.
  const hydrateSession = useCallback(async (tok) => {
    const me = await api("/api/auth/me", { token: tok });
    setUser(me.user); setSites(me.sites);
    api("/api/users/profile/me", { token: tok }).then(p => { if (p?.user?.profilePhotoUrl) setUser(prev => ({ ...prev, profilePhotoUrl: p.user.profilePhotoUrl })); }).catch(() => {});
    try { const cs = await api("/api/clock/status", { token: tok }); setClockStatus(cs); if (cs.clockedIn && cs.shift) setSelectedSite(cs.shift.siteId); } catch (e) { console.warn("Clock status:", e.message); }
    loadAssignedTasks(tok);
    loadSessionSites(tok);
    api("/api/lookups", { token: tok }).then(setLookups).catch(e => console.warn("Lookups:", e.message));
    // The forced PIN set fires only when the API says so, strictly true.
    // mustSetPin sits at the top level of the /api/auth/me response,
    // beside user. While it is absent this branch stays dormant.
    setScreen(me.mustSetPin === true ? "setpin" : "main");
    return me.user;
  }, [loadAssignedTasks, loadSessionSites]);
```

The fetch order inside it, with what each writes:

| Step | Line | Call | Awaited | Writes |
| --- | --- | --- | --- | --- |
| H1 | 247 | `GET /api/auth/me` | yes | `user`, `sites` (`:248`) |
| H2 | 249 | `GET /api/users/profile/me` | no | `user.profilePhotoUrl` when present |
| H3 | 250 | **`GET /api/clock/status`** | yes, inside its own `try` | `clockStatus`; `selectedSite` when `cs.clockedIn && cs.shift` |
| H4 | 251 | `GET /api/clock/tasks/assigned` via `loadAssignedTasks(tok)` | no | `assignedTasks` |
| H5 | 252 | `GET /api/shift-sessions/sites` via `loadSessionSites(tok)` | no | `sessionSites` |
| H6 | 253 | `GET /api/lookups` | no | `lookups` |
| H7 | 257 | `setScreen("setpin")` or `setScreen("main")` | | `screen` |

A failure of H3 is swallowed to `console.warn` and the screen still switches. A failure of H1 rejects the whole promise; the boot effect's `catch` then clears the stored token and shows the login card.

After H7 the main screen mounts. Because `clockStatus?.clockedIn` changed from `undefined` to `true` or to `false` at H3, and `token` is now set, the tab effect at `:325` re-runs once and, with `activeTab` still `"clock"`, calls `loadSessionSites()` a second time. `MyScheduleSection compact` mounts under the Home tab and calls `GET /api/pickups/my-schedule` for the current week (`:855`). The task list is fetched only when the person taps "Tasks", section 3.5.

`GET /api/lookups` at H6 replaces the `GET /api/lookups/all` call the v2 scout reported at its `:180`; the 403 finding in that scout is closed.

## 3.2 The stored token

**Locate:** find: `const AUTH_KEY = "ocsa_auth";` | line: `186`

```js
// Session persistence. Only the JWT and the time it was saved. Never
// the PIN, the identifier, or anything from the user record.
const AUTH_KEY = "ocsa_auth";
const AUTH_MAX_AGE_MS = 12 * 60 * 60 * 1000;

function saveAuth(tok) {
  try { window.localStorage.setItem(AUTH_KEY, JSON.stringify({ token: tok, savedAt: Date.now() })); } catch (e) {}
}
function readAuth() {
  try {
    var raw = window.localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    var p = JSON.parse(raw);
    if (!p || !p.token) return null;
    if (!p.savedAt || (Date.now() - p.savedAt) > AUTH_MAX_AGE_MS) return null;
    return p.token;
  } catch (e) { return null; }
}
function clearAuth() {
  try { window.localStorage.removeItem(AUTH_KEY); } catch (e) {}
}
```

**Yes, the token is read from `localStorage` under the key `ocsa_auth`**, as `{ token, savedAt }`, and discarded client-side after twelve hours. After hydration succeeds, `setBooting(false)` at `:273` drops the splash and the screen set at H7 renders. `saveAuth` is called at `:279` (login) and `:290` (activation or reset); `clearAuth` at `:234`, `:271`, `:292` and `:304`. The v2 scout's finding 9 (token in memory only) is closed.

## 3.3 Whether anything calls GET /api/shift-sessions/today

**Locate:** command: `grep -c "shift-sessions/today" src/App.js` | result: `0`

**Nothing.** The two `shift-sessions` calls in the file, from `grep -n -o '"/api/shift-sessions[^"]*"' src/App.js`:

| Line | Call | Method | Function |
| --- | --- | --- | --- |
| 237 | `api("/api/shift-sessions/sites", { token: tkn \|\| token })` | GET | `loadSessionSites`, the site picker choices |
| 309 | `api("/api/shift-sessions", { method: "POST", body: { siteId }, token })` | POST | `handleStartSession` |

So the `{ today, session, tasks }` response is never received and no field of it is read or discarded. The portal reads its session from `GET /api/clock/status` instead, at four call sites (`:250`, `:309`, `:313`, `:314`). The keys it reads from that response, all unchanged since the v2 scout: `clockedIn`, `shift.siteId`, `shift.siteName`, `shift.buildingName`, `shift.floorNumber`, `shift.clockInTime`, `tasks.total`, `tasks.completed`.

> **CAUTION: which route carries the four new keys is the one API fact this edit depends on**
>
> The Block 2 scout, section 3, annotates the count query as `helpers/shiftSessions.js:58, the count behind GET /today and GET /clock/status`, and its section 4 quotes the `routes/clock.js` header: "This router stays mounted at /api/clock because the portal calls /api/clock/tasks/...", with `/api/clock/status` "kept live and reshaped rather than gated". Both routes take their `tasks` object from `sessionTaskProgress`. If the API build adds the four keys inside that helper, `GET /api/clock/status` carries them and the portal needs no new fetch. If the API build adds them only in the `/today` handler, the portal needs a new call to `GET /api/shift-sessions/today` beside `:250`, and section 8.1 costs that. One `curl` against the deployed API after the API pull request merges settles it.

## 3.4 What the portal does with tasks.total and tasks.completed today

Both surface in exactly one place, the "Time on Site" card on the Home tab, section 2.6: a 6 pixel bar sized `pct + "%"` and the text `{tk.completed}/{tk.total}` at `:1165`, rendered only while `tk.total > 0`. Nothing else reads either number. `TasksView` computes its own percentage from the Set (`:1208`, `:1209`) and never reads `clockStatus.tasks`.

## 3.5 Whether the task list fetch and the session fetch can race

The task fetch, `loadTasks` at `:313`, verbatim:

```js
  const loadTasks = async () => { if (!clockStatus?.clockedIn || !clockStatus?.shift?.siteId) return; try { let taskUrl = "/api/sites/" + clockStatus.shift.siteId + "/tasks?user_id=" + user.id; if (clockStatus.shift.buildingName) taskUrl += "&building_name=" + encodeURIComponent(clockStatus.shift.buildingName); if (clockStatus.shift.floorNumber) taskUrl += "&floor_number=" + encodeURIComponent(clockStatus.shift.floorNumber); const tt = await api(taskUrl, { token }); setTasks(tt); const cs = await api("/api/clock/status", { token }); setClockStatus(cs); } catch (err) { console.error(err); } };
```

It is called from one place, the tab effect at `:325`:

```js
  useEffect(() => { if (activeTab === "clock" && token) loadSessionSites(); if (activeTab === "tasks" && clockStatus?.clockedIn) loadTasks(); if (activeTab === "issues") loadIssues(); if (activeTab === "issuetasks") loadAssignedTasks(); if (activeTab === "supplies") loadSupplies(); if (activeTab === "chat") loadChannels(); }, [activeTab, clockStatus?.clockedIn]);
```

Three orderings follow from the code:

1. **Tasks always come after a session.** `loadTasks` returns at its first statement unless `clockStatus.shift.siteId` is set, and `clockStatus` is written only from `GET /api/clock/status`. So on every path a status response has landed before the task request is sent. Inside `loadTasks` the task response is awaited, then a second status response is awaited. The sequence on the Tasks tab is therefore status, tasks, status.
2. **Tasks cannot arrive before the session on boot.** H3 is awaited before the screen switches, and the Tasks tab cannot be tapped before that.
3. **The Set is independent of both.** `completedTaskIds.has(task.id)` is evaluated at render time (`:1238`), so if a hydrated Set lands before `tasks`, the rows check themselves on arrival; if `tasks` lands first, the rows render unchecked and re-render checked when the Set lands. Neither order loses anything, provided nothing overwrites the Set with an empty value in between.

The one race the build introduces is inside `toggleTask`, section 4.6: if the hydration write is placed beside the `setClockStatus(cs)` at `:314`, a status response generated between two rapid ticks carries the first id only, and a stale response arriving after the second local add flips the second box back off until the next refetch.

## 3.6 What runs when a person changes site mid-session

**Locate:** find: `const handleStartSession = async (siteId) => {` | line: `306`

```js
  const handleStartSession = async (siteId) => {
    if (!siteId) { showToast("Select a site first", "error"); return; }
    setLoading(true);
    try { const data = await api("/api/shift-sessions", { method: "POST", body: { siteId }, token }); const cs = await api("/api/clock/status", { token }); setClockStatus(cs); setSelectedSite(siteId); showToast(data.message || "Shift started"); setActiveTab("tasks"); } catch (err) { showToast(err.message, "error"); }
    setLoading(false);
  };
```

It is called from one place, the site row button in `ClockView` at `:1139`: `onClick={() => { if (!loading && !sel) onStartSession(site.siteId); }}`, where `sel` is `ci && selectedSite === site.siteId` (`:1135`). While a session is open the label above the picker reads "Start at Another Site" (`:1170`), so a mid-session change is the same handler.

The sequence: `POST /api/shift-sessions` with `{ siteId }`, then `GET /api/clock/status`, then in one batched render `clockStatus` (the new site), `selectedSite`, a toast reading `data.message` or "Shift started", and `activeTab` to `"tasks"`. That tab change re-runs the effect at `:325`, which calls `loadTasks()` for the new site, which replaces `tasks` and refetches status once more.

What is **not** touched: `completedTaskIds`, `supplyLogs`, `tasks` until the effect's refetch lands. The stale Set keeps the previous site's ids. Today that is invisible because the new list carries different ids; once ids are hydrated, whether the stale Set is replaced depends on where the build puts the write (section 8.1).

---

# 4. The task list and the checkbox

## 4.1 The exact URL the task fetch builds

From `:313`, quoted in 3.5:

```
"/api/sites/" + clockStatus.shift.siteId + "/tasks?user_id=" + user.id
```

with two optional suffixes:

```
"&building_name=" + encodeURIComponent(clockStatus.shift.buildingName)
"&floor_number=" + encodeURIComponent(clockStatus.shift.floorNumber)
```

**The site id is `clockStatus.shift.siteId`**, from the status response and from nowhere else. **`user_id` is passed**, as `user.id` from `me.user` (`:248`), read without optional chaining. `selectedSite` (`:214`) and `sessionSites` (`:215`) are never used to build this URL. The list the portal holds is therefore this caller's assigned templates at the site, which is the denominator the Home bar's `tasks.total` also uses (`sessionTaskProgress` counts `task_assignments` for the user). `siteTotal` counts something wider than this list.

## 4.2 Every field of a task row the portal displays, in display order

**Locate:** find: `function TasksView({ clockStatus, tasks, completedTaskIds, toggleTask, t }) {` | line: `1186`

The filter applied before anything renders, `:1188`:

```js
  const standardTasks = tasks.filter(tk => !tk.task_type || tk.task_type === "standard");
```

**The checklist, `:1233` to `:1238`, in display order:**

| Order | Where | Field or value | How it is rendered |
| --- | --- | --- | --- |
| 1 | header card | `clockStatus.shift.siteName` | under the label "Your Assignment" |
| 2 | header card | `clockStatus.shift.buildingName`, `clockStatus.shift.floorNumber` | `{buildingName}{floorNumber ? " - Floor " + floorNumber : ""}` |
| 3 | header card | `pct` from `completedTaskIds` | `{pct}%` pill, green at 100, and a 5 pixel bar |
| 4 | group header | `g.floor` (from `task.floor_number`) | `Floor {g.floor}`, once per floor change |
| 5 | group label | `g.zone` (from `task.zone`, default `"General"`) | uppercase gold label |
| 6 | row | `completedTaskIds.has(task.id)` | the checkbox button, green when done |
| 7 | row | `task.label` | 12 pixel text, `line-through` and `opacity: 0.6` when done |
| 8 | row | `task.has_details \|\| task.description \|\| task.media_url` | a 7 pixel blue dot after the label |
| 9 | row | `task.priority === "high"` | the chip `PRIORITY` |
| 10 | row | `task.cims_category` | a muted chip with the raw value |

**The detail view, `:1211` to `:1229`, in display order:** `detail.label`, `detail.priority === "high"` chip, `detail.cims_category` chip, `detail.floor_number` and `detail.zone`, `detail.description` under "Instructions", `detail.media_url` with `detail.media_type === "video"` as a `<video>`, otherwise as an `<img>`, `detail.due_date` as "Due Date: ", `detail.due_time` raw as "Time: ", and `completedTaskIds.has(detail.id)` for the button label.

The complete set of task row keys read in `TasksView`, from `awk 'NR>=1183 && NR<=1241' src/App.js | grep -o 'task\.[a-z_]*\|detail\.[a-z_]*\|tk\.[a-z_]*' | sort -u`: `id`, `label`, `task_type`, `floor_number`, `zone`, `has_details`, `description`, `media_url`, `media_type`, `priority`, `cims_category`, `due_date`, `due_time`. Thirteen, unchanged from the v2 scout. No completion flag is among them.

## 4.3 How the checkbox decides whether it is checked

**Locate:** find: `const done = completedTaskIds.has(task.id);` | line: `1238` | grep count: `1`

The expression is:

```js
const done = completedTaskIds.has(task.id);
```

The whole row, verbatim, line 1238 (1,695 characters):

```jsx
      {groups.map((g, gi) => { const showFloor = g.floor && g.floor !== lastFloor; lastFloor = g.floor; return (<div key={gi} style={{ marginBottom: 16 }}>{showFloor && (<div style={{ ...floorHeadSt, marginTop: gi > 0 ? 10 : 0 }}>Floor {g.floor}</div>)}<div style={{ ...zoneSt, paddingLeft: g.floor ? 8 : 0 }}>{g.zone}</div>{g.tasks.map(task => { const done = completedTaskIds.has(task.id); const hasInfo = task.has_details || task.description || task.media_url; return (<div key={task.id} style={{ ...rowBase, background: done ? t.greenSubtle : t.card, border: done ? "1px solid " + t.greenBorder : "1px solid " + t.borderSolid, marginLeft: g.floor ? 8 : 0 }}><button onClick={() => toggleTask(task.id)} style={{ width: 22, height: 22, borderRadius: R.sm, border: "2px solid " + (done ? GREEN : t.textMut), background: done ? GREEN : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1, cursor: "pointer", padding: 0 }}>{done && <CheckIco sz={12} c="#F8F7F4" />}</button><div onClick={() => hasInfo ? setDetail(task) : toggleTask(task.id)} style={{ flex: 1, cursor: "pointer" }}><div style={{ fontSize: 12, fontWeight: 500, textDecoration: done ? "line-through" : "none", opacity: done ? 0.6 : 1, display: "flex", alignItems: "center", gap: 5, color: t.text }}>{task.label}{hasInfo && <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: BLUE, flexShrink: 0 }} />}</div></div><div style={{ display: "flex", gap: 4, flexShrink: 0, marginTop: 2 }}>{task.priority === "high" && <span style={chipPriority}>PRIORITY</span>}<span style={chipCat}>{task.cims_category}</span></div></div>); })}</div>); })}
```

`done` drives six things on the row: background, border, checkbox border color, checkbox fill, the check icon, and the label's strike and opacity. The row body toggles the task when it has no detail and opens the detail when it has. The detail view's button at `:1225` reads its own `done` from `:1212`.

**No task is ever checked from a server value.** The only inputs to `done` are the Set and `task.id`.

## 4.4 What is sent on a tick and on an untick

From `toggleTask`, `:314`, quoted in full in 2.2.

| | Tick (box unchecked, `has` false) | Untick (box checked, `has` true) |
| --- | --- | --- |
| Route | `"/api/clock/tasks/" + taskId + "/complete"` | `"/api/clock/tasks/" + taskId + "/complete"` |
| Method | `POST` | `DELETE` |
| Body | `{}`, serialized as `"{}"` by `api()` at `:98` | none |
| Site named in the request | none; the API takes the caller's newest session for today | none |
| Auth | `Authorization: Bearer <token>` | same |

The Block 2 scout, section 3, quotes both handlers. The `POST` inserts `(task_template_id, user_id, site_id, shift_record_id, site_session_id, notes, photo_url)` from the URL, the caller and the session, with no check that the template belongs to the session's site or is assigned to the caller, and no uniqueness check against an existing completion. The `DELETE` runs:

```sql
UPDATE task_completions SET uncompleted_at = NOW()
 WHERE task_template_id = $1 AND user_id = $2 AND site_session_id = $3 AND uncompleted_at IS NULL
```

so an untick can only reach a completion this caller made in the current session. That is the same scope as `completedTaskIds` in section 0 and a narrower scope than `siteCompletedTaskIds`. Section 8.1 draws the consequence.

## 4.5 What the portal does with the response of each

| After | Response body read | Local state patched | Refetched |
| --- | --- | --- | --- |
| `POST` succeeds | nothing; the body is discarded | `completedTaskIds` gains `taskId` (`:314`); toast "Task completed" | `GET /api/clock/status` into `clockStatus` (the Home count) |
| `DELETE` succeeds | nothing | `completedTaskIds` loses `taskId` | `GET /api/clock/status` into `clockStatus` |
| either fails | `err.message` | nothing; the box stays as it was | nothing |

**Both, in a fixed order: patch first, then refetch the count.** The task list itself is never refetched by a toggle. Because the portal already refetches status after every toggle, a hydration write beside `:314` would reconcile the Set with the server after each tick at no extra request.

## 4.6 Whether an in-flight tick is guarded against a double tap

**Locate:** command: `sed -n '1238p' src/App.js | grep -o 'disabled' | wc -l` | result: `0` | command: `sed -n '314p' src/App.js | grep -o 'setLoading' | wc -l` | result: `0`

**No.** The checkbox `<button>` at `:1238` carries no `disabled` attribute, the row body's `onClick` calls `toggleTask` unguarded, the detail button at `:1225` calls `toggleTask(detail.id)` and closes the detail in one click, and `toggleTask` neither reads nor writes `loading`. The branch `if (completedTaskIds.has(taskId))` reads the Set captured by the render that created the handler, so two taps on one box before the first `POST` resolves both take the tick branch and send two `POST`s; the API inserts two rows, the Set ends with one id, and `tasks.completed` on the Home card counts two. The `loading` state (`:227`) exists and is used by `handleLogin`, `handleRegister` and `handleStartSession` only.

## 4.7 How grouping and sorting work client-side

**Locate:** find: `function groupTasksByFloorZone(taskList) {` | lines: `1179` to `1184`

```js
function groupTasksByFloorZone(taskList) {
  const groups = []; const floorMap = {};
  taskList.forEach(t => { const floor = t.floor_number || null; const zone = t.zone || "General"; const key = (floor || "_none_") + "|" + zone; if (!floorMap[key]) { floorMap[key] = { floor, zone, tasks: [] }; groups.push(floorMap[key]); } floorMap[key].tasks.push(t); });
  groups.sort((a, b) => { if (a.floor && !b.floor) return -1; if (!a.floor && b.floor) return 1; if (a.floor && b.floor && a.floor !== b.floor) { const aNum = parseInt(a.floor); const bNum = parseInt(b.floor); if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum; return a.floor.localeCompare(b.floor); } return a.zone.localeCompare(b.zone); });
  return groups;
}
```

Unchanged from the v2 scout: groups on the pair `(floor_number, zone)`, floors with a value first, numeric floors in numeric order, then `zone.localeCompare`. Rows inside a group keep the API's order. Done and open rows are never separated. `standardTasks.filter` at `:1188` is the only other list operation. The hydration edit touches none of this.

---

# 5. The site picker, and a site with no task templates

## 5.1 What the site picker renders per site

**Locate:** find: `const renderSite = (site, idx) => {` | line: `1134` | grep count: `1`

The picker lives in `ClockView`. Its data is `siteChoices`, the `sessionSites` state written from `GET /api/shift-sessions/sites` at `:237`. The grouping, `:1126` to `:1131`:

```js
  const scheduled = siteChoices?.scheduled || [];
  const assigned = siteChoices?.assigned || [];
  const shown = new Set([...scheduled, ...assigned].map(x => x.siteId));
  const others = (siteChoices?.all || []).filter(x => !shown.has(x.siteId));
  const grouped = scheduled.length > 0 || assigned.length > 0;
  const groups = (grouped ? [{ label: "Scheduled Today", items: scheduled }, { label: "Your Assigned Sites", items: assigned }, { label: "All Other Sites", items: others }] : [{ label: null, items: others }]).filter(g => g.items.length > 0);
```

The row, verbatim, `:1134` to `:1151`:

```jsx
  const renderSite = (site, idx) => {
    const sel = ci && selectedSite === site.siteId;
    const place = [site.address, site.city].filter(Boolean).join(", ");
    const detail = [site.buildingName, site.floorNumber ? "Floor " + site.floorNumber : null].filter(Boolean).join(" - ");
    return (
      <button key={site.siteId + "-" + idx} onClick={() => { if (!loading && !sel) onStartSession(site.siteId); }} disabled={loading} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", marginBottom: 10, background: sel ? t.goldBg : t.card, border: sel ? "1.5px solid " + GOLD : "1px solid " + t.borderSolid, borderRadius: R.md, cursor: sel || loading ? "default" : "pointer", color: t.text, textAlign: "left", opacity: loading ? 0.6 : 1, boxShadow: sel ? t.popShadow : t.shadow, transition: "background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease" }}>
        <div style={{ width: 38, height: 38, flexShrink: 0, borderRadius: R.sm, display: "flex", alignItems: "center", justifyContent: "center", background: sel ? t.goldSubtle : t.hover, border: "1px solid " + (sel ? t.goldBorder : t.borderSolid) }}>
          <MapIco sz={18} c={sel ? GOLD : t.textMut} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{site.siteName}</div>
          {place && <div style={{ fontSize: 10, color: t.textSec, marginTop: 2 }}>{place}</div>}
          {detail && <div style={{ fontSize: 10, color: GOLD, marginTop: 3, fontWeight: 600 }}>{detail}</div>}
        </div>
        <div style={{ width: 18, height: 18, flexShrink: 0, borderRadius: "50%", background: sel ? GOLD : "transparent", border: sel ? "none" : "2px solid " + t.borderSolid }} />
      </button>
    );
  };
```

Every field read per site row, from `grep -n -o 'site\.[a-zA-Z]*' src/App.js` inside this range: `siteId` (`:1135`, `:1139`), `address` and `city` (`:1136`), `buildingName` and `floorNumber` (`:1137`), `siteName` (`:1144`). Six. Rendered, in order: a map icon, `siteName`, `address, city` when either exists, `buildingName - Floor N` in gold when either exists, and a radio-style circle filled when the row is the open session's site.

## 5.2 Whether it shows any task count

**No.** No field named `taskCount`, `task_count`, `templateCount`, `total` or similar is read from a site row (`grep -n -i 'taskCount\|task_count\|templateCount' src/App.js` returns nothing). The picker has no number on it anywhere. The only task numbers on the Home tab are `tk.completed`/`tk.total` on the "Time on Site" card, which describe the session already open, never a candidate site.

## 5.3 Whether a site with no templates is selectable

**Yes, and there is no branch.** The only conditions on the button at `:1139` are `!loading && !sel`. Nothing in `renderSite`, `groups` or `ClockView` inspects templates, tasks or a count. A cleaner assigned to one of the thirteen School District buildings sees the same row as any other site, taps it, `POST /api/shift-sessions` succeeds, and `setActiveTab("tasks")` lands them on section 5.4.

The three states the picker itself distinguishes, `:1171` to `:1173`:

```jsx
        {!siteChoices && <div style={emptySt}>Loading sites...</div>}
        {siteChoices && groups.length === 0 && <div style={emptySt}>No sites available yet.</div>}
        {siteChoices && groups.map((g, gi) => (<div key={gi}>{g.label && <div style={groupHeadSt}>{g.label}</div>}{g.items.map(renderSite)}</div>))}
```

## 5.4 Exactly what the Tasks view renders when the list comes back empty

**Locate:** find: `if (standardTasks.length === 0) return <EmptyState icon={CheckIco} text="Loading tasks..." t={t} />;` | line: `1206` | grep count: `1`

With a session open (`clockStatus.clockedIn` true) and `tasks` at `[]`, or at a list with no `task_type` of `"standard"` or empty, `TasksView` returns at `:1206`:

```jsx
  if (standardTasks.length === 0) return <EmptyState icon={CheckIco} text="Loading tasks..." t={t} />;
```

`EmptyState` at `:1394`:

```jsx
function EmptyState({ icon: Icon, text, t }) {
  return (<div style={{ padding: "48px 24px", textAlign: "center", background: t.card, borderRadius: R.md, border: "1px solid " + t.border, boxShadow: t.shadow }}><Icon sz={40} c={t.borderSolid} /><div style={{ fontSize: 15, color: t.textMut, marginTop: 16, fontFamily: FONT_HEAD }}>{text}</div></div>);
}
```

So the person sees a card with a check icon and the single line **"Loading tasks..."**, with no header card, no site name, no percentage, and no way to tell that the list is complete.

For completeness, the pre-shift branch at `:1197` to `:1204` renders two other strings when `clockedIn` is false:

```jsx
  if (!clockStatus?.clockedIn) return (
    <div style={{ padding: "16px" }}>
      <div style={{ padding: "12px 14px", marginBottom: 14, background: t.orangeSubtle, borderRadius: R.md, border: "1px solid " + t.orangeBorder, boxShadow: t.shadow }}><div style={{ fontSize: 12, color: ORANGE }}>Start your shift to check off tasks. You can view your task list below.</div></div>
      {standardTasks.length === 0 ? <EmptyState icon={CheckIco} text="No tasks loaded. Start your shift at a site to see your checklist." t={t} /> : (() => {
```

The v2 scout's two "Clock in" strings on this view were replaced by the session rewire; both now read "Start your shift".

## 5.5 Whether an empty list is distinguishable on screen from a list that has not loaded yet

**No.** There is no loading flag for tasks. `tasks` is `[]` before the fetch (`:216`), `[]` after an empty response (`setTasks(tt)` at `:313`), and unchanged after a failed fetch (the `catch` at `:313` logs and returns). All three render `:1206` identically. The `loading` state is not written by `loadTasks`. A build that wants "No tasks at this site yet" to differ from "Loading tasks..." needs a flag or a sentinel (for example `tasks` starting as `null`), and that is a second edit outside the hydration scope.

---

# 6. Two known strings

## 6.1 The views still reading "Clock in"

**Locate:** command: `grep -n -i -o '.\{0,60\}clock in.\{0,60\}' src/App.js` | result: three lines, `1029`, `1379`, `1572` | command: `grep -n -i -o '.\{0,40\}clock out.\{0,40\}' src/App.js` | result: one line, `1033`

The brief names the Schedule screen, the Supplies view and the profile screen. The source names the Schedule screen, the Supplies view and the **Pickup** view. `MyProfileView` (`:1837` to `:2031`) contains no "Clock" string; its only case-insensitive match is `setActiveTab("clock")` on the Back button at `:1935`.

| # | View | Line | Exact string | Unique find-string (grep count 1) |
| --- | --- | --- | --- | --- |
| 1 | Schedule, worked-shift detail sheet, `MyScheduleSection` | 1029 | `Clock In` | `>Clock In</div>` |
| 1b | Schedule, same sheet | 1033 | `Clock Out` | `>Clock Out</div>` |
| 2 | Supplies, pre-shift header, `SuppliesView` | 1379 | `Clock in to log usage. Requests can be submitted anytime.` | `Clock in to log usage. Requests can be submitted anytime.` |
| 3 | Pickup, approved card, `PickupView` | 1572 | `Clock in at the normal time and your daily tasks will load automatically.` | `Clock in at the normal time and your daily tasks will load automatically.` |

Lines 1029 and 1033, verbatim:

```jsx
                  <div style={{ fontSize: 9, color: GOLD, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, marginBottom: 3, fontFamily: FONT_HEAD }}>Clock In</div>
```

```jsx
                  <div style={{ fontSize: 9, color: GOLD, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, marginBottom: 3, fontFamily: FONT_HEAD }}>Clock Out</div>
```

They label `detail.clock_in_time` and `detail.clock_out_time` on the `"actual"` lane of the schedule, which the API returns empty while timekeeping is off, so this sheet renders only for a worked shift and is unreachable today.

Line 1379, verbatim:

```jsx
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}><div><div style={{ fontSize: 16, fontWeight: 700, color: t.text, fontFamily: FONT_HEAD }}>Supplies</div><div style={{ fontSize: 11, color: t.textSec }}>Clock in to log usage. Requests can be submitted anytime.</div></div><button onClick={() => setReqForm({ type: "", itemName: "", description: "", urgency: "normal", supplyId: null })} style={{ padding: "7px 13px", borderRadius: R.sm, border: "none", background: GOLD, color: NAVY, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT_HEAD }}>+ Request</button></div>
```

This one is on screen for every cleaner who opens Supplies before starting a shift.

Line 1572, verbatim:

```jsx
                    <div style={{ fontSize: 10, color: t.textMut, marginTop: 2 }}>Clock in at the normal time and your daily tasks will load automatically.</div>
```

This one is on screen under "Approved. You are scheduled for this shift." on the My Pickups tab.

No other occurrence of "clocked", "clock-in" or "clock in" exists in the file; the identifiers `clockStatus`, `clockedIn`, `clockInTime`, `clock_in_time`, `ClockIco` and `ClockView` are code, and `setActiveTab("clock")` is the tab key.

## 6.2 The word CIMS, and every certification framework term

**Locate:** command: `grep -rn -i -o '.\{0,50\}cims.\{0,50\}' --exclude-dir=.git --exclude-dir=node_modules . | grep -v package-lock` | result: `6 lines in src/App.js, 1 in CLAUDE.md, 5 in SCOUT_OUTPUT_PORTAL_V2.md` | occurrences in `src/App.js`: `8`

| File | Line | Occurrence | Rendered to a person |
| --- | --- | --- | --- |
| src/App.js | 1218 | `<span style={chipCat}>{detail.cims_category}</span>` | the raw category value, in the Tasks detail view |
| src/App.js | 1238 | `<span style={chipCat}>{task.cims_category}</span>` | the raw category value, in every checklist row |
| src/App.js | 1585 | `const CIMS_C = { SD: "#3498DB", HSE: "#F39C12", GB: "#2ECC71", QS: GOLD, HR: "#9B59B6", MC: "#2C3E50" };` | no, a color map |
| src/App.js | 1725 | `background: (CIMS_C[item.cims_category] \|\| BLUE) + "1A"`, `color: CIMS_C[item.cims_category] \|\| BLUE`, `{item.cims_category}` (three occurrences on one line) | the raw category value, in the Inspect scoring view |
| CLAUDE.md | 16 | `never show the word CIMS.` | the rule |
| SCOUT_OUTPUT_PORTAL_V2.md | 606, 611, 622, 633, 1034 | quotations of the two Tasks lines and the key list | documentation |

**Stated plainly: what renders is the value of `cims_category`** (the six codes in `CIMS_C`, per the API scouts `SD`, `HSE`, `GB`, `QS`, `HR`, `MC`). The four-letter identifier ships in the bundle as a property name and a constant name, and it never appears as visible text. This report itself now carries the word by necessity.

**Other framework terms**, `grep -rn -i -o '.\{0,40\}\(ISSA\|GBAC\|LEED\|OSHA\|Green Seal\|certif\).\{0,40\}' --exclude-dir=.git --exclude=package-lock.json .` filtered for the base64 lines: **zero occurrences.**

Report only; nothing was changed.

---

# 7. Edit anchors for the build that follows

Every anchor below was checked with `grep -o -F -- '<string>' src/App.js | wc -l`, which counts occurrences across the file, and with `grep -n -F` for the line. **Count 1 means the string appears exactly once in `src/App.js`.** None of these strings appears on lines 57 or 58.

## 7.1 Where a hydrated completed-id list would be written into state

The declaration, if the build wants to change the initial value or add a comment above it:

| Find-string | Line | Count |
| --- | --- | --- |
| `const [completedTaskIds, setCompletedTaskIds] = useState(new Set());` | 217 | 1 |

The four places a status response is handled, any of which can take `setCompletedTaskIds(new Set(cs.tasks?.completedTaskIds || []))` immediately after `setClockStatus(cs)`:

| Where | Find-string | Line | Count |
| --- | --- | --- | --- |
| `hydrateSession`, boot and login and activation | `setClockStatus(cs); if (cs.clockedIn && cs.shift) setSelectedSite(cs.shift.siteId);` | 250 | 1 |
| `handleStartSession`, after Start Shift | `setClockStatus(cs); setSelectedSite(siteId); showToast(data.message \|\| "Shift started");` | 309 | 1 |
| `loadTasks`, after the task fetch | `setTasks(tt); const cs = await api("/api/clock/status", { token }); setClockStatus(cs);` | 313 | 1 |
| `toggleTask`, after a tick or untick | `showToast("Task completed"); } const cs = await api("/api/clock/status", { token }); setClockStatus(cs);` | 314 | 1 |

The shorter string `const cs = await api("/api/clock/status", { token }); setClockStatus(cs);` appears **three** times (`:309`, `:313`, `:314`) and must not be used alone.

If the build fetches `GET /api/shift-sessions/today` instead, the natural insertion point is the same line 250, and the whole `try` statement there is unique:

| Find-string | Line | Count |
| --- | --- | --- |
| `try { const cs = await api("/api/clock/status", { token: tok }); setClockStatus(cs); if (cs.clockedIn && cs.shift) setSelectedSite(cs.shift.siteId); } catch (e) { console.warn("Clock status:", e.message); }` | 250 | 1 |

## 7.2 Where the session fetch response is handled

The session fetch is `GET /api/clock/status`; `GET /api/shift-sessions/today` has count 0. The primary handler is line 250 above. The declaration of the state it writes:

| Find-string | Line | Count |
| --- | --- | --- |
| `const [clockStatus, setClockStatus] = useState(null);` | 213 | 1 |
| `const hydrateSession = useCallback(async (tok) => {` | 246 | 1 |
| `const handleStartSession = async (siteId) => {` | 306 | 1 |
| `const loadTasks = async () => {` | 313 | 1 |
| `const toggleTask = async (taskId) => {` | 314 | 1 |

## 7.3 Where the checkbox reads its checked state

| Where | Find-string | Line | Count |
| --- | --- | --- | --- |
| the checklist row | `const done = completedTaskIds.has(task.id);` | 1238 | 1 |
| the checkbox button on that row | `onClick={() => toggleTask(task.id)}` | 1238 | 1 |
| the detail view button | `const done = completedTaskIds.has(detail.id);` | 1212 | 1 |
| the header percentage | `const completed = standardTasks.filter(tk => completedTaskIds.has(tk.id)).length;` | 1208 | 1 |
| the prop | `completedTaskIds={completedTaskIds}` | 384 | 1 |

## 7.4 Where the tick response is handled

| Branch | Find-string | Line | Count |
| --- | --- | --- | --- |
| tick | `setCompletedTaskIds(prev => new Set(prev).add(taskId)); showToast("Task completed");` | 314 | 1 |
| untick | `setCompletedTaskIds(prev => { const n = new Set(prev); n.delete(taskId); return n; });` | 314 | 1 |
| the status refetch after either | `showToast("Task completed"); } const cs = await api("/api/clock/status", { token }); setClockStatus(cs);` | 314 | 1 |

## 7.5 Where the site picker renders one site row

| Find-string | Line | Count |
| --- | --- | --- |
| `const renderSite = (site, idx) => {` | 1134 | 1 |
| `<div style={{ fontSize: 13, fontWeight: 600 }}>{site.siteName}</div>` | 1144 | 1 |
| `{siteChoices && groups.map((g, gi) => (<div key={gi}>{g.label && <div style={groupHeadSt}>{g.label}</div>}{g.items.map(renderSite)}</div>))}` | 1173 | 1 |

## 7.6 Where the empty task list is handled

| Where | Find-string | Line | Count |
| --- | --- | --- | --- |
| session open, list empty | `if (standardTasks.length === 0) return <EmptyState icon={CheckIco} text="Loading tasks..." t={t} />;` | 1206 | 1 |
| the string alone | `text="Loading tasks..."` | 1206 | 1 |
| no session, list empty | `No tasks loaded. Start your shift at a site to see your checklist.` | 1200 | 1 |
| no session, the banner | `Start your shift to check off tasks. You can view your task list below.` | 1199 | 1 |
| the state declaration | `const [tasks, setTasks] = useState([]);` | 216 | 1 |

`if (!clockStatus?.clockedIn) return (` appears **twice** (`:1197` in `TasksView`, `:1377` in `SuppliesView`) and must not be used alone.

## 7.7 Each of the three "Clock in" strings

| Where | Find-string | Line | Count |
| --- | --- | --- | --- |
| Schedule detail sheet, in label | `>Clock In</div>` | 1029 | 1 |
| Schedule detail sheet, out label | `>Clock Out</div>` | 1033 | 1 |
| Supplies pre-shift header | `Clock in to log usage. Requests can be submitted anytime.` | 1379 | 1 |
| Pickup approved card | `Clock in at the normal time and your daily tasks will load automatically.` | 1572 | 1 |

---

# 8. What the build faces

## 8.1 Whether the completion state can be populated without touching anything else

**Yes. The shape does not have to change.** The state is a `Set` of template ids and every reader calls `.has(id)`. The server sends an array of the same ids. One statement converts it:

```js
setCompletedTaskIds(new Set(cs.tasks?.completedTaskIds || []));
```

placed after any `setClockStatus(cs)` in section 7.1. No reader, no prop, no `TasksView` line and no `toggleTask` branch needs to change for the boxes to survive a reload. The `?.` on `tasks` matters because `GET /api/clock/status` with no session carries no `tasks` object the portal can rely on (`ClockView` already guards with `clockStatus?.tasks || { total: 0, completed: 0 }` at `:1123`).

**The shape it would need if the build chose otherwise:** none. If the build prefers to keep the raw array in state, every `.has` in section 7.3 becomes `.includes` and both functional updates at `:314` become array filters and spreads; that is five edits instead of one, for no gain.

**What each scope costs in the portal**, without recommending one:

| | `completedTaskIds` (this caller, this session) | `siteCompletedTaskIds` (anyone at this site today) |
| --- | --- | --- |
| The write | one line, `new Set(cs.tasks.completedTaskIds \|\| [])` | one line, `new Set(cs.tasks.siteCompletedTaskIds \|\| [])` |
| Tasks tab percentage at `:1208` | counts this caller's completions over this caller's assigned list; matches the Home bar | counts everyone's completions that fall inside this caller's assigned list; disagrees with the Home bar's `tasks.completed` |
| Home bar at `:1165` | unchanged | needs `siteTotal` and `siteCompletedTaskIds.length` to agree with the Tasks tab, a second edit at `:1123` |
| Untick of a box another person ticked | cannot happen; the Set holds only this caller's ids | sends `DELETE`, the API updates zero rows (its `WHERE user_id = $2 AND site_session_id = $3`), the portal removes the id locally, and the next status refetch (if the build hydrates at `:314`) puts it back checked; the box cannot be cleared |
| Tick of a template another person already completed | cannot happen from the Set's point of view; the box is unchecked and a `POST` inserts this caller's own row | the box is already checked so the tap sends `DELETE` (above); a second `POST` never happens from the checklist |
| Denominator | the `?user_id=` filtered list at `:313` | the same filtered list, while `siteTotal` counts every active template at the site; a site-scope percentage over the assigned list is a different number from `completed / siteTotal` |
| Mid-session site change | the new session's list, empty at first, replaces the old Set on the `:309` path | the site's whole day of completions arrives, including work done before this person started |

Both scopes are one write. The differences are in what the rest of the screen then means, and every one of them is in the table.

**If the four keys land only on `GET /api/shift-sessions/today`**, the portal needs one new fetch, best placed as a non-awaited call beside `:250`:

```js
api("/api/shift-sessions/today", { token: tok }).then(d => setCompletedTaskIds(new Set(d?.tasks?.completedTaskIds || []))).catch(() => {});
```

and the same beside `:309` and `:314` if the build wants the server to win after every change. That is a second route the portal calls, and section 3.3 says which single check decides it.

## 8.2 Everything that would break if the state moved from a Set to an array, or the reverse

The state is a `Set` today. Every place that depends on it being one, from `grep -n 'completedTaskIds\|setCompletedTaskIds' src/App.js`:

| Line | Expression | Breaks on an array because |
| --- | --- | --- |
| 217 | `useState(new Set())` | the initializer |
| 234 | `setCompletedTaskIds(new Set())` | the 401 reset |
| 304 | `setCompletedTaskIds(new Set())` | the logout reset |
| 314 | `completedTaskIds.has(taskId)` | `.has` is not a function on an array; `TypeError` on the first tap |
| 314 | `new Set(prev); n.delete(taskId)` | `new Set(array)` still works, so this branch survives by accident |
| 314 | `new Set(prev).add(taskId)` | same, survives by accident and converts the state back to a Set |
| 1208 | `completedTaskIds.has(tk.id)` | `TypeError` on the first render of the checklist |
| 1212 | `completedTaskIds.has(detail.id)` | `TypeError` on opening a detail |
| 1238 | `completedTaskIds.has(task.id)` | `TypeError` on the first render of the checklist |

**Stated plainly: writing the server array into state as an array crashes the Tasks tab on its first render, and the crash takes the whole portal with it.** `src/index.js` renders `<App />` inside `React.StrictMode` with no error boundary, and `src/App.js` defines none (`grep -c 'componentDidCatch\|ErrorBoundary'` is 0 in both). React 18 unmounts the whole tree on an uncaught render error, so the person gets a blank page on every tab until they reload, and on reload the same hydration write throws again. That is why the wrap in `new Set(...)` is the whole edit.

The reverse, array to Set, has nothing to break because nothing treats it as an array today: no `.length`, no `.includes`, no `.map`, no spread into JSX.

## 8.3 The riskiest single thing about this edit

**The type of the value written at the anchor.** One line, `setCompletedTaskIds(cs.tasks.completedTaskIds)`, passes `npm run build` (JavaScript has no type check here), deploys to Vercel on push, and blanks the app for every cleaner on the first tap of "Tasks", with nothing in the repository to catch it before a person does. The fix is five characters in the same statement. The build should include a verification step of tapping "Tasks" on the deployed portal after a session is open, before anything else.

Close behind it: the two base64 lines. None of the anchors touches them, but an edit tool that rewrites the file whole can. The two md5 values in section 1.1 make the check a two-command diff.

## 8.4 Stated plainly, one sentence each

**Can a cleaner see a task list today? Yes.** Tapping a site on the Home tab runs `POST /api/shift-sessions` at `:309`, the following `GET /api/clock/status` reports `clockedIn` with a `shift`, the tab switches to Tasks, and `loadTasks` at `:313` fetches and renders the assigned list.

**Can they complete a task today? Yes.** The checkbox at `:1238` calls `toggleTask`, which sends `POST /api/clock/tasks/:id/complete` and turns the box green in the same session.

**Does a completion survive a reload on screen today? No.** `completedTaskIds` restarts as `new Set()` at `:217` and nothing writes a server list into it, so every box comes back empty while the Home card's `{tk.completed}/{tk.total}` at `:1165` still shows the count.

## 8.5 Where the v2 scout is now stale

Every claim in `SCOUT_OUTPUT_PORTAL_V2.md` that this report touched, with its status at `1e173dd`:

| v2 claim | Status |
| --- | --- |
| CRITICAL 1, a cleaner cannot see or complete a task | **Stale.** Section 8.4 |
| CRITICAL 3, login awaits `GET /api/clock/status` inside its `try` and a throw blocks login | **Closed.** `:250` wraps that call in its own `try` and warns |
| CRITICAL 6, `completedTaskIds` is never hydrated | **Still true.** Sections 2.5 and 8.4 |
| CRITICAL 7, no activation or reset screen, `screen` takes three values | **Closed.** Seven values, section 1.3 |
| CRITICAL 8, `GET /api/lookups/all` answers 403 | **Closed.** `:253` calls `GET /api/lookups` |
| CRITICAL 9, token in React state only | **Closed.** `localStorage["ocsa_auth"]`, section 3.2 |
| CRITICAL 10, two live credentials on the login card | **Closed.** `LoginScreen` at `:458` to `:481` has no demo block; `grep -n "[redacted PIN]\|[redacted PIN]\|ocsa.temp\|Demo Accounts" src/App.js` matches one line, `58`, where the digits `[redacted PIN]` occur inside the base64 literal |
| 2.6, nothing calls `/api/shift-sessions/` | **Stale.** Two calls, section 3.3; `/today` still uncalled |
| 4.5, the four writes to `completedTaskIds` at `:143`, `:192`, `:203`, `:208` | **Moved.** Five statements at `:217`, `:234`, `:304`, `:314` twice; the clock-out reset is gone with `handleClockOut` |
| 5.3, the 401 listener clears only `token`, `user` and `screen` | **Closed.** `:234` clears eleven values including `completedTaskIds` |
| 10.2 copy list, "Clock in to check off tasks", "No tasks loaded. Clock in to a site" | **Closed.** Both now read "Start your shift", `:1199`, `:1200` |
| 10.2 copy list, `Clock in to log usage`, `Clock in at the normal time` | **Still present.** `:1379`, `:1572` |
| Every line number | **Wrong**, as the brief says; this report carries the current ones |

---

# Closing

## Questions I could not answer from the code, and what would answer each

1. **Whether `GET /api/clock/status` will carry `completedTaskIds`, `siteCompletedTaskIds` and `siteTotal` after the API build merges, or only `GET /api/shift-sessions/today` will.** Section 0 says every response carrying a task progress object gains them, and the Block 2 scout says both routes take `tasks` from `sessionTaskProgress`. The portal reads only `/clock/status`. One authenticated `curl` of each route for a user with an open session, after the API pull request deploys, settles it and decides whether the portal edit is one line at `:250` or one line plus one new fetch.
2. **The exact JSON `GET /api/clock/status` returns while the flag is off, with and without a session.** Still unquoted by any scout. The portal reads eight keys from it (section 3.3) and the deployed launch gate is working, so the shape evidently matches; the `curl` in question 1 quotes it for the record.
3. **Whether the API's `POST /api/clock/tasks/:id/complete` rejects a second completion of the same template in the same session.** The Block 2 scout quotes an unconditional `INSERT`. It decides what the double tap in section 4.6 leaves behind: two rows and a count of two, or one. `grep -n "task_completions" routes/clock.js` and a look for a unique index in `migrations/` answers it.
4. **What `GET /api/sites/:id/tasks?user_id=` returns for a School District building with zero templates.** The portal renders "Loading tasks..." for `[]`; if the route instead answers an error, `loadTasks` swallows it to `console.error` and the same card renders. One call against one of the thirteen sites answers it and decides whether section 5.5 needs a loading flag or an error branch.
5. **Whether the deployed Vercel build sets `REACT_APP_API_URL`.** Unchanged from the v2 scout; the fallback is the production host either way.

## Completeness audit, items 1 through 8

| # | Item | Status | Files quoted from |
| --- | --- | --- | --- |
| 1 | Inventory: line and byte count, lines 57 and 58 confirmed with byte counts, every component in order with range and what it renders, navigation with every `screen` value, API base and env vars, lockfile | ANSWERED. 2,031 lines and 251,727 bytes; lines 57 and 58 unchanged at 16,825 and 48,505 characters with md5 values; 20 components plus helpers and 21 icons; seven `screen` values and ten tab keys; two env vars; lockfile committed | src/App.js, package.json, .env, .gitignore, public/index.html, src/index.js, src/clientConfig.js |
| 2 | Completion state: the declaration with type, every write, every read, every reset including site change and logout and 401 and screen change, whether the server populates it, duplicate state and which one the checkbox reads | ANSWERED. A `Set` at `:217`; five writes; six reads; site change and screen change reset nothing; nothing populates it; `clockStatus.tasks` duplicates the count and the checkbox reads the Set | src/App.js |
| 3 | Boot and hydration: every effect in order with lines, the stored token and its key, whether `/api/shift-sessions/today` is called with field-by-field reads, what `tasks.total` and `tasks.completed` do, the race, site change | ANSWERED. Six effects and seven hydration steps tabulated; `ocsa_auth` with a 12 hour age; `/today` has zero calls so no field is read; the pair surfaces once on the Home card; tasks always follow a status; `handleStartSession` quoted with what it leaves | src/App.js, SCOUT_OUTPUT_API_BLOCK2.md |
| 4 | The task list and the checkbox: the URL with site id and `user_id`, every displayed field in order, the checked expression, tick and untick route and method and body, response handling, double-tap guard, grouping and sorting | ANSWERED. URL quoted, `user_id` passed; ten list fields and the detail fields; `completedTaskIds.has(task.id)`; `POST {}` and `DELETE` with no site; patch then refetch the count; no guard; grouping unchanged | src/App.js, SCOUT_OUTPUT_API_BLOCK2.md |
| 5 | The site picker and a site with no templates: every field per row, task count, selectability with the branch, the empty Tasks render, distinguishability | ANSWERED. Six fields quoted; no count; selectable with no branch; `"Loading tasks..."` in `EmptyState` at `:1206`; indistinguishable from not loaded or failed | src/App.js |
| 6 | Two known strings: the three "Clock in" views with line and string and anchor; every certification framework term with its line | ANSWERED. Schedule `:1029` and `:1033`, Supplies `:1379`, Pickup `:1572`, and the profile screen has none; CIMS eight times as identifiers in `src/App.js` plus CLAUDE.md and the v2 scout, no other term | src/App.js, CLAUDE.md, SCOUT_OUTPUT_PORTAL_V2.md |
| 7 | Edit anchors: a unique quoted find-string with line and grep count for each of the seven changes | ANSWERED. Every anchor has count 1; the two non-unique candidates are named with their counts so they are not used | src/App.js |
| 8 | What the build faces: whether the state can be populated without a shape change, Set versus array breakage, the riskiest thing, the three plain sentences | ANSWERED. One line, no shape change, both scopes costed; nine dependent lines listed and the crash path named; the type of the written value; yes, yes, no | src/App.js, src/index.js |

Totals: 8 items, 8 ANSWERED. One dependency on `ocsa-api` (which route carries the new keys) is carried in the questions list with the command that settles it.

Read-only, as instructed, with the one exception the prompt names. No code file was modified; `src/App.js` is byte-identical to `1e173dd` (md5 `57cfea632322e8254bf4a727979a6805`), and the only commit on the branch adds this report. `npm run build` was not run, since no file the build reads changed.
