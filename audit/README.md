# The audit suite

One command walks every screen the portal can show, in English and in
Spanish, at all four text sizes, on a 375 pixel screen.

```
npm run audit
```

It builds the app, serves the build, drives it in a headless browser, and
prints one table. It exits non-zero when anything failed.

**Every portal build from now on runs this and pastes the table in its
pull request.**

## What it checks

On every screen and every sheet, in both languages, at every text size:

- the page does not scroll sideways
- no text is cut off, by its own box or by an ancestor
- every control can be tapped: with the control scrolled into view, a hit
  test at its center resolves to that control and not to something over it
- every control is at least 44 by 44
- no English text shows on a Spanish screen, judged against the app's own
  word table and against what the stub served, each value sorted into a
  name, a word or a code (below)
- the bottom bar sits inside the screen, measured on every screen, since
  two faults have already landed there

Words drawn for a screen reader alone, in a box clipped to nothing on
purpose, are never cut off for anyone and never painted, so the checks for
text cut off and for contrast pass them by. The Spanish check still reads
them, since they are heard.

Then it walks the journeys a person actually takes, in both languages,
and judges each one first on what the app sent and then on what the
screen said. A journey runs the same Spanish check at the screens it
reaches, so a refusal, a toast or a reply that no sweep draws is judged
the same way.

Last, it reads every `tr()` call in `src`. **A word the portal writes
with no Spanish entry fails the run**, one row each, whether or not a case
happens to draw it. The table prints the count as `words with Spanish`.

## Names, words and codes

Every string the stub serves is one of three things, sorted by the field
that carries it. The lists are in `audit/stub.js`, under "names, words
and codes".

| Kind | What it is | On a Spanish screen |
| --- | --- | --- |
| a name | a site, a building, a person, an id, a date, a number | passes as it was sent |
| a word | a refusal, a message, form text, a Help reply, a to-do item or its zone, a checklist's shift header, a pick list choice, a notice, a supply, a leave type, a shift name, a site role | passes only as its Spanish twin |
| a code | a status, a role, a priority, a severity, an origin | fails when the screen draws it as it was sent |

Every invented word has its Spanish twin in the stub, and the stub throws
on one that has none. A kind the live API already sends in Spanish is in
`LIVE_KINDS` and is served in the language the request asks for. Every
other kind is served in English, the way the live API serves it today, so
a Spanish screen that draws one shows the gap and `known.json` names it
by its kind. The day the API sends a kind in Spanish, it joins
`LIVE_KINDS`, its entry stops matching, and the run fails until the entry
comes off.

The seven calls made before anyone signs in are the exception, the way
Step 113 made them in the API: every word on them is served in the
language the request asks for, `?locale=` first and the browser's own
`Accept-Language` after it. A call that forgets `?locale=` hears back in
the phone's language, which is what a case with a phone set to the other
language catches.

A value written with a `{placeholder}` is judged by what fills it too, so
a Spanish sentence with an English word inside it still fails. What a
journey types is the person's own words, and passes as a name when a
screen shows it back.

## A fresh phone

`openApp(browser, base, { language: "es", storeLanguage: false })` opens
a phone that has never chosen a language. Nothing is stored on the first
load, the phone itself is set to the case's language, and whatever the
app stores after that is kept through a reload. The `beforesignin`
journey uses it.

`openApp(browser, base, { language: "en", phone: "es" })` opens a phone
set to one language showing the portal in the other: the language is
stored as the case's, and the browser's own language, which it sends as
`Accept-Language`, is the phone's. The `signedoutlocale` journey uses it
to prove each of the seven calls made before signing in carries
`?locale=`.

## The checklist

The stub answers `GET /api/sites/:id/tasks` the way the API does: called
plainly, every active item at the site; called with `?user_id=`, only
the items a manager linked to that person; and `building_name` and
`floor_number` matched exactly, so an item with neither drops out when
either is sent. North Building has items on two buildings, two floors
and neither, and the person a case signs in as is linked to six of
them. South Building's list is set out in shifts, served in no useful
order, with nobody linked to anything. Start Shift and the status count
both lists, `total` and `siteTotal`, and every check made today is kept
by who made it, so `completedTaskIds` and `siteCompletedTaskIds` are
read back the way the API reads them, and a check made on one phone is
seen on another that shares the stub.

