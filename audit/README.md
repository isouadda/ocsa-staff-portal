# The audit suite

## The smoke check

```
npm run build && npm run smoke
```

`audit/smoke.js` (Step 237) is the check every build runs, beside the
build and the guide check. It builds nothing: it serves the `build/` that
`npm run build` left, and stops with a failing line when a source file is
newer than that build. It drives the portal at 390 wide against the stub,
in English and Spanish: a cleaner signs in, every bar tab and every More
item opens with no page error and no sideways scroll, Start Shift's
screen draws, a form opens, Help answers; under a how-to answer Help
draws the picture of the screen from the screen's language's file, opens
it full screen and closes it, draws none under an answer with none, leaves
out a picture with no file, and draws it on an answer read back (Step 277);
`/sds` draws with no sign-in
(English alone, since that check reads the API's sheet names);
the sign-in code screen appears when the stub answers `secondStep`;
sign-in made simple and closed (Step 285), against the API's Step 283 as
the stub answers it, in English at 390 and Spanish at 320: Enter pressed
twice on the PIN sends one sign-in, the code screen is still there after
a reload and its code signs in, Change PIN with a wrong current PIN reads
the API's words under Current PIN and stays signed in, a first supply
request on an empty list takes items once `GET /api` lists the decide
route, a 502 from `/api/auth/me` at boot keeps the session with Try again,
and the supply label's page met with a 403 `auth.mustSetPin` lands on
Choose your PIN, keeps the token change-pin answers and comes back to the
page signed in; a
cleaner never asks for `/api/workspace` and a supervisor sees Workspace;
a cleaner sees no Field kit and asks for none of its routes, and a
supervisor's Field kit issues PPE with a signature drawn, reads periodic
work by state, opens and checks an item from its equipment list, and
signs a review line and meets a refusal;
the customer page reads customerFields and photoRoute from the public
form answer alone, in the API's as-built shapes (Step 249): OCSA-FRM-007
and OCSA-FRM-006 ask the name once in their own question, draw neither
of the page's own, and send a photo through the link's route, filed by
id, while a form answered customerFields null and photoRoute false draws
the page's own Your name and Your role and sends its photo inside the
filing; a check-off with no signal is kept and said, and goes once with
its clientId when the signal is back; an equipment label's page opens and
records a check; a periodic task says how often it comes; a checklist
with one touchpoint and one critical touchpoint draws both chips, and the
critical item's detail draws its chip; a concern link (OCSA-FRM-009)
takes a photo through its own route and shows the reference after filing;
the request page at 320 wide on the site-wide link asks where, says a
refusal under its field, files a request with a photo through its own
route and shows the API's thanks, and a second filing of the same
category joins it; Client requests for an approver, Home's card, the
section, Approve and assign with its picker and the 409 when someone
else decided first, and for an assignee, the request opened from the
notice's link, /requests/<id>, then I'm on it and Done; the supply
page signed out, with the sheet in the page and Sign in to record use,
and signed in, with Used one and Running low; Inspection findings
(Step 255), a completion that opens two findings through the API alone,
one with an owner, with the API's refusal under the card it names, the
answer screen with the band and each finding, and the owner's finding
on Report, Fixed and Waiting for a check; My training (Step 258)
under More, with To do, Coming due, Done and History from an invented
answer, and the line a person with nothing required reads; Online
lessons (Step 261), Home's card, a lesson read with its blocks and its
Spanish switch, failed once with the score, the missed count and the
tries left, then passed, signed and waiting for the trainer, and a
supervisor's sign-off from Home's card through the field kit's tile,
with the tick asked for and the API's refusal in its words; Step 264,
Your first trainings on Home with the document to sign and the first-day
training that has a lesson, a session joined from /join/<code> with the
understood tick and a signature, a document read section by section and
signed with the version read, a supervisor's session started with its
code and QR, a sign-in arriving and the close with a signature, and a
checklist watched, an unticked step named, the person's signature and
the trainer's sign-off; the training portal (Step 267), with categories
in the answer, the overall progress, Continue where you left off and
three category cards, two a row at 390 wide and one at 320, the safety
category's page with its modules and chips at /training/c/safety, the
ladders lesson with a drawing and a photo both decoded, the picture full
screen, the held Spanish line over an English safety lesson, Back to the
category page and the phone's back to the portal, in English at 390 and
Spanish at 320; Sign on your own phone (Step 271), Home's card and the
list of what waits, a key signed with the signature drawn, PPE sent back
to the office with a note, a written warning opened and declined, the
signed key's address reading done, My company property with what the
person holds and returned, and with the routes not answering no card and
no More item, in English at 390 and Spanish at 320; a supply request
with many items (Step 281), against an API that answers items: My
requests reading a decided request, Approved 3 of 5 and Denied with the
office's note, a refill of four items with one removed posted once as
three items in order with their quantities and note, a refusal naming
items.0.itemName under that item's name, the 31st item refused on the
phone, and a damage report posted as before, one supply and no items, in
English at 390 and Spanish at 320;
French offered by the stub turns the screen French with no English the
portal drew; and Home at the Largest size, 360 wide, has no control cut
off. Each check prints one line, PASS or FAIL, and the command exits
non-zero on any failure or when the run takes three minutes or more.
Since Step 258 it waits for each screen to be there rather than sleeping
a fixed time after every load and tap, and a run takes about 100 seconds;
the three-minute line stays where it was. Since Step 277 the training session's
sign-in arrives by moving the phone's clock on rather than waiting out
the screen's five-second reads, and Edit shortcuts, opened from More, is
closed by its own Close, so the rest of a cleaner's run is not tapped
through it.

The stub routes it needs sit behind switches in `makeState` (`languages`,
`sds`, `secondStep`, `workspace`, `customerAsks`, `equipment`,
`concern`, `fieldKit`, `requests`, `supplyQr`, `findings`, `training`, `documents`, `trainingPortal`, `signatures`, `supplyItems`, `supplyEmpty`, `pinGate`), off for every other case.
`pinGate` (Step 285) answers as the API's Step 283 builds it: while
`mustSetPin` is true, every route behind the token but `GET /api/auth/me`,
`POST /api/auth/change-pin`, `GET /api/languages/status` and
`GET /api/push/key` answers 403 `auth.mustSetPin`, and change-pin answers
a new token. With every switch off, sign-in answers the way Step 283 does
too: the contract's words for a miss, five misses in a row on what was
typed locked with 429 `auth.locked` and its minutes until a sign-in gets
in, 409 `auth.noEmailForCode` for an invented office badge, change-pin's
`PIN_INCORRECT` as a 401, and, behind `secondStep`, the code routes with
five wrong codes, a fourth send and an ended challenge answered as
`helpers/secondStep.js` answers them. `supplyEmpty` is `supplyItems` with
no request yet, and `supplyItems` answers `GET /api` with the decide
route listed. The full suite below is separate
and is not run by it.

## Pictures for Help

```
npm run build && npm run shots
```

`audit/shots.js` (Step 277) takes the pictures of the screen Help draws
under an answer. Like the smoke check it serves the `build/` that
`npm run build` left and drives it against the stub, at 390 wide in the
light theme, in English and in Spanish, and writes
`public/guide-shots/<name>.en.jpg` and `<name>.es.jpg`, each a JPEG of at
most 250 KB. One list in the file names each picture, the guide entry it
belongs to and the taps that reach its screen, and the entries a picture
cannot show, each with the reason. `npm run shots -- <name> <name>` takes
only the pictures named. It prints a line for each file, and fails on a
screen that did not come or a page error on the way, and with
`SHOTS_DEBUG=<folder>` keeps what such a screen showed. Two stub switches
serve it alone: `guideForms` lists the forms the guide names by title, so
each of those entries shows its card on Forms, and `chatPeopleRoute`
answers the people Chat's New message offers.

The smoke check never runs it, and it takes about fifteen minutes for
every picture. Taking pictures writes into `public/`, so build again
before the smoke check. How the guide names a picture, and what
`npm run guide-check` holds them to, is in `guide/README.md`.

## The full suite

One command walks every screen the portal can show, in English and in
Spanish, at all four text sizes, on a 375 pixel screen.

```
npm run audit
```

It builds the app, serves the build, drives it in a headless browser, and
prints one table. It exits non-zero when anything failed.

The owner paused this suite in late September. Until it is brought back,
every build runs the smoke check above instead.

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

Text inside a box that scrolls is not cut off by it: a person scrolls to
it, the way Chat's row of private chats scrolls sideways. From that box
up, the box stands in for the text, and it is the box that has to fit
inside anything that hides what sticks out of it.

Then it walks the journeys a person actually takes, in both languages,
and judges each one first on what the app sent and then on what the
screen said. A journey runs the same Spanish check at the screens it
reaches, so a refusal, a toast or a reply that no sweep draws is judged
the same way.

Last, it reads every `tr()` call in `src`. **A word the portal writes
with no Spanish entry fails the run**, one row each, whether or not a case
happens to draw it. The table prints the count as `words with Spanish`.
It reads `src` and `translation` for a word the apps retired, too, in
`RETIRED` in `audit/words.js`: the API and the admin dashboard say
suministro for a supply, so insumo on any line fails the run, one row
each.

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

## Every request says the screen's language

Since Step 137 the API answers a signed-in call in `?locale=` first and in
the account's language after it. Every request the portal makes goes
through `reach()` in `src/App.js`, which adds the screen's language to any
path that does not already name one, so a Spanish screen reads every
answer in Spanish whatever the account says, and the other way round.

The stub holds every request to that. Each one says its language once, as
`?locale=` with `en` or `es`. A signed-in request that says none, says it
twice or names another is turned away with a 400, and each route it
happened on is a row of its own in the table, so a call added later
without the language fails the run by name. A call made before signing
in that says none is answered the way it always was, in the phone's
language, and is a row too.

The `screenlanguage` journey sets the account to the other language while
the phone stays signed in, the way it is once a person's language is set
from the dashboard, and turns three routes away with a refusal a cleaner
meets, written the way Step 137 writes it, under the API's own key: a time
off date problem, a shift somebody else already took, and a supply
request the API reads with no type. Each is judged first on the request,
which says the screen's language once, and then on the screen, which
reads the refusal in that language.

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
them, with the refusals Step 132 gave them. `GET /api/chat/channels` is
an array: the site and general chats sorted by name, then the private
chats, the caller's own last. An admin, `ADMIN_PERSON`, sees nine group
chats, eight sites and one general, and the private chat of every staff
member, six by default and up to twenty with `stubOptions.chat.privates`,
each named for an invented person, with `staffUserId`, `lastMessage`,
`lastMessageAt` and some unread. An admin has no private chat of their
own unless `stubOptions.chat.ownPrivate` gives them one. Everyone else
sees their site's chat, the general chat and their own private chat,
which the API names the literal `Admin (Private)` with no `staffUserId`.
`GET /api/chat/channels/:id/messages` is the newest 50, oldest first.
`POST` to the same route answers 201 `{ message }`, its text trimmed, and
keeps it. Every refusal carries a code beside `error`, and `error` is in
the request's language, `?locale=` first and then the account's:
`chat.notFound` 404 for a chat that does not exist, `chat.noAccess` 403
for one that is not the person's, `chat.textRequired` 400 for no text,
and `chat.textTooLong` 400 for more than 2,000 characters.

A case can turn any route away through `state.refuse`, with a body of its
own, with `{ chat: code }` for one of Chat's refusals written the way the
API writes it, or with `{ api: key }` for one of the three refusals in
`API_REFUSALS`, in the request's language the same way. It can drop a route's connection through `state.drop`
or `stubOptions.drop`, keyed `"METHOD /path"`, answer an empty list
(`chat.empty`), hold one chat
(`chat.only`), serve rows missing a field (`chat.oddRows`), and from the
case itself hold each send's answer (`state.chat.holdMs`), keep the next
send and drop its connection before the answer (`state.chat.saveThenDrop`),
or answer it with no message (`state.chat.noMessage`). An update is held
waiting by `openApp(browser, base, { buildStamp })`: the version check is
answered with that stamp, which is not the build's, and the app reloads
the moment nothing is underway.

The sweep draws Chat four more times, each in a session of its own and
in every combination: `Chat, every chat`, an admin's list of nine group
chats and twenty private chats with a group chat open, the private row
scrolling on its own; `Chat, a message not sent`, a site chat with words
in the box and a send turned away, its line under the box with Try again;
`Chat, pick a chat first`, words in the box and Send tapped with no chat
chosen; and `Chat, the list did not load`. Each name starts with the
tab's, so what is known about the tab is known about them too.

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
either route is answered that way: another answer, the codes an answer
cites, a `reset` and an answer written again, an `error` part way, a JSON refusal before any
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

## A form's sections

The stub's forms list carries two forms whose questions each name a
section and whose sections have no title, the way the live API sends
them today. With `stubOptions.sectionsForm` it carries a third,
`TEST-FORM-S`, whose sections are keyed `"1"` to `"3"`, the way the API
keys them, with titles under `sections` as `[{ key, title }]`: the first
two titled in the language the request asks for, and the third with
none. The API keeps each form's section titles in its definitions and
sends none yet, so this is the key the portal reads them under once a
catalog sends them.

## Photos and a drawn signature on a form

The second form carries a photos question, `pics`, taking three photos
at most rather than the API's six, so a case reaches the limit on one
screen. The stub answers the six routes Step 163 gave the API:
`POST /api/forms/responses/:id/photos/:questionKey` reads the multipart
body as the bytes the browser sent (`browser.js` hands a multipart body
over as a buffer), checks every file before it keeps any, refuses a
HEIC, a file that is not a picture, one over 10 MB or one over the
limit in the request's language, and answers `{ key, photos }`; `DELETE
.../photos/:questionKey/:photoId` takes one off; `GET
.../photos/:photoId/thumb` and `GET .../photos/:photoId` stream the
bytes back. Each upload's files are put on the call's record as
`files`, each with its name, its kind read off its bytes and its width
and height, so a case can read what the phone made of a photo. A
photos answer written through a save is refused the way the API
refuses it. The sign-off route requires `signature`, a PNG data URL of
at most 300 KB, refuses one missing, not a PNG or too large in the
request's language, stamps `signatureId`, and puts the PNG's size on
the call's record as `signature`; `GET .../signatures/:key` streams it.
The photo refusals a cleaner meets and `forms.signatureRequired` are in
`API_REFUSALS`, so a case asks for them with `{ api: key }`; the ones
no screen should meet are in `FILE_REFUSALS`. `state.holdMs["METHOD
/path"]` answers one call that many milliseconds late, so a screen can
be read while it waits.

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
