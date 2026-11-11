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
three items in order with their quantities and note (each supply picked
once its picker has drawn all four rows, since Step 294), a refusal naming
items.0.itemName under that item's name, the 31st item refused on the
phone, and a damage report posted as before, one supply and no items, in
English at 390 and Spanish at 320;
the round of Step 290, against API Step 289 as its contract gives it and
the stub answers it, in English at 390 and Spanish at 320: the handbook
reader's cover with the title on its navy band, See the designed version
read behind the token in the language answered, Contents by Part, section
1.2's Table columns lines drawn as a table, a callout in its box, the
signing step with its six fields filled in and the paper form's lines
left out, Sign sent once, Download my signed page behind the token, and
the handbook found under Signed documents and read again to its end with
no signature box, a Spanish phone reading the Spanish edition; Issue
PPE's person and Watch and sign off's narrowed by typing, No one matches
that name., a chip tapped opening the search again empty, and a Refill
item's supply narrowed to one and posted; the sign-in screen reading
Can't sign in? Email from GET /api/support/contact asked with no token,
a bug filed from App support with its details and listed first in My
tickets, Help's drafted ticket filed only once sent from its card, and a
PTO request;
activating from the welcome email (Step 294), against API Step 292 as
its contract gives it, in English and Spanish at 390: the link opens
with no badge box, a weak PIN is refused on the phone in Change PIN's
words with nothing sent, and a good PIN activates once, with no badge
number, and signs in;
inspections on the schedule (Step 296), against API Step 295 as its
contract gives it, in English at 390 and Spanish at 320: a supervisor's
own inspection drawn on the week and the month, and as an Inspection row
on the day's sheet beside the shift, the row opening it on Inspect, a
cancelled one and someone else's not drawn, and the bell's notice
opening it;
one place to work an issue (Step 297), against API Step 298 as its
contract gives it, in English at 390 and Spanish at 320: a supervisor's
Issues row opening its sheet and the one assigned to them reading
Assigned to you, a cleaner's Assigned listing a task, an issue and a
finding each once, the issue resolved from its sheet with a note and a
photo through its task and gone from Assigned, and the bell's notice
opening the issue's sheet; and unfinished forms you can see: Home's
card opening the person's draft, Save and finish later saving the
answer once and closing the form, and the reminder's notice opening the
draft;
the Library (Step 307), against API Step 305 as its contract gives it,
in English at 390 and Spanish at 320: the folders in the contract's
order with their counts, a folder's documents with Also in Spanish (In
English only on a Spanish screen), a search for a word in the text
finding the document with the section it matched and opening it at that
section, the quality manual's cover in the screen's language with See
the designed version read behind the token, its last page with no
signature box and no Next, Help's Open button opening it in the Library,
and an empty list saying the library is loading; supply orders on the
phone (Step 311), against API Step 308 as its contract gives it, in
English at 390 and Spanish at 320: a holder's Home card opening Approve
supplies in its three groups, one item approved at a lower quantity and
another denied with a note, each sent once, the line asking the office
when no vendor is approved, Sign with a vendor whose details show, the
purchase order read behind the token, Send to the vendor's email then
Ordered with its date, the bell's notice opening the request, and
someone without the capability seeing no card and no Approve supplies;
one inspection walk (Step 313), against API Step 312 as its contract
gives it, in English at 390 and Spanish at 320: the inspection opening
on its site checklist, the safety walk drawn by the form engine with its
first part filled in, a Fail with no finding listed as missing and
nothing sent, leaving and coming back with the scored cards and the
safety answers kept, one signature and one Submit carrying both parts,
the result with the band, the safety result and its finding, and an
inspection without the safety part drawn as before; timed site schedules
(Step 316), against API Step 315 as its contract gives it, in English at
390 and Spanish at 320, at the stub's invented two-shift site with every
kind: each block's window drawn, a meal block with no steps, a
full-access block marked, Now and Next marked in their place at 10:00 AM
on a Monday; at 6:00 PM on a Tuesday, on the second shift, the block
titles in time order top to bottom, Now on both 6:00 PM blocks in their
place with the 2:00 PM check-in above them, the list opened at the Now
block once and left where it was after a check-off, and one block's
steps sent in reverse with sort_order and another's with sortOrder drawn
in step order (part 345); an
overdue critical block, check-in and check-out as the shift's start and
end, a Wednesday to Sunday block absent on the Monday, and an anytime
block on a Saturday with no window and its weekly step;
the training day round (Steps 335, 336 and 339), against API Steps 326
to 331 and 337 as the training day contract gives them, in English at
390 and Spanish at 320: on one supervisor's phone, the subscription the
phone holds posted again with app "portal", an HR case's notice opening
the case sheet with Open in the dashboard on it (part 355), the
unfinished inspection's notice opening that
inspection and a new shift's opening My Schedule, each of the API
round's other notices tapped in turn with a line each (a task given
opening Tasks on that task when the open shift's list holds it and on
the list when it does not, training_assigned, training_session and
training_todo opening My training, site_assigned opening Home, and
support_ticket_new and workspace_member keeping Open in the dashboard
with the bell left where it is), then Start an
inspection at a site with one template landing in the walk with its
safety part started and posted as today's in Eastern time with startNow,
the template and the date, a site with two templates asking which, and a
start answered with no id still ending on today's inspection; and a task
list to read, at a site answered checklistMode reference, on the shift
with its line and no box, percentage or count, from the site on Home
with no shift open, and a tracked site as before until a check is
refused with tasks.siteNotTracked;
French offered by the stub turns the screen French with no English the
portal drew; and Home at the Largest size, 360 wide, has no control cut
off. Each check prints one line, PASS or FAIL, and the command exits
non-zero on any failure or when the run takes three minutes or more.
Since Step 258 it waits for each screen to be there rather than sleeping
a fixed time after every load and tap, and since Step 290 its checks run
in two lanes side by side on the one browser, each check on its own phone
and stub, so a run takes about 100 seconds with the round's six checks
added; the three-minute line stays where it was. Since part 344 the
checks are one queue, longest first, drained by three lanes, so a run
that took 167 seconds in two fixed lanes takes about 100; `SMOKE_LANES=<n>`
sets the lanes and `SMOKE_TIMES=1` prints each check's seconds after the
run, which is where the number beside each check's name in the list came
from. `SMOKE_ONLY=<words>`
runs only the checks whose name holds them, for working on one; every
build runs them all. Since Step 277 the training session's
sign-in arrives by moving the phone's clock on rather than waiting out
the screen's five-second reads, and Edit shortcuts, opened from More, is
closed by its own Close, so the rest of a cleaner's run is not tapped
through it.