The sweep draws the Tasks tab a second time, from South Building's
whole list, as `Tasks, the whole site in shifts`.

## The checklist day, shifts and periods

The stub answers Step 124 in the API. Every session answer, the status's
`session` included, carries `shiftLabel` and `shifts`: none at a site
with fewer than two shifts, and otherwise one per shift in label order,
each with its blocks, the hours they span and whether the session's start
time suggests it. `PATCH /api/shift-sessions/:id/shift` changes the shift
and answers `{ today, session, tasks }`, and turns a change away with the
API's own sentence in the request's language. The checklist day starts at
4:00 AM in New York, and only the items due that day count: `total`,
`completed`, `siteTotal` and both id lists hold due items only. `periodic`
counts the repeating work by period over the list the person is shown,
`hasLinkedItems` says whether they have links at the site, and
`checkedToday` says who checked what today. Every row of the list carries
its `period`, `dueToday`, `doneThisPeriod`, `shownToday`, `checkedToday`,
`display.shift` and `display.block`, and the category code the live API
sends, which no screen should draw. `day=today` answers what the
checklist day shows and `day=all` every item. An uncheck of a check that
somebody else made today is turned away with 403 `NOT_YOUR_CHECK`.

West Building is invented in the shape of the busiest live list: a day
shift, a night shift that runs past midnight, a block in each with no
time, work that repeats every week, every two weeks, every month, every
quarter and every season, some of it done this period by a coworker, an
every other day item done yesterday, one as needed, one the day does not
show, and two items tied to no shift. Its session carries no shift until a
case names one. North Building has no shifts, and the session at South
Building was started on the morning shift.

The sweep draws the Tasks tab three more times, at West Building, in
every combination: `Tasks, which shift`, the sheet in a session that
carries no shift yet; `Tasks, which shift, no signal`, the same sheet
once Use this shift could not reach OCSA, with its line and Try again;
and `Tasks, today and the periods`, the night shift's list with a
coworker's check tapped, its clock held while the checks read the line
the tap says. Each name starts with the tab's, so what is known about the
tab is known about them too.

`stub.peek` reads what the API would answer right now without asking it,
so nothing is recorded: `progress()`, `rows(site, search)` and
`session()`. A journey judges the screen by it. `openApp(browser, base, {
now })`, with the same time given to the stub as `stubOptions.now`, moves
the phone's clock and the stub's, for a case that needs the morning.

## Chat

The stub answers the three chat routes the way Scout 138 read and ran
them. `GET /api/chat/channels` is an array: the site and general chats
sorted by name, then the private chats. An admin, `ADMIN_PERSON`, sees
nine group chats, eight sites and one general, and the private chat of
every staff member, six by default and up to twenty with
`stubOptions.chat.privates`, each named for an invented person, with
`staffUserId`, `lastMessage`, `lastMessageAt` and some unread. An admin
has no private chat of their own. Everyone else sees their site's chat,
the general chat and their own private chat, which the API names the
literal `Admin (Private)` with no `staffUserId`.
`GET /api/chat/channels/:id/messages` is the newest 50, oldest first.
`POST` to the same route answers 201 `{ message }`, its text trimmed, and
keeps it. Every refusal is English with no code: 400 for no text, 404 for
a chat that does not exist, 403 for one that is not the person's, 500
when a case asks.

A case can turn any route away through `state.refuse`, drop its
connection through `state.drop` or `stubOptions.drop`, keyed
`"METHOD /path"`, answer an empty list (`chat.empty`), hold one chat
(`chat.only`), serve rows missing a field (`chat.oddRows`), and from the
case itself hold each send's answer (`state.chat.holdMs`), keep the next
send and drop its connection before the answer (`state.chat.saveThenDrop`),
or answer it with no message (`state.chat.noMessage`). An update is held
waiting by `openApp(browser, base, { buildStamp })`: the version check is
answered with that stamp, which is not the build's, and the app reloads
the moment nothing is underway.

## Help's answer, as it is written

The stub answers both of Help's routes from the same steps. The
streaming route, `POST /api/agent/message/stream`, sends them the way
the API does: `meta`, the answer in `delta` pieces cut wherever the
writing was, in the middle of a word or of a bold phrase, then `done`
with the reply the message route sends, key for key. The message route,
`POST /api/agent/message`, waits until the last step is written and
sends that reply whole, the way it always has.

Playwright's `route.fulfill` hands the browser a body whole, so a stream
cannot go through it. The route in `browser.js` answers the streaming
route with a 307 to a small server in `stream.js`, and the browser
follows it there: the request the app made is the one the stub records,
headers included, and the answer comes over a real connection a piece at
a time, with a pause before each one. A dropped connection is the socket
destroyed part way, so the app meets the error a phone losing signal
meets.

A case sets `state.help.next` before it asks, and the next question on
either route is answered that way: another answer, a `reset` and an
answer written again, an `error` part way, a JSON refusal before any
stream, a connection dropped after `meta`, a piece that arrives in two
parts, or holds, named points the answer stops at until the case lets it
go. Every question is kept in the conversation at once and its answer
once it is written, a dropped one included, so
`GET /api/agent/conversations/:id` reads back what the API would. The
list of options is in `helpPlay` in `stub.js`.

A Help reply is drawn a line, a step and a bold phrase at a time, and
heard whole by a screen reader once it is done, so the stub records each
of those as a Help reply beside the same of its Spanish twin. The answer
so far, drawn as plain words while it arrives, is recorded as a Help reply
too, in the language it was sent.

The sweep draws Help three more times in every combination, in a session
of its own with a report started: `Help, while the answer arrives`,
stopped halfway through an answer with a bold phrase and a step drawn;
`Help, the answer done`; and `Help, the connection dropped`, with the
conversation refused once so the line and Try again stay on the screen.

## Coverage proves itself

`audit/inventory.js` reads the tabs, the sign in screens and the full
screen sheets out of `src` and reconciles them against the cases the
suite drives. **A screen or a sheet with no case prints `NO CASE` and
fails the run**, so a screen added tomorrow cannot land untested.

## Known failures

`audit/known.json` holds what the app gets wrong today. Each entry names
the check, the text that identifies it, the screen it is on, and one line
on why.

- A known failure prints as `KNOWN` on every run and does not fail it.
- **A known failure that starts passing fails the run** until it is taken
  off the list, so a fix is always noticed.

The next build fixes them and removes them. The suite never changes
anything under `src/`.

## Accepted

`audit/known.json` also holds an `accepted` list: what the app does on
purpose. A name or a draft title that runs out of room and ends in an
ellipsis is one of them. An accepted row prints as `ACCEPTED` and never
fails a run, whether it shows up or not.

## How it is put together

| File | What it holds |
| --- | --- |
| `run.js` | the one process: build, serve, drive, print the table, set the exit code |
| `serve.js` | a static server for the build, on Node's own http module |
| `stub.js` | the whole API in one file, so the next build extends it in one place. Every value in it is invented, and every value it serves is sorted into a name, a word or a code |
| `stream.js` | Help's streaming route played over a real connection, a piece at a time |
| `browser.js` | a phone shaped page with the clock fixed and storage seeded |
| `inventory.js` | what the app can show, read out of `src`, and what the suite drives |
| `checks.js` | the checks every screen is put through |
| `screens.js` | how each screen and sheet is reached, and the sweep |
| `journeys.js` | the journeys, in both languages |
| `known.js` | the known failure list and how a row is matched to it |
| `known.json` | what the app gets wrong today |
| `words.js` | the app's Spanish table, read without importing it, and every word the portal writes through `tr()` |

## The clock

Fixed at 9:30 PM on Thursday, October 1, 2026, in America/New_York. That
is already October 2 in UTC, so a date read as UTC midnight shows a day
early and the suite catches it.

## Options

- `npm run audit -- --no-build` drives the build already in `build/`.
- `AUDIT_PORT=4788` sets the port the build is served on.
- `AUDIT_ONLY=screens` or `AUDIT_ONLY=journeys` runs one half, which is
  what you want while working on a single case.
- `AUDIT_WRITE_KNOWN=1` writes what is failing today into `known.json`
  with a placeholder reason. Write the reason on each one by hand.

`npm run build` rewrites `src/buildStamp.js`, so the run puts that file
back exactly as it found it and leaves the working tree alone.