The stub routes it needs sit behind switches in `makeState` (`languages`,
`sds`, `secondStep`, `workspace`, `customerAsks`, `equipment`,
`concern`, `fieldKit`, `requests`, `supplyQr`, `findings`, `training`, `documents`, `trainingPortal`, `signatures`, `supplyItems`, `supplyEmpty`, `pinGate`, `handbook`, `handbookSigned`, `support`, `pto`, `scheduleInspections`, `issueSheet`, `unfinishedForms`, `library`, `libraryEmpty`, `supplyOrders`, `orderVendorsNone`, `inspectionWalk`, `startInspection`, `startNoId`, `checklistModes`), off for every other case.
`library` (Step 307) answers GET /api/library as API Step 305's contract
gives it: five invented documents in four folders, each folder's name in
the request's language, the quality manual with a Spanish edition, Parts
and a PDF, and the word "eyewash" in the first aid procedure's section
3.2 alone, so `?q=` finds it by its text with `match` naming the
section; each document's read for everyone, its PDF behind the token,
and Help's `covers` answer carrying `openDocument`. `libraryEmpty`
answers the list with nothing yet.
`supplyOrders` (Step 311) answers API Step 308's routes as its contract
gives them: GET /api/supplies/requests with canDecide and the order's
fields (every request to a holder, a person with `approveSupplies`, such
as `ORDER_HOLDER`, a custodian by role), one waiting for a decision, the
holder's own, one signed and not sent and one ordered; the decide, sign
and send routes with their refusals keyed as the API keys them, nobody
deciding or signing their own; the purchase order behind the token; the
approved vendors on GET /api/vendors; approve_supplies on the
permissions route; and, for a holder, the bell's notice about the
request waiting. `orderVendorsNone` answers the vendor list with none
approved.
East Building (Step 316), opened with `site: "site-east"` and a `now`
for the stub and the phone, is an invented two-shift site whose blocks
carry API Step 315's end, kind and days: First shift 7:00 AM to 3:30 PM
and Second shift 2:00 PM to 10:00 PM, with check-in, work, critical,
meal, full-access, anytime and check-out blocks (`EAST_BLOCKS`). Every
block comes on the session's shifts with `endTime`, `kind` and
`daysOfWeek`, the meals, check-in and check-out among them though they
hold no step; each checklist row carries its block's `end_time` and
`kind` and the block's days as `block_days_of_week`; a block's days hide
its rows on other days, as the API does; the stairway block's step is
weekly work; the rows, shifts and blocks answer in the language asked;
and two of the day's steps are checked by coworkers, one of the dining
room reset's two. No other site carries any of it, so every other case
reads a list from before Step 315.
`startInspection` (Step 335) answers what Start an inspection reads and
posts, as the training day contract gives API Step 331: GET
/api/inspections/templates with each template naming its site as
`site_id` (North Building one, South Building two, West Building none),
GET /api/sites as the API answers a supervisor (`id`, `name` and
`status`, a closed site among them), and POST
/api/inspections/scheduled with `startNow` writing an inspection of the
caller's with the walk's cards and its safety part, answered as the row
itself, 201, as today's API answers a schedule; `startNoId`, which a case
may set part way, answers it with no id. Every start's body is kept in
`startCalls`. Behind it a scheduled inspection's read carries the safety
part only with `inspectionWalk` on as well.
`checklistModes` (Step 339), a map of site id to `reference` (any other
site `tracked`), answers each site's `checklistMode`, as API Step 337 is
contracted, on Start Shift's sites, on `GET /api/auth/me`'s sites, on the
clock status's shift and on every row of the task read; at a reference
site the clock status's counts answer `notTracked: true` and no
completion, the rows answer no completion, and a check or an uncheck is
refused 409 `tasks.siteNotTracked`. A case may change the map part way.
`inspectionWalk` (Step 313) answers API Step 312 as its contract gives
it: a scheduled inspection with `with_safety`, two cards, the photos and
the signature it takes, and `safety` carrying an invented safety
inspection form (its sections, an areas checklist, a crew table of two
rows at least, a findings table, the overall result and an Inspected by
sign-off) with the inspector's own draft, its site and kind filled in;
the draft saved through the forms route, with what is missing by the
form's rules (every area, two crew rows, a finding for every Fail);
the one completion carrying both parts and the signature, refused with
the safety part's missing fields until both are complete, and answered
with the band and the safety result and findings; and beside it an
inspection without the safety part.
`scheduleInspections` (Step 296) gives the person signed in an inspection
on the day of their shift, one of theirs cancelled and one of someone
else's, dated as the API sends a date column, with API Step 295's notice
about the first in the bell; `GET /api/inspections/scheduled` matches
`?status=` and answers anyone but an admin or a supervisor only their own,
as the API does.
`issueSheet` (Step 297) answers GET /api/issues with an issue assigned to
the person as a task, one nobody has, and a finding they own that is
also a task, GET /api/issues/:id with the actions the caller may take,
the task route settling the issue it carries, the issue's own PATCH and
assign-as-task, and the bell's notice about the issue nobody has;
`unfinishedForms` gives the person their own draft of the incident
report on GET /api/agent/drafts and the morning reminder about it.
`handbook` (Step 290) answers the document to sign as API Step 289 does:
the invented handbook in English and Spanish with parts, ackSectionRef,
pdfUrl and the signed page's ackFields, the designed version and
`my-signed-page` as PDFs read with the token, and `documentsSigned` on
`GET /api/training/me`; `handbookSigned` starts it signed. `support`
answers App support's contact, the person's tickets with one the office
is working on, `POST /api/support/tickets` with its refusal keyed by
field, and Help's `ticket` answer carrying `ticketDraft`; `pto` puts PTO
first among the leave types.
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
under an answer, and since Step 294 writes the day it took each one to
`guide/shots-taken.json`, which `npm run guide-check` holds every
entry's `Last checked:` against. Like the smoke check it serves the `build/` that
`npm run build` left and drives it against the stub, at 390 wide in the
light theme, in English and in Spanish, and writes
`public/guide-shots/<name>.en.jpg` and `<name>.es.jpg`, each a JPEG of at
most 250 KB. One list in the file names each picture, the guide entry it
belongs to and the taps that reach its screen; the entries a picture
cannot show are in `guide/no-picture.txt`, each with the reason.
`npm run shots -- <name> <name>` takes only the pictures named, and
`npm run shots -- "<entry title>"` every picture of that entry. It prints a line for each file, and fails on a
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

## Brought back in October (part 344)

The suite was paused from late September until the October audit, and
twelve screens and eleven sheets were added in that time with no case.
Part 344 brought it up to the app:

- **Coverage.** The pages a QR code or a mail opens (`/sds`, a supply
  label, a client's request page and a client's acknowledgement) are
  screen cases with the stub switch each needs. The places under More
  that only some people have, or only once the API has answered
  (Workspace, Field kit, My training, My company property, App support,
  Library, Approve supplies, and an equipment label opened from its
  address), are tab cases marked `own`, each swept in a session of its
  own with its person and switches. The eleven new sheets each have an
  opener and, where it needs one, a phone in `SHEET_PHONES`, whose stub
  switches now join the ones every sheet's phone has.
- **Sheet ids.** A sheet's id is its place among its owner's sheets, so a
  sheet added first in My Schedule (a day's sheet) moved every later id
  up one, and three cases were inspecting the sheet beside the one they
  name. They are renumbered, each keeping its label.
- **More.** `openTab` looks inside More's own sheet (`.sp-more`), since
  Home's week is a grid of seven buttons too and came first; it waits a
  few seconds for a place that shows once the API answers, and Report
  goes by Issues too, as it reads for an admin or a supervisor.
- **Lanes.** The sweep's combinations, its sheets and the journeys run in
  `AUDIT_LANES` lanes side by side (three unless set; `audit/lanes.js`),
  each piece on its own phone and stub. A full run took 26 minutes in
  three lanes.
- **Journeys that fell behind.** A check-off's body has carried its
  `clientId` and time since Step 238; a checklist row's name and each day
  on the week are tap frames; a shift's detail opens from its day's
  sheet; Help's question carries its `requestId`; the lock line shows
  under a locked account; Chat opens on the person's own site chat; the
  toast strip is always in the page as a live region; the form person
  question reads `GET /api/forms/people`; and every page asks the
  language list with no token. Each journey reads the app as it is.
- **Every notice type.** `EVERY_NOTICE` in the stub is one notice of each
  type in the audit contract's section 3, with the link the API builds,
  and the `everynotice` journey taps each on a supervisor's bell: a place
  of its own, Open in the dashboard, or nothing.
- **Weak signal.** The `weak*` journeys put each action a cleaner sends (a
  check-off, an uncheck, Start Shift, End Shift, an issue with and without
  a photo, a form submit, a signature and a time off request) through four
  kinds of trouble: the signal gone as the tap is made, a 500, an answer
  30 seconds late with a second tap (English alone), and the work kept by
  the API while the answer is lost, then tried again. The browser's own
  offline switch never stops a request the harness routes to the stub, so
  the stub's `offline` goes with it. `state.trouble` (`{ method, path,
  kind: "500" | "hold" | "lose", ms }`) gives the next matching call its
  trouble. Each answer goes to the file `AUDIT_WEAK_TABLE` names, one
  JSON line each.
- **Pay.** Every answer of every case is read for a pay figure, and one
  served to anyone without manage_employment is a row of the full suite
  and a failing line of the smoke check (`payRows()` in the stub;
  contract 2.1).
- **Words.** `audit/words.js` reads the words handed to a helper that runs
  `tr()` on them (`fkFaultWords`, `wsFaultWords`, a `head(word)` helper,
  `RequestTarget`'s label), where five lines with no Spanish had gone by.
- **Stub.** Capabilities as the contract's section 1 gives API #146;
  `checklistMode` answered on every read; the acknowledgement page
  (`acknowledge`); the forms people route; a second send of a sent draft
  refused 409; `assignedSites` for a person with none; the walk's safety
  words as twins; and no language asked of a lesson picture an `<img>`
  fetches.

## Round 1 of the fixes (part 348)

Five journeys for Now findings no case asked before, each failing on the
main of part 344 and passing once its fix is in:

- `stalledcheckoff` (PORT-04): a check-off whose send the stub holds for
  a minute is on the phone before it is sent, shows on its box at once,
  reads as no signal after 15 seconds, and goes once by itself after a
  reload.
- `signoutkeeps` (PORT-05): a check-off kept with no signal stays on the
  phone through signing out and through the stub's second person signing
  in, who never sends it, and goes once at its owner's next sign-in.
- `resolvekeeps` (PORT-02): a resolution whose save meets a 500 keeps its
  note and photo, and Submit Resolution again saves it with the photo
  uploaded once.
- `issuephoto` (PORT-01): an issue whose photo attach meets a 500 goes
  once, the screen says the photo did not attach, and Try again attaches
  it to the same issue.
- `guidemore` (PORT-12): every place under More, for a supervisor with
  every switch on, is named in the guide's More entry, and Home's cards
  are named in its Home entry in the order Home draws them.

`pinrules` also tries 1234 on a reset link and on Register (PORT-08).

## Everyone on a shift sees the same list (part 350)

The checklist on screen, and a site's list a supervisor follows from
Home, read themselves again every ten seconds. A coworker's check is the
stub's third person checking a step, pushed into `state.completions`
while the phone holds its list, on a person linked to no step of their
own (`links: {}`), who sees the site's shared list. Each journey fails on
the main of part 348:

- `livecheckoff`: a coworker's check shows within ten seconds, with
  Checked by and their first name.
- `livequeued`: a tap kept on the phone by a 500 still shows on its box,
  and is still on the phone, after the list reads itself again.
- `livescroll`: the scroll position holds across a read.
- `livesamestep`: the coworker checks a step a moment before this phone's
  tap: one check-off, Already done by under the step, and nothing left
  on the phone or said as a failure.
- `livewatch`: a supervisor with no shift opens Task list for this site
  under a site of their own, and a cleaner's check shows on it within
  ten seconds; nothing on it can be checked off.

Rows carry `data-task-row` with their task id, and the followed list's
marks `data-task-done`. A check-off asks the status first, so the weak
check-off journey counts that read on the way to it (`reach`).

## Round 2 (part 355)

The stub answers the routes this round calls the way ocsa-api's main
(49262a3) does: POST /api/issues takes a `clientId` and answers the same
person's repeat with the first issue (200, `issues.reported`), and
another person's with 400 `issues.clientIdInvalid`; Start and End take
the tap's time (`startedAt`, `endedAt`, at most 12 hours old and 2
minutes ahead, else now) and record what they were sent and what they
took in `state.shiftTaps`; GET /api/hr-cases/:id answers a holder of
manage_cases and 403 to anyone else; GET /api/forms/responses/cc-1
answers a holder of view_reports. `API_R2` holds the refusals new since
Round 1 in the API's own words, and `apiR2Body` writes one for
`state.refuse`. The trouble kind `kept500` does the work and answers 500,
the way a proxy's error after the API wrote reaches the phone. The weak
issue actions count records by distinct clientId (`same`), and `queued`
now says which actions go again by themselves. The checklist day turns
at 4:00 AM on the company's wall clock, the way the API's
helpers/checklistDay.js reads it, so on Nov 1 it turns at 4:00 AM too
(PORT-07); before, the stub took four hours of milliseconds off, and the
day turned at 3:00 AM that night.

Six journeys, each failing on the main of part 350 but the last:

- `issueonce`: an issue, with and without a photo, sent again after
  `kept500` makes one issue, both sends carry one clientId, the form
  stays until the API has it, and a report typed differently after a
  failure is its own issue.
- `endshiftqueue`: End Shift with no signal is kept and said, then goes
  by itself once the signal is back, after the check-off waiting before
  it, with the time it was tapped.
- `refusalwords`: each refusal code in the portal's own words, with the
  next step: `auth.givenPinExpired` and `auth.lockedUntilOffice` at
  sign-in, `PIN_WEAK` under Register's PIN box, `auth.checkUnavailable`
  at start and on a send as a notice, `uploads.badBucket`,
  `issues.clientIdInvalid`, `tasks.resolve.alreadySettled`,
  `tasks.resolve.issueClosed` and `pickups.onLeave`.
- `noticeplaces`: a support_ticket, periodic_overdue, customer_concern
  and hr_case notice each open their place from the bell, from a phone
  alert on an open app, and from `?open=` at start.
- `casesheet`: the case sheet opens read only for a supervisor, and a
  cleaner never sees it or reads the case, from the bell or a phone
  alert.
- `nomoney`: a supervisor and an admin go through the bar, More and the
  field kit's tiles, and no dollar figure or cost shows or is kept on the
  phone. The admin's supplies carry `cost_per_unit` from the stub, as the
  API sends it to a holder of manage_employment. The portal never showed
  money, so this one holds on main too; it stays as a guard.

The case sheet and the concern sheet share `ReadSheet`, whose case in
the screen sweep opens a case from its phone alert.

## The three items that waited on the API (part 356)

The stub answers what ocsa-api's part 354 adds for the portal: the status
carries `shift.othersOnShift` from `state.othersOnShift` (null answers no
key, as for someone with no session open at the site); a check of a step
on the site's shared list that somebody else checked today, with none of
the person's own, is 409 `tasks.alreadyChecked` with their `firstName`
and writes nothing; and GET /api/sites/:id/tasks/changed?since= answers
`{ changed, at }` from `state.listChanges`, which the stub's own
check-off and uncheck add to and a case adds to with `stub.noteChange`
(`coworkerChecks` does). `at` is an instant with microseconds, or null
when nothing changed; a since that is not an instant with its zone is
400 `tasks.sinceInvalid`. Tap times are kept 72 hours back and never
ahead, against the stub's running clock (`runningNow`), which starts
before the phone's. `API_R3` holds the two new refusals in the API's
words.

Six journeys, each failing on the main of part 355:

- `alsohere`: Also here names a coworker on shift, then a second one once
  a check makes the list and the status be read again; nothing shows with
  nobody else, or with no `othersOnShift` key.
- `alreadychecked`: a check answered 409 shows Already done by with the
  coworker's name on the row, leaves nothing on the phone and is never
  sent again, with no failure said.
- `nostatusfirst`: no status read goes before a check-off.
- `changedlive`: a coworker's check shows within 5 seconds, through a
  cheap check that asked before the list was read.
- `changedquiet`: with nothing changed, a minute passes with no full list
  read and no status read, and 12 to 16 cheap checks.
- `sinceinvalid`: a cheap check refused 400 falls back to the whole list
  every 10 seconds, and goes back to the cheap check once it answers.

`livequeued` now has a coworker check another step so the list is read
again, since nothing else changes it, and the weak check-off journey no
longer counts a status read on the way to the check.

## The API findings that need the staff app (part 359)

The stub answers what ocsa-api's main (af63dca, its Round 3, part 357)
answers on the routes this part calls. GET /api/hr-cases/mine answers
`state.myCases` (two invented reports unless a case gives `myCases`),
id, status and the two stamps, as reporterView writes them; a case filed
from Speak Up joins it. GET /api/forms/responses/fr-1 is a filed report
for a holder of `view_reports` and 404 `forms.reportNotFound` to anyone
else, and `EVERY_NOTICE` carries its `form` notice and an
`hr_case_opened_for` one, the shape finding API-63 asks for. Register is
409 `auth.accountExists` for a phone (its digits) or an email already on
an account (the person, the staff list, `takenAccounts`), else 201
`auth.registered`. A drop is kept in `state.drops` and listed under
`pendingDrops` while it waits; a second one for the same shift is 409
`pickups.alreadyPosted` with `openShiftId` and `status`. A second Start
Shift at the site already open is 200 `sessions.alreadyOpen` with the
session and its tasks. The issue sheet answers an issue's `photos` as a
case sets them, and `midnightDates` answers the birthday and the
schedule's days as that day at midnight UTC, as the API's date columns
leave it. `API_R4` holds the API's words for the new answers, and
`apiR4Body` makes a body for `state.refuse`. A case can open the phone in
another zone with `timezoneId`.

Ten journeys. Five fail on the main of part 356 (62 rows in all):

- `myreports`: My reports on Speak Up lists the person's reports with the
  day and where each stands in plain words, says when there is none or
  the list did not load, and an `hr_case_opened_for` notice opens it with
  that report marked, from the bell and from a phone alert.
- `filedreport`: a `form` notice opens the filed report read only for a
  reader of it, from the bell and from a phone alert; anyone else keeps
  Open in the dashboard, and a report the API hides opens the bell and is
  not asked for again.
- `registerwords`: a registration sent says what happens next in words
  that hold whatever the API found; a phone or email already on an
  account is said under the email box, the form kept.
- `addressguard`: a photo address that is javascript:, a data: page or a
  // address is never drawn or linked on the issue sheet, a signed https
  one is, whole, and a notice whose link is javascript: offers no
  dashboard.
- `newrefusals`: `pickups.alreadyPosted` after a lost answer and for a
  shift the office posted, `common.bodyTooLarge`, `common.badBody` (400
  and 415), `uploads.tooLarge` with and without `maxBytes` (said in
  megabytes), `forms.photoLimit` with the question's own limit,
  `forms.photoNotFound` with the photos read again, and
  `sessions.alreadyOpen` read as success (its rows pass on main too).

Five pass on main and stay as guards, since main already does what the
finding asks of the staff app: `deviceid` (API-55), `tokenexpired`
(API-56), `shiftnotices` (API-62), `codestaff` (API-85) and `datedays`
(API-96, a phone in Honolulu and one in Tokyo).

## The staff app's own findings (part 367)

Fifteen of the October audit's Before 100 findings, the ones that need
nothing new from the API and no decision from the owner. The stub answers
the routes they call the way ocsa-api's main (a1e7e58) does: PATCH
/api/issues/:id takes a resolution's `photoUrl` beside `status` resolved,
as Step 298 built it, and refuses one with anything else, 400
`issues.badDetails` with keys `["photoUrl"]`; POST /api/issues/:id/photos
keeps a photo on the issue sheet's issues; POST
/api/notifications/:id/read stamps `readAt` once and read-all stamps
every notice, so the count read after them is lower; and a photo sent
whole to /api/uploads (an issue's, a resolution's) reaches the stub as
its bytes, its size, kind and width and height on the call's record as
`files`. `openApp(browser, base, { iosAlerts: "fresh" })` opens a phone
that has not yet told its iPhone browser tab why it gets no alerts; every
other case is seeded as told, the way the install sheet is dismissed,
since the suite's phone is an iPhone browser tab.

Fifteen journeys, one for each finding, each failing on the main of part
359 and passing here, in English and Spanish:

- `profilechanged` (PORT-18): Save sends only what changed, never
  personalNotes, and nothing when nothing changed.
- `sheetphoto` (PORT-19): the issue sheet's resolve with no task for it
  carries its photo on the PATCH, never reads resolved without it, and a
  save that fails keeps the note and photo, uploaded once.
- `workkept` (PORT-20): an issue being reported (sent again after a lost
  answer and a reload as one issue), a resolution on Assigned and on an
  issue's sheet, a Help question, an App support ticket and profile edits
  come back after a reload.
- `formleave` (PORT-21): Leave whose save fails stays and says so; the
  bottom bar under a form asks first and leaves once the page saved.
- `formroom` (PORT-22): Next and Back at the Largest size on a 375 by 667
  phone sit above the bar once scrolled to, and a tap reaches them. The
  three `covered` entries for the site walk came off known.json.
- `droponce` (PORT-23): a drop request tapped three times goes once.
- `nightoverdue` (PORT-24): East Building's evening critical block reads
  Overdue at 12:30 AM and its morning one at 3:30 AM.
- `statusfault` (PORT-25): a status read refused at sign-in says Your
  shift did not load, with Try again, and no Start Shift.
- `timeofffault` (PORT-26): the leave types and My time off failing each
  say so, never No time off requests yet.
- `issuephotosize` (PORT-27): a 4000 by 3000 photo and a HEIC go as JPEGs
  of 2000 pixels at most, on Report and on Assigned.
- `workerwaits` (PORT-28): the build's service worker, run in a sandbox of
  its own, answers the page and a file from what it keeps within about
  four seconds of a network that never answers, and for a 503.
- `noticesaid` (PORT-29): a new notice is said, the bell is read again
  when the app comes back, an iPhone browser tab is told once why it gets
  no alerts, an older iPhone to update, and the install sheet says so.
- `trainingcold` (PORT-30): a training notice on a phone just opened
  opens My training with its fault and Try again.
- `failurestays` (PORT-33): a failure's toast stays past three seconds
  with Close.
- `alertread` (PORT-34): a phone alert tapped marks its notice read.

The smoke check's cleaner opens a form and then taps Help on the bar,
which now asks before leaving the form; it answers Leave.

## What Round 5 built for the staff app (part 369, section 1)

The stub answers what ocsa-api's main (ca4aafa, Rounds 5 and 6) answers
the staff app: POST /api/auth/renew hands back `{ token }`, the token a
case names in `renewTo` ("token-one" unless it names another), and a
case's refuse gives it 401 `auth.tokenExpired` or 503
`auth.checkUnavailable`; GET /api/settings answers `checklistDayStartsAt`,
"04:00" unless a case names `dayStartsAt`; POST /api/auth/register
answers a phone or email already on file with the same 201
`auth.registered` and an invented id, writing nothing. EVERY_NOTICE
carries `shift_changed` and `shift_cancelled` (subject the shift) and
`hr_case_closed_for` (subject the case), each linked to the staff app's
`/?open=<type>:<id>` as linkByReader builds it.

Seven journeys, in English and Spanish:

- `renewopen` (API-56): a kept session is renewed before anything else
  is read, the new token carried on every call after it and kept; a
  renewal answered 401 brings sign-in back; one that cannot be reached
  opens the app on the kept token.
- `renewqueued` (API-56): a check-off kept with no signal goes after a
  renewal, under the new token.
- `shiftat` (API-62): shift_changed opens My Schedule at the shift's week
  with its sheet open, and shift_cancelled says the shift is no longer
  on the schedule, from the bell and both kinds of phone alert.
- `casedone` (API-63): hr_case_closed_for opens My reports at the
  report, never reading the office's case.
- `filedlink` (API-83): a form notice whose link is the staff app's opens
  the report with Close alone, and offers a person who reads no report
  no dashboard.
- `tasknotes` (API-68): the resolution box holds 2000 characters, and
  `tasks.noteInvalid` and `tasks.photoUrlInvalid` are said in plain words.
- `daystart` (PORT-24): with a 6:00 AM day start from the settings, the
  evening's critical block still reads Overdue at 5:00 AM.

`registerwords` now expects the 201 for a taken phone or email: the same
thank-you, nothing under the email box, and the `register-taken` picture
is gone with the line it showed.

## Building maintenance from the field (part 369, section 2)

The stub answers `/api/maintenance-requests` the way routes/maintenance.js
does at ocsa-api's main (part 365): every route behind
`file_maintenance_requests` (admins and supervisors, or a person whose
fixture carries `fileMaintenance: true`); `/options`; the list per site,
newest first, with `ageDays`, `responseDueOn` and `noResponse` worked out
on the New York day and two business days; one request with its
recipients, email, photos, log, `allowedStatuses`, `canFollowUp` and
`canResend`; `POST /` as JSON or multipart (photos under `photos`, the
fields beside them, recorded on the call as `files` and `fields`), with
the API's refusals in order (`maintenance.badDetails` with keys,
`issues.notFound`, `maintenance.issueAlreadySent`, `maintenance.noContact`,
`maintenance.photoLimit`); `/from-issue/:issueId`; `POST /:id/log`,
`/follow-up` and `/resend`; and `/api/sites/:siteId/maintenance-contacts`.
North Building holds MR-2026-0001 (sent, unanswered past its two business
days) and MR-2026-0002 (scheduled, with a photo and a log), a desk for
every building and an engineer for the Annex; South Building has no
contact. `maintEmailFails` makes a filing's email not go, and
`maintLoseNext: n` files the next n requests and drops their answers on
the way back. GET /api/issues/:id carries `maintenanceRequests`, and
EVERY_NOTICE `maintenance_status` and `maintenance_no_response`.

Four journeys, in English and Spanish:

- `maintfile`: the field kit's Building maintenance lists the site's
  requests with status and age; a request with two photos, its recipients
  shown, sent with no signal waits on the phone and is filed once, as one
  multipart filing, when the signal comes back; a send whose answer was
  lost is found on the site's list and never filed twice; South Building's
  form says it has no contact and keeps Send off.
- `maintissue`: an issue's sheet offers Send to building maintenance, the
  form is prefilled from the issue with its photo to send, the request
  carries `issueId` and `issuePhotoIds`, and the sheet then shows it sent;
  someone without the capability is never offered it.
- `maintsheet`: one request's sheet with its log; Record a response and
  Change the status to Fixed through `POST /:id/log`; a request past its
  answer day says so.
- `maintnotices`: both notices open the request's sheet three ways, and
  never for someone without the capability.

## My leave balances (part 369, section 3)

The stub answers GET /api/leave/me the way routes/leave.js does at
ocsa-api's main (part 365), for the handbook's policy: paid sick leave,
tracked, 40 hours unless a case names `leaveBalance`, eight hours a day,
the policy's own line for it, and `usableFrom` when a case names
`leaveUsableFrom` (a new hire in the waiting period). `leaveNone: true` is
a policy that tracks no kind, and `leaveRoute: false` an API with no
route. POST /api/time-off and GET /api/time-off/:id carry `leave` as
helpers/leaveBalances.js requestLeave builds it: the request's hours (its
own, a part day's, or eight a day), what a pending one would leave, the
`leave.warning.belowZero` and `leave.warning.inWaitingPeriod` warnings in
the API's words, `taken` once approved, and `givenBack` for a fixture row
whose approval the office took back.

Three journeys, in English and Spanish:

- `leaveshown`: My time off lists paid sick leave in hours and days with
  its policy line; nothing for a policy that tracks none or an API with no
  route; a read that failed says so with Try again.
- `leaveform`: the form shows the picked kind's balance; once sent, the
  request's sheet says what it would leave, with the below-zero warning,
  and the waiting period's for a new hire; each request is sent once.
- `leavesheet`: an approved request says the hours it took, one taken back
  the hours given back, and the time_off notice opens that request three
  ways.

## What API Round 8 gave the staff app (part 373, section 1)

The stub answers what ocsa-api's main (c5b88ff, Round 8, part 371)
answers the staff app. POST /api/maintenance-requests reads `clientId`
(8 to 64 of `A-Za-z0-9_-`, else 400 `maintenance.badDetails` keys
`clientId`), keeps it on the request, answers a new filing 201 with
`repeat: false`, and the same clientId again from the same filer 200
`{ request, email, repeat: true }` with the first request, filing
nothing. GET /api/sites/:siteId/maintenance-contacts with `building=`
(blank meaning none) adds `recipients`, the filing's own pick, and `cc`,
the office's address (`office-copy@example.invalid` unless a case names
`maintCc`). POST /api/time-off/preview answers `{ leave }` the way the
filing would carry it and files nothing; `previewRoute: false` is an
API without it. GET /api/pickups/my-schedule/:shiftId answers one of
the person's shifts from the schedule, or from `cancelledShifts`, else
404 `shifts.notFound`; the stub's invented ids are read as they are,
where the API also answers 404 for an id that is not a uuid. GET
/api/pickups/my-schedule now holds only the days asked for, as the API
reads start_date and end_date. EVERY_NOTICE's shift_changed and
shift_cancelled carry their day as `subjectKey`.

Five journeys, in English and Spanish, each failing on the main of part
369:

- `maintrepeat`: every filing carries the phone's clientId, as JSON and
  as a multipart field; a send whose answer was lost goes again with the
  same clientId, the repeat reads as the request filed, no list is read
  first and one request is filed. `maintfile` no longer checks a lost
  answer.
- `maintgoesto`: It goes to is read from the contacts route with the
  building typed, read again when it changes, with the office's copy;
  with no signal the kept answer for that building, or the line that it
  shows once there is signal with Send still on; and from an issue the
  same route for the issue's site.
- `leavepreview`: what a request would leave shows before Send, from the
  preview with the request's body, with the API's warning, read again
  when the days change; a refusal is said before Send; nothing is filed
  until Send; an API with no preview keeps the line that it shows once
  sent.
- `shiftday`: shift_changed with its day opens that week, sixteen weeks
  ahead, and the shift read by its id with its sheet; shift_cancelled
  answered 404, and a shift answered cancelled, say the shift on that day
  is no longer on the schedule; from the bell and both kinds of alert.
- `alertown`: the build's service worker passes the alert's subjectKey
  and notificationId to an open app and in the address of one it opens,
  and the app marks that notice alone read.

## Pictures that come back by themselves (part 373, section 2)

Since ocsa-api part 370 a photo in issue-photos, task-media or
profile-photos is a link signed for 60 minutes. The stub signs every
stored `<bucket>/<path>` under the API's photo keys (`photoUrl`,
`media_url`, `photo_urls` and the rest, and the `url` of an item of
`photos` or `issuePhotos`) as it answers, at
`signed-photos.example.invalid`, a host of its own (the lesson pictures
keep theirs), with a token that runs out an hour later on the stub's
clock. The
browser hands those fetches to `stub.photo`: the picture while the link
lives, storage's 400 (`InvalidJWT`, the exp claim) once it ran out, and
nothing with no signal; each fetch is kept in `state.photoFetches`. A
case's `photoStale` names routes whose next answers sign their links
already run out, as if read an hour ago, and `taskMedia` gives a site's
checklist step a reference photo. Every older fixture's photo is an
outside address and is answered as it is.

One journey, in English and Spanish, failing on the main of part 369:

- `photoreload`: an issue sheet's photo whose link ran out reads the
  issue again once and draws the fresh link, its own link fresh too; the
  same on a maintenance request from the issue; a fresh link that fails
  too is a quiet box with no third read; the header's photo reads the
  profile again; a checklist step's reference photo on the copy kept on
  the phone, an hour later with no signal, waits and draws the fresh link
  once the signal is back; and an outside address is never read again.

Where a picture is drawn that this does not cover: a photo taken on an
inspection walk and not yet sent, and the walk kept on the phone, is
drawn from the link its upload answered, and the API has no record to
read again until the inspection is sent (it still sends by that link);
Help's photos are the phone's own copies; a form's photos, a maintenance
request's photos and a signature are read behind the token and never
run out; a lesson's pictures are links of their own, signed for twelve
hours, which the lesson already says are missing when they do not load.

## A Help gap from support tickets (part 373, section 3)

Support tickets asked how to fill out an inspection from the staff app.
The guide already held Do an inspection assigned to you, long, with the
safety walk; Fill out an inspection, the guide's last entry, is the short
how-to, with two pictures of steps the older pictures do not show: a card
scored low with Needs a fix and its note (`inspection-fill-card`), and
the signature with Submit Inspection (`inspection-fill-send`), both on
the stub's inspection with no safety walk.

One journey, in English and Spanish, failing on the main of part 369,
where the entry is not there:

- `inspectguide`: the entry is the guide's last, names its two pictures,
  each taken in both languages, and carries the words people ask with;
  every name its steps give is on the screens those steps walk through
  in the screen's language: More, Inspect with Start an inspection, an
  inspection with the safety walk, and one without, a card scored 3 of 5
  with Needs a fix, sent with no note, then with no signature, then
  signed and sent, to Done.

## The shift's own checklist (part 375, section 1)

The stub answers what ocsa-api's main (481723b, Round 9, part 374)
answers the staff app about named shifts. Behind `namedShifts`, North
Building names three shifts, Day shift 7:00 AM to 3:00 PM, Evening shift
3:00 PM to 11:00 PM and Night shift 11:00 PM to 7:00 AM, each with its
Spanish and French, as `helpers/shiftRuns.js` reads `site_shifts`. A
session joins a run: Start Shift's `shiftLabel` when one is sent (a
label the site does not have is 400 `sessions.shiftInvalid`), else the
shift starting within 30 minutes, else the one running (the stub holds
no schedule to match by its times); a session open from the start is in
the run its start picks, or the one `sessionRun` names. PATCH
/api/shift-sessions/:id/shift moves it to that shift's current run. A
check-off carries its session's run; a seeded check with none is read in
the run whose hours hold it. At a site with named shifts a daily item
(frequency daily, as its block makes it) counts only the checks of the
same run on the ring, `checkedToday`, the task read and the refusals
`tasks.alreadyChecked` and `NOT_YOUR_CHECK`, and a check of it in a new
run is answered 201. The status (at its top and on its session), every
session answer and every row of GET /api/sites/:id/tasks carry
`shiftRun` (`{ label, display, startsAt, endsAt, runDate }`, null with
none); every row carries `doneEarlier` (`{ at, shiftLabel, firstName }`,
the latest check of a daily item before the run began, within 24 hours,
else null) and `shiftLabels` (null); every session answer carries
`endNote` (null: a person ends a session in the stub). GET
/api/sites/:siteId/shifts answers `{ shifts }` as the API's shiftView
does, [] at a site with none.

Four journeys, in English and Spanish, each failing on the main of part
373:

- `shiftrunline`: the top of the checklist reads Evening shift, 3:00 PM
  to 11:00 PM, the shift's own name in the person's language and its
  hours on the company's clock; a site with no named shifts reads no run.
- `shiftearlier`: a daily item the day shift checked at 2:40 PM reads
  Day shift did this at 2:40 PM in a small grey line, its box open and
  off the ring; checking it again is taken (201) and the line goes.
- `shiftfresh`: a tap still waiting goes before a change of shift, in
  the run it was made in; one that cannot go is dropped with its run and
  never sent into the next; the night shift's list reads open and says
  it is the night shift's; the copy kept for no signal is kept under the
  new run alone and opens with no signal without the last run's ticks;
  and a tap kept from an earlier session's run is never drawn on the new
  run's list, still waiting to go, since the API files a tap sent late
  in the session open when it was made.
- `shiftpicked`: Start Shift sends no shift; the sheet offers the site's
  named shifts from GET /api/sites/:siteId/shifts with their hours, the
  API's pick already chosen and said to be picked; one tap on Use this
  shift keeps it with nothing sent, and choosing another goes through
  the change of shift.

What the staff app cannot show yet: a session the API closed. The
status answers no session once one is closed, GET
/api/shift-sessions/today answers the open one alone, and End Shift's
409 `SESSION_ALREADY_ENDED` carries no session, so `endNote` reaches the
phone on no answer it reads. The portal says it the moment one does
(`sessionEndLine`), and the pull request lists what it waits on.

## Training answers from API Round 9 (part 375, section 2)

The stub's lesson routes answer as ocsa-api's main (481723b) does.
Answers sent to an attempt already scored or void are 409
`training.attemptClosed` with `{ attempt }` as it stands. An
acknowledgement sent again to an attempt already acknowledged, and not
void, answers 200 with the attempt and its record, as the first did;
`ackNotStored: n` answers the next n acknowledgements 503
`training.signatureNotStored`, nothing stamped; `ackLoseNext` and
`answersLoseNext` take the next send and lose its answer on the way
back. Both refusals carry the API's own words in English and Spanish,
from its `translation/api_words.csv`. Every attempt answered carries
`attemptsLeft`, and a new attempt's number is one past every attempt of
the person's on the version, voided ones included;
`trainingVoided: n` voids n attempts on the ladders lesson numbered from
101, as the office moved them live, so the next one is 104.

Three journeys, in English and Spanish, each failing on the main of part
373:

- `quizclosed`: Submit tapped twice at once sends once; a send whose
  answer was lost, sent again, meets the closed quiz, and the screen
  shows that attempt's result, passed and ready to sign, under the API's
  words, with the questions taking no more taps.
- `signagain`: Sign tapped twice at once sends once; a signature storage
  could not take reads the API's words with the box kept and emptied, so
  the person signs again; a signature whose answer was lost, sent again,
  is answered 200 and reads as done.
- `triesused`: My training and a lesson's result read the tries used and
  the tries left, and no attempt number shows, though three voided
  attempts pushed the next one to 104.

## Help for the shift's own list and a warning's email (part 375, section 3)

The guide's Check off a task on your checklist says the list is the
shift's list, what the last shift's grey line means, that the overnight
list stays one list from start to end, and that Start Shift asks which
shift once with the person's already picked. Sign for something you
received says a signed copy of a warning comes by email and that the
email's button opens the signing screen, signing in first. The training
entries the lesson's changes touch (See your training, Take a training
lesson, Find and take your trainings) read the tries used, the closed
quiz and a signature to sign again, and Check off tasks with no signal
says the phone keeps the shift's list only. The `tasks` picture is taken
at North Building with named shifts, so it shows the evening shift's
line and the day shift's grey line; every picture of the five entries
was taken again in English and Spanish.

One journey, in English and Spanish, failing on the main of part 373:

- `shiftguide`: the entries say each of those things, the checklist
  entry names Start Shift, the sheet with the pick, Use this shift,
  Change shift, Tasks and the last shift's line, and each is on the
  screens those steps walk through in the screen's language; and
  /sign/<id>, the email's button, signed out, signs in first and opens
  the request.

## Seven findings field staff meet first (part 375, section 4)

Seven of the October audit's open findings (`audit/FINDINGS_2026-10.md`)
whose first reader is field staff on a phone, each needing nothing new
from the API: PORT-36, PORT-53, PORT-54, PORT-60, PORT-62, PORT-65 and
PORT-66. The rest stay open. `rowsCarryDay` gives every row of the task
read its `checklistDay`, as the API's has since Step 198; the cases
written before it read as they did.

Five journeys, in English and Spanish, each failing on the main of part
373:

- `uncheckoffer` (PORT-62): the detail of an item a coworker checked
  today says only they can uncheck it and who did, with no Uncheck Task
  and nothing sent.
- `assignedonce` (PORT-60, PORT-65, PORT-66): In Progress and Cannot
  Resolve tapped twice at once send once; Cannot Resolve says it went up
  with the reason; a problem an inspection card filed reads Inspection
  finding: Lobby in the person's language.
- `chatfault` (PORT-54): a chat whose messages did not load says so with
  Try again, and Try again reads it.
- `startinview` (PORT-36): at the Largest size on a 375 by 667 phone,
  tapping a site brings Start Shift above the bottom bar, where a tap
  reaches it.
- `dayturn` (PORT-53): a list read at 3:58 AM is read again with the
  status once the phone comes back after 4:00 AM, and it is the new
  day's.

## Photos that stay good until they are saved (part 380, section 1)

Since ocsa-api Round 10 (part 376, #159, `routes/uploads.js`) an upload
to task-media, issue-photos or profile-photos answers `path`,
`<bucket>/<object>`, beside a link signed for 60 minutes, and records who
stored it; `POST /api/uploads/sign { path }` answers `{ url }`, a fresh
link, to that person alone within 30 days. The stub answers both as the
API does: the object named `<prefix>-<time>-<random>.<ext>` (task, issue
or profile), the link signed at `signed-photos.example.invalid` for an
hour on the stub's clock, the owner kept in `state.photoOwners`, each
sign asked in `state.photoSigns`, 400 `uploads.badDetails` for a body
that is not one path and 404 `uploads.pathNotFound` for anyone else's,
an unknown or older one, another bucket's, or one a case names in
`photoLost`, in the API's own words. Help's agent-photos keeps the
answer it had.

Two journeys, in English and Spanish, each failing on the main of part
375:

- `photokept`: a walk with no safety walk is kept on the phone as it is
  scored, its photo with the path beside the link; an hour later, the
  link run out at the stub and the phone's copy an hour older, the walk
  reopens as it was scored and its photo is signed again by its path,
  one read, and drawn from the fresh link; what the completion sends is
  the path; and once sent the walk is no longer kept.
- `phototurnedoff`: a walk scored with the safety walk on, which the
  office turned off since, comes back as it was scored; its photo, past
  what the API signs again, says "This photo can no longer be shown.
  Take it again." with Take it again, which puts it away for a new one.

`inspectionfixes` now reads the finding's photo by the path its upload
answered.

## The safety walk once a month (part 380, section 2)

The stub's `GET /api/inspections/scheduled` is answered as
`routes/inspections.js` builds it: `?site_id=` keeps one site's, `?status=`
is matched exactly, and with no status every row comes, the done ones
with their `result_id` and no time. A done one's own read answers its
`result` with `completed_at` and `safety_response_id`, as the case's row
carries them. `POST /api/forms/drafts/draft-safety/discard` puts the
walk's own safety draft away, as the API voids any draft of the caller's,
and a completion with no `safety` and no draft then takes the cards
alone, as `readForSubmit` does.

Two journeys, in English and Spanish, each failing on the main of part
375:

- `safetymonth`: Start an inspection at North Building, whose readiness
  check filed the safety walk at 10:42 AM today, starts the switch off
  with "Safety walk done this month on Oct 1", read from the site's list
  and the done one's result; the person can still turn it on; South
  Building, with none, starts it on with "Safety walk due this month",
  and the start sends the switch as it stands; a second start at South,
  while the first carries the safety walk, starts it off and names it;
  with the list refused, West Building starts it off with "Safety walk:
  once a month per site".
- `safetyonce`: the monthly walk at North, with its own safety draft
  already started, says "Safety walk done on Invented readiness check at
  10:42 AM", draws no safety part and starts none, puts its draft away
  before it is sent, and is sent with no `safety`; the stub takes the
  cards alone.

The Spanish check now lets a fit whose filling names a word the API
sends in English win over an earlier fit that read as stray, so the
Spanish line around the inspection's English name reads as that known
word.

## The test site (part 380, section 3)

`testSite` gives the stub the robot's test site, "Invented Test
Building", as API Round 10 answers it: on `GET /api/sites` to an admin or
a supervisor, whose rows now carry every column with `is_test` (false on
the rest), and on the field kit's `GET /api/forms/my-sites`, which
answers id and name only, so no `is_test`. Anyone else's `GET /api/sites`
is their own sites' base columns, with no `is_test`, as the API's are. No
stub answer says the person is a test account, since no API answer does;
a case's person may carry `isTestAccount`, the shape asked for under
Waiting on the API.

One journey, in English and Spanish, failing on the main of part 375:

- `testsite`: a supervisor's Start an inspection, + Schedule and the field
  kit's sites list the three real sites and never the test site; a person
  whose answer says `isTestAccount` sees it on Start an inspection as
  "[TEST] Invented Test Building".

## Five findings field staff and supervisors meet first (part 380, section 4)

Five of the October audit's open findings (`audit/FINDINGS_2026-10.md`)
whose first reader is field staff on a phone or a supervisor, each
needing nothing new from the API: PORT-56, PORT-57, PORT-58, PORT-59 and
PORT-67. The rest stay open. A case may now open a phone with
`serviceWorkers: "block"` (`audit/browser.js`), since the worker passes a
request for one of the app's own files on out of the harness's reach.

Five journeys, in English and Spanish, each failing on the main of part
375:

- `photoroom` (PORT-59): four photos picked for a form's question that
  holds three send three, keep them and say the limit.
- `heicoffline` (PORT-58): a HEIC picked with no signal, on a phone with
  no worker and the converter's piece refused, says it needs signal to
  be made ready, or to choose a JPEG.
- `profileready` (PORT-56): a HEIC profile photo is made a JPEG, sent once
  and saved as the profile's photo. `profilephoto` now reads the words
  every photo says when it cannot be read.
- `updatekeeps` (PORT-57): on a phone with no worker, so what is left is
  what the reload left (a live worker writes its shell again as the page
  answers), the reload for a newer build clears an older build's cache
  and keeps the worker's shell, `ocsa-shell-v2`.
- `schedheight` (PORT-67): Schedule Inspection at the Largest size on a
  375 by 560 phone keeps its top and title on the screen.

## A certificate from an outside course (part 383, section 1)

Since ocsa-api Round 11 (part 378, #161, `routes/training.js`) every
item of `GET /api/training/me` answers `outsideCourse`, and `POST
/api/training/certificates` takes the person's own certificate,
multipart: `file`, `topicId`, `completedDate` and `siteId` for a
per-site topic, answered `201 { record }`. Live marks no topic yet, so
`outsideCourse` marks the stub's invented mandated reporter course
(`OUTSIDE_TOPIC`, tp-5). The route reads in the API's order: the file's
size (10 MB, `training.fileTooLarge`), the fields (400
`training.badDetails` with keys, the day no later than today on the
company's clock), the topic (404 `training.topicNotFound`), whether it is
an outside course (409 `training.notOutsideCourse`), a per-site topic's
`siteId`, then the file's kind from its first bytes (PDF, JPEG, PNG or a
HEIC, else 400 `training.badFile`), every refusal in the API's own words.
What it took is kept in `state.certificates`, and the item then reads
current with the record first. `certificateFault` names a refusal the
route answers once.

Two journeys, in English and Spanish, each failing on the main of part
380:

- `certificate`: the outside course offers Upload your certificate and
  says to upload it here; Send with nothing chosen asks for the file and
  the day and sends nothing; an iPhone HEIC is made a JPEG; the API's
  `training.badDetails` reads under the day; Send tapped twice at once
  sends once; the screen says the certificate is in and the item reads
  done, read again from the API.
- `certpdf`: a PDF goes as it is, and `training.notOutsideCourse` reads
  above the button with the form kept.

The Spanish check of these two looks at the upload and the line under
it, since each row of My training carries its document code and
section as the API sends them.

## The shift's own list, as the API now answers it (part 383, section 2)

The stub answers ocsa-api Round 11's six shapes for the staff app (part
378, its 6.1 to 6.6):

- At a site with named shifts every session answer's `shifts` are the
  named ones in order (`helpers/siteShifts.js shiftFieldsFor`): `label`,
  `displayLabel` in the language asked, `suggested` the session's run's
  shift, `window` `{ opensAt, startsAt, endsAt, crossesMidnight }` on the
  company's clock and the blocks of the shift of that label; a site with
  blocks and no named shifts answers as before.
- `doneEarlier` carries `display`, the shift's name in the language asked.
- With no open session the status answers `lastSession` `{ id, siteName,
  startedAt, endedAt, endNote }` for one ended in the last 24 hours, and
  End Shift's 409 `SESSION_ALREADY_ENDED` carries `session`; the end note
  of one the API closed itself is `sessions.closedAutomatically` in the
  language asked (`CLOSED_NOTE`). `lastSession: "closed"` seeds one the API
  closed two hours before at North Building; an End Shift that goes
  through is the next one.
- Every attempt answer carries `attemptsUsed` beside `attemptsLeft`.
- A run has an id (`runIdOf`, made from its key), which no read answers;
  a check-off answers `completion.shift_run_id`, as the API's does. A
  check naming `shiftRunId` other than the session's run is taken when
  the run is the session's site's, the session started before it ended
  and the tap's own time falls from 30 minutes before its start to its
  end, else 400 `tasks.badShiftRun` keys `["shiftRunId"]` in the API's
  words; `badShiftRun` refuses that many whatever they name.

Five journeys, in English and Spanish, each failing on the main of part
380:

- `shiftnamed` (6.1, 6.2): Start Shift's sheet offers the named shifts as
  the session answers them, the API's pick chosen and each one's hours,
  with no read of `GET /api/sites/:siteId/shifts`; the last shift's line
  names it as `doneEarlier.display` gives it.
- `lastsession` (6.3, 6.4): Home with no shift open says where the last
  shift ended and when, with the API's note in the person's language;
  End Shift on a session the API closed says it already ended and when,
  with its note, and Home then says so too.
- `triesanswer` (6.5): a failed quiz reads tries used and left off the
  attempt, with no second read of the lesson.
- `taprun` (6.6): the run's id comes from the first check the API takes;
  a check made after it and kept with no signal across a change of shift
  stays on the phone with its run, goes after the change with
  `shiftRunId`, and lands in the evening run; the night shift's list
  reads it open.
- `taprunrefused` (6.6): the same tap refused `tasks.badShiftRun` goes once
  more without the run, the same clientId, and lands in the session's run.

`shiftfresh` now reads this rule: the tap that could not go before the
change is kept with the run it was made in, where part 375 dropped it.

## The safety walk from the API (part 383, section 3)

The stub answers ocsa-api Round 11's safety walk (part 378, its 8):
`GET /api/inspections/safety-walks?siteId=` answers `{ siteId, lastWalk }`,
the newest OCSA-FRM-015 filed at the site as `helpers/inspectionSafety.js
lastWalk` reads it (`{ at, day, scheduledInspectionId, responseId,
thisMonth }`, `thisMonth` on the company's clock), from a done inspection's
result or from one filed on its own (`walkAlone`), and every read of one
inspection answers the same as `lastSafetyWalk`. `POST
/api/inspections/scheduled/:id/drop-safety` turns an open inspection's
safety walk off and voids its walk draft, kept in `state.drops`, and
refuses in the API's words (`DROP_REFUSALS`): 403
`access.insufficientPermissions`, 409 `inspections.completedLocked`,
`inspections.noSafetyPart`, and `inspections.safetyWalkNotDone` with
`lastWalk`. `dropFault` answers one refusal once; `safetyWalkNotDone`
comes with the site's walk voided since, so every read after it agrees.

Two journeys, in English and Spanish, each failing on the main of part
380:

- `safetyalone`: a walk filed at North Building with no inspection starts
  Start an inspection's switch off, saying the day, and an open walk
  there stops asking for it, says the day, and gives it up through
  `drop-safety` before it is sent without it.
- `safetydropped`: a give-up refused `inspections.safetyWalkNotDone` says
  the API's words, sends nothing more, and opens the walk again asking
  for its safety part, as it was scored; one refused
  `inspections.completedLocked` says the API's words and closes.

`safetymonth` now reads the site's last walk from `safety-walks`, with no
read of the done inspection; with that read refused, West Building reads
the rule. `safetyonce` now gives the walk up through `drop-safety`, which
voids its draft, where part 380 put the draft away itself.

## The owner picker in groups (part 383, section 4)

The stub's `owners` on `GET /api/inspections/scheduled/:id` carry `group`
as ocsa-api Round 11 answers them (part 378, its 7,
`helpers/inspectionFindings.js ownersFor`): `assigned`, `recent` or
`everyone`, in that order, with one invented person added to the recent
group and one to everyone else.

One journey, in English and Spanish, failing on the main of part 380:

- `ownergroups`: a card that opens a finding draws its owners under Works
  at this site, Worked here in the last 30 days and Everyone else, in
  that order, each with its people; a search keeps only the groups with a
  match and runs across all three; a pick from any group is the chosen
  owner.

## Three findings field staff and supervisors meet first (part 383, section 5)

Three of the October audit's open findings (`audit/FINDINGS_2026-10.md`)
whose first reader is field staff on a phone or a supervisor, each
needing nothing new from the API: PORT-55, PORT-61 and PORT-43. The rest
stay open.

Three journeys, in English and Spanish, each failing on the main of part
380:

- `formsdrafts` (PORT-55): with the person's drafts refused, Forms says
  "Unfinished reports did not load." above the forms with Try again,
  which reads them again.
- `noticeasks` (PORT-61): a notice tapped on the bell while a form is open
  asks Leave or Keep filling, as the bottom bar does; Keep filling stays,
  and Leave saves the form and opens the notice's place.
- `privatesearch` (PORT-43): an office person with twenty private chats
  searches the row by name, opens the one that matches, and a name that
  matches nobody says so. The row takes a search once it holds more than
  six, so the stub's default admin list of six reads as before.

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
- `AUDIT_JOURNEY=everynotice,bell` runs only the journeys named, with
  `AUDIT_ONLY=journeys`, for working on one (part 344). A row a known
  entry names that such a run never reaches reads as fixed, so judge
  known.json on a full run alone.
- `AUDIT_WRITE_KNOWN=1` writes what is failing today into `known.json`
  with a placeholder reason. Write the reason on each one by hand.

`npm run build` rewrites `src/buildStamp.js`, so the run puts that file
back exactly as it found it and leaves the working tree alone.
