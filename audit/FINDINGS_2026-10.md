# Audit, ocsa-staff-portal: October 2026 (part 344)

Read and run on Oct 15, 2026, at main 3f5980e (ocsa-staff-portal #88), with this pull request's changes under audit/. Nothing under src/, public/ or guide/ changed. The API's code was out of reach; its shapes come from audit/stub.js and the audit contract's sections 1 to 3, and every finding that needs the API says so. All people, sites and values in this file are invented.

## Summary

79 findings: 16 Now, 34 Before 100, 29 Later. Inside each, they run from field staff on a phone to nobody yet, and inside each of those from data wrong or lost to looks.

| Class | Count | | Class | Count |
|---|---|---|---|---|
| phone | 18 | | sign-in | 2 |
| notice | 8 | | stub | 2 |
| silent | 7 | | together | 2 |
| words | 7 | | dependency | 1 |
| time | 6 | | growth | 1 |
| deploy | 4 | | harness | 1 |
| access | 3 | | link | 1 |
| guide | 3 | | other | 1 |
| input | 3 | | reference | 1 |
| duplication | 2 | | secrets | 1 |
| picker | 2 | | signing | 1 |
| process | 2 | |  |  |

The ten that matter most:

1. **PORT-01** An issue report is wiped when it fails to send, and a second try makes a second issue.
2. **PORT-03** A check-off that meets a server error is dropped, and a queued one is thrown away after "Saved on this phone".
3. **PORT-06** Start Shift and End Shift record when the request arrives, and an End Shift with no signal is not kept.
4. **PORT-02** Resolving an assigned task wipes the note and the required photo when the save fails.
5. **PORT-04** No request has a time limit, so a stalled send waits for ever and a tap made during the wait is lost when the app closes.
6. **PORT-05** Signing out deletes check-offs still waiting to send, with no warning.
7. **PORT-09** Speak Up reads and files through /api/hr-cases, which the contract puts behind manage_cases.
8. **PORT-15** The upload route takes its storage bucket from the phone.
9. **PORT-07** Daylight saving ends Nov 1: the checklist day may turn at 3:00 AM that night.
10. **PORT-10** Three notice types written on live open nothing when tapped.

The full suite (`npm run audit`, every pass) exits 0 with every real failure in audit/known.json; the smoke check takes 98 seconds in three lanes, down from 167 in two; `npm run guide-check` and `npm run build` are clean. Their output is at the end of this file.

## Now (this week, before more people are added)

### PORT-01 An issue report is wiped when it fails to send, and a second try makes a second issue
- When: Now. Class: phone. Checklist: 5.16, part 7. Who first: 1, field staff on a phone.
- What happens: a cleaner fills in Report an Issue, adds a photo and taps Submit Issue in a basement. The send fails, a red toast shows for 3 seconds, and the form is cleared and closed anyway: the title, the details, the zone and the photo are gone. When the issue was saved and only the answer was lost, or the issue was saved and the photo attach failed, the cleaner types it again and the API gets a second issue, and every admin and supervisor is told twice (contract 2.4). Nothing on the request lets the API tell the two apart.
- Where: src/App.js:2662 (`submitIssue` catches every error itself, shows a toast and returns), src/App.js:7696 (`handleSubmit` clears every field and closes the form right after `await submitIssue(...)`).
- Proof: journeys `weakissue` and `weakissuenophoto` (rows "is kept on the phone" and "reaches the API once", in known.json), and the two lines above; with no signal and a photo, the photo's upload fails first and the form is kept, and with no photo it is wiped.
- Fix size: S in the portal (let `submitIssue` throw, clear only on success, name a photo that did not attach). Needs another repository: ocsa-api, a `clientId` on `POST /api/issues` answered once, the way check-offs are.
- Already known: section 4 names the issues screen only; the wipe is new.

### PORT-02 Resolving an assigned task wipes the note and the required photo when the save fails
- When: Now. Class: phone. Checklist: 5.16, part 7. Who first: 1, field staff.
- What happens: Assigned's Resolve asks for a note and a proof photo. When the save meets no signal or a 500, the toast shows, then the form is cleared and the sheet closes, so the cleaner takes the photo again. Can't resolve does the same.
- Where: src/App.js:2661 (`resolveAssignedTask` catches its own error), src/App.js:7267-7268 (`handleResolve` and `handleCantResolve` clear the form after it).
- Proof: code; the same pattern as PORT-01.
- Fix size: S. Needs another repository: no.
- Already known: new.

### PORT-03 A check-off that meets a server error is dropped, and a queued one is thrown away after "Saved on this phone"
- When: Now. Class: phone. Checklist: 5.16, part 7. Who first: 1, field staff.
- What happens: a tap with no signal is kept and sent later, which works. A tap that reaches the API while it answers 500, or 502 and 503 while Railway replaces its one container, is not kept: a 3-second toast shows and the box stays as it was. Worse, a tap already kept on the phone and shown as "Saved on this phone. It sends when you have signal." is deleted from the phone when its later send meets any answer but no signal, a lapsed session or Choose your PIN, so its box flips back with no word.
- Where: src/App.js:2566 (only `ERR_OFFLINE` and `auth.mustSetPin` keep the tap), src/App.js:2591-2597 (the queue drops a tap on any other answer).
- Proof: journey `weakcheckoff` and `weakuncheck`, "the API answering 500" rows in known.json; code.
- Fix size: S (keep 5xx, 408 and 429 in the queue; the clientId already makes a resend safe). Needs another repository: no.
- Already known: new.

### PORT-04 No request has a time limit, so a stalled send waits for ever and a tap made during the wait is lost when the app closes
- When: Now. Class: phone. Checklist: 5.16, part 7. Who first: 1, field staff.
- What happens: in a basement a connection often opens and then moves nothing. Every request goes through `reach()` with no timeout, so the button reads Starting..., Uploading... or Sending... for as long as the browser allows, often minutes. A check-off changes its box only once the answer comes, further taps on it are ignored with no sign, and the tap is written to the phone's queue only after the request fails, so a cleaner who gives up and closes the app loses the tap the API never got. The service worker does the same for the page itself (PORT-28).
- Where: src/App.js:21-23 (`reach`), src/App.js:521-529 (`api`), src/App.js:537-548 (`apiUpload`), src/App.js:221-235 (`uploadPhoto`); src/App.js:2543 and 2559-2566 (the check-off). Only the version check has a limit (src/App.js:117).
- Proof: journey `weakcheckoff`, "the API taking 30 seconds" (the box does not change and nothing says the tap is waiting); code.
- Fix size: M (a 15 second limit in `reach()` that throws ERR_OFFLINE; write each check-off to the queue before it is sent). Needs another repository: no.
- Already known: new.

### PORT-05 Signing out deletes check-offs still waiting to send, with no warning
- When: Now. Class: phone. Checklist: 5.16. Who first: 1, field staff on a shared phone, or anyone who signs out underground.
- What happens: Sign out gives the queue 4 seconds, then empties it. A coworker signing in on the same phone empties it too. The cleaner was told the taps were saved on the phone.
- Where: src/App.js:2450-2451 (`handleLogout`), src/App.js:1569 (`SIGN_OUT_PUSH_MS`), src/App.js:3121 (`forgetPerson` empties the queue), src/App.js:2217 (another person's sign-in).
- Proof: code.
- Fix size: S (say "N check-offs have not gone yet" before signing out, or keep each person's queue under their own key). Needs another repository: no.
- Already known: new.

### PORT-06 Start Shift and End Shift record when the request arrives, and an End Shift with no signal is not kept
- When: Now. Class: time. Checklist: 5.7, 5.16, part 7. Who first: 1, field staff, then payroll.
- What happens: Start Shift sends only the site, and End Shift sends no body, so the API writes the time it hears the request. A cleaner who taps End Shift in a basement at 11:00 PM sees a 3-second toast; nothing is kept and nothing goes by itself, so the shift ends whenever they next tap it with signal, and their hours are wrong. Waiting check-offs are not sent before the end either.
- Where: src/App.js:2465 (`POST /api/shift-sessions` with `{ siteId }`), src/App.js:2492 (`POST .../end` with no body), src/App.js:2483-2510.
- Proof: journey `weakendshift` ("End Shift goes by itself once the signal is back" rows, in known.json) and `weakstartshift` (Appendix B); code.
- Fix size: M. Needs another repository: ocsa-api, take the tap's own time within a bound (as a check-off's `completedAt` is taken).
- Already known: new.

### PORT-07 Daylight saving ends Nov 1: the checklist day may turn at 3:00 AM that night
- When: Now (it lands in 17 days; confirm in ocsa-api). Class: time. Checklist: 5.3, 5.7, part 14. Who first: 1, field staff on night shifts.
- What happens: the checklist day runs 4:00 AM to 4:00 AM in New York. The stub, which mirrors API Step 124, works out the day as the company date of the time minus four hours in milliseconds. On Nov 1, 2026 that turns the day at 3:00 AM EST, and on Mar 14, 2027 at 5:00 AM, so checks made between 3:00 and 4:00 AM on Nov 1 land on the next day and the night crew's list resets an hour early. The portal shows whatever `checklistDay` the API answers.
- Where: audit/stub.js:318 (`checklistDay` subtracts four hours of milliseconds before reading the date); src/App.js:4861-4872 reads the API's day.
- Proof: reproduction with the stub's formula at 2026-11-01T08:00Z (3:00 AM EST) giving Nov 1, where the night crew's day is still Oct 31.
- Fix size: S in the API (wall-clock hour under 4 means the day before). Needs another repository: ocsa-api, check Step 124's formula.
- Already known: contract 5.3 names the date; the formula is new.

### PORT-08 The weak-PIN rule is checked at three PIN screens out of five
- When: Now. Class: sign-in. Checklist: 5.2, part 8. Who first: 1, field staff resetting a PIN.
- What happens: Activate, Choose your PIN and Change PIN refuse 1234, 0000, repeats and the badge number. Register and Reset check only for four digits, so a weak PIN goes through, and the hint lines differ by screen.
- Where: src/App.js:1192-1204 (`weakPinReason`), used at 3719, 3956 and 11237; Register at 3586 (`pinShapeReason`), Reset at 3828 (an inline four-digit test); the comment at 1181-1188 says the API takes a weak PIN at reset and register too.
- Proof: code; journey `pinrules` tries 1234 on the screens that check, and on a reset link only a PIN of two digits, so nothing in the suite asks Reset or Register to refuse a weak one.
- Fix size: S in the portal, plus the same rule in ocsa-api. Needs another repository: ocsa-api, refuse PIN_WEAK at reset and register.
- Already known: yes, section 4 (both fronts).

### PORT-09 Speak Up reads and files through /api/hr-cases, which the contract puts behind manage_cases
- When: Now (confirm in ocsa-api). Class: access. Checklist: 5.1, part 5. Who first: 1, field staff (44 of 52 accounts).
- What happens: Speak Up loads its list of people from `GET /api/hr-cases/people` and files with `POST /api/hr-cases`. Contract section 1 says manage_cases guards every /api/hr-cases route and staff do not hold it. If the API guards these two literally, every laborer and the lead read "This list did not load." and then "Your report was not sent.", and the one private channel they have is closed. The stub answers both for staff, so the suite cannot see it.
- Where: src/App.js:10599, src/App.js:10611; the form person question falls back to the same route on a 404 (src/App.js:13049).
- Proof: code; contract section 1. Not reproducible here.
- Fix size: none in the portal if the API keeps both routes open to staff, answering id and name only. Needs another repository: ocsa-api, confirm.
- Already known: new.

### PORT-10 Three notice types written on live open nothing when tapped
- When: Now. Class: notice. Checklist: 2.6, part 9. Who first: 1, field staff (support_ticket, when the office answers their ticket); 2, supervisors (periodic_overdue, customer_concern).
- What happens: a tap on a support_ticket or periodic_overdue notice only marks it read and leaves the bell open; customer_concern offers Open in the dashboard, a second sign-in on another address. The portal has a place for two of them already: App support's My tickets, and the field kit's Periodic work. A push tap on any of them opens the bell.
- Where: src/App.js:10898-10941 (`NOTIF_TAB` has none of them), src/App.js:10975-10982 (`notifPlace` answers null).
- Proof: journey `everynotice` (stub.js `EVERY_NOTICE`, one notice of every type in contract section 3): three rows in each language, in known.json.
- Fix size: S for support_ticket and periodic_overdue, M for customer_concern. Needs another repository: ocsa-api, who receives each and what subjectId names.
- Already known: new.

### PORT-11 Five failure lines have no Spanish, and the suite's word reader could not see them
- When: Now. Class: words. Checklist: 2.10, part 16. Who first: 1, field staff (two of the five); supervisors in the field kit (three).
- What happens: when a training session or a document to sign fails to open, a Spanish screen shows "This session did not open. Try again." or "This document did not open. Try again." in English. The field kit's session start, close and checklist lines are the same. They are passed to a helper that runs `tr()` on its argument, which `audit/words.js` never read, so `untranslated()` said zero.
- Where: src/App.js:8975, 9162, 16259, 16281, 16465; the helper at 15502 (`fkFaultWords`).
- Proof: full suite, five "no Spanish entry" rows (known.json), found once `audit/words.js` reads helper arguments (this pull request).
- Fix size: S (five rows in src/words.js and translation/portal_words.csv). Needs another repository: no.
- Already known: new.

### PORT-12 Help gives new staff the wrong steps for the bottom bar and for Home
- When: Now. Class: guide. Checklist: part 16. Who first: 1, field staff asking Help in their first week.
- What happens: "Use the bottom bar and More" lists eleven places under More and leaves out My training, My company property, Safety data sheets, Field kit and Workspace. "What Home shows" puts the client request card at the top and never mentions Your first trainings, the to-sign card or the training cards, which Home draws first.
- Where: guide/APP-PORTAL.md:924 against src/App.js:875-897 and 3226; guide/APP-PORTAL.md:890-892 against src/App.js:3326.
- Proof: guide walk (part 16); `npm run guide-check` passes, since every bold name still exists somewhere.
- Fix size: S. Needs another repository: no.
- Already known: new.

### PORT-13 A push shows the API's title and body on a locked phone as written
- When: Now (confirm the push words in ocsa-api). Class: notice. Checklist: 2.3, part 9. Who first: 2, supervisors.
- What happens: the service worker shows the push's title and body exactly as sent, for every type. If an hr_case_* or Speak Up notice names a person or a case subject, it shows on a locked phone wherever previews are on, to anyone near it.
- Where: public/sw.js:118-133.
- Proof: code.
- Fix size: S in ocsa-api (lock-screen-safe words for the sensitive types; the full text in the bell). Needs another repository: ocsa-api.
- Already known: new.

### PORT-14 An HR case notice sends a supervisor to the dashboard's own sign-in
- When: Now (owner decision). Class: notice. Checklist: 2.6, part 9. Who first: 2, supervisors.
- What happens: all five hr_case_* types have no place in the portal. The bell marks the notice read and offers Open in the dashboard; a push tap opens the bell. The dashboard is another address with its own sign-in and second step, which contract 2.6 says a notice tap never asks for.
- Where: src/App.js:10965 (`caseSubject`), 10980, 2800, 11116, 11129.
- Proof: journey `everynotice` (hr_case_* rows pass as "offers Open in the dashboard"), smoke "New notices".
- Fix size: M to L (a read-only case sheet in the portal). Needs another repository: ocsa-api, a single-case read for manage_cases holders.
- Already known: new.

### PORT-15 The upload route takes its storage bucket from the phone
- When: Now (confirm in ocsa-api). Class: secrets. Checklist: 5.1, 5.11, part 11. Who first: 5, nobody yet (anyone with a staff sign-in who edits the request).
- What happens: every upload names its bucket in the query: `?bucket=issue-photos`, `task-media`, `agent-photos` and `profile-photos`. If `POST /api/uploads` writes with the service key to whatever bucket it is told, a signed-in person can write into employee-docs or site-floor-plans by changing one word, which undoes the storage rules the chat closed on Oct 14 to 15. Nothing in src/ talks to Supabase or to storage directly, and no file in public/ names a bucket.
- Where: src/App.js:226, 240, 375, 17917.
- Proof: search for "bucket=" in src/; the bundle holds no Supabase address.
- Fix size: S in the API (an allow list of these four, per role). Needs another repository: ocsa-api, confirm.
- Already known: section 4 (the storage rules); the parameter is new.

### PORT-16 Nothing builds, smokes or audits a pull request
- When: Now. Class: process. Checklist: 5.12, part 19. Who first: 5, nobody yet; every change after this one.
- What happens: the only workflows are guide-check and guide-sync. A pull request that breaks the build, the smoke check or the bundle merges and deploys, and Vercel's deploy is the first build anyone sees.
- Where: .github/workflows/ (guide-check.yml, guide-sync.yml).
- Proof: the folder.
- Fix size: S (the appendix's ci.yml). Needs another repository: no.
- Already known: yes, section 4 ("Fronts").

## Before 100 (before about 100 users or more sites)

### PORT-17 The session ends 12 hours after sign-in with no warning, and what was on the screen goes with it
- When: Before 100. Class: sign-in. Checklist: 5.2, 5.16, part 8. Who first: 1, field staff whose shift ends more than 12 hours after they signed in.
- What happens: the phone drops its token 12 hours after sign-in and there is no refresh. Any 401 signs the person out at once: the sign-in card opens blank with no line saying why, toasts are cleared, and unsaved form answers, an issue being typed, a time off or drop form and a drawn signature are lost. Only the check-off queue and form parts already on the server survive. The check-off that met the 401 is not kept (the queue flush keeps one, a live tap does not). A push tapped after the 401 lands on Home and never opens its item, since the place it asked for is cleared with the session. After signing in again the person starts on Home.
- Where: src/App.js:1312 (`AUTH_MAX_AGE_MS`), 1436, 2392; 3137-3141 (the 401 handler), 3112 (`setLoginFault(null)`), 3127-3128 (toasts and the push's place cleared), 2566 against 2592 (the live tap and the flush).
- Proof: code. The full suite does not yet drive a session that runs out mid screen (its NOT COVERED line in the sign-in journey).
- Fix size: M. Needs another repository: ocsa-api, a sliding or refresh token, and the token's real lifetime.
- Already known: new.

### PORT-18 Saving the profile sends every field, one the screen never shows among them
- When: Before 100. Class: together. Checklist: 2.2, 5.5. Who first: 1, field staff.
- What happens: Edit profile copies birthday, the address, the emergency contact and `personalNotes` into the form and sends all of them on Save, though the screen never draws `personalNotes`. If `GET /api/users/profile/me` leaves a field out (the stub leaves out `personalNotes` and `addressLine2`), every save writes it as empty, which is the failure contract 2.2 names.
- Where: src/App.js:17931-17947.
- Proof: code; the stub's profile answer (audit/stub.js, `GET /api/users/profile/me`).
- Fix size: S (send only what changed). Needs another repository: ocsa-api, what the profile read answers and what the PATCH does with "".
- Already known: contract 2.2 names the rule; this screen is new.

### PORT-19 The required proof photo can be dropped silently when an issue is resolved from its sheet
- When: Before 100. Class: silent. Checklist: 5.6. Who first: 1, field staff; 2, supervisors.
- What happens: when the person resolving an issue holds no task for it, the sheet marks the issue resolved and then posts the photo with `.catch(() => {})`. If the photo does not go, the issue reads resolved with no photo and the toast still says resolved.
- Where: src/App.js:7094-7095.
- Proof: code; search battery line 1.
- Fix size: S. Needs another repository: ocsa-api, whether resolving the issue closes its linked task.
- Already known: new.

### PORT-20 Closing the app mid-task loses most work in progress
- When: Before 100. Class: phone. Checklist: 5.16, part 12. Who first: 1, field staff.
- What happens: forms (saved to the server page by page) and inspections (photo addresses kept on the phone) survive a closed app. An issue being reported, an assigned task's resolution, a Help question, an App support ticket, an equipment tag out, a PPE signature and profile edits are held in memory alone.
- Where: src/App.js:13336-13343 and 1147, 16856 (what survives); the rest is component state.
- Proof: code; the upload table.
- Fix size: M. Needs another repository: no.
- Already known: new.

### PORT-21 Leaving a form says the saved answers stay, then drops the ones not yet saved
- When: Before 100. Class: phone. Checklist: 5.16, part 6. Who first: 1, field staff.
- What happens: Leave saves the page and leaves even when that save failed, under a dialog that says "Your saved answers stay". A tap on the bottom bar closes the form with no question asked and drops the page in progress.
- Where: src/App.js:13516 (leave), 3360 and 3383 (the bar stays live under a form).
- Proof: code.
- Fix size: S to M. Needs another repository: no.
- Already known: section 4 (owner, Oct 7: unfinished forms) covers reminders; this is new.

### PORT-22 In Spanish at the largest text size, the bottom bar covers a form's Next and Back
- When: Before 100. Class: phone. Checklist: 5.16, part 16. Who first: 1, field staff with large text in Spanish.
- What happens: on the site walk's pages at Largest, the Spanish bottom bar (its labels wrap to two lines) stands taller than the room the form keeps for the app around it, so the form's Siguiente, Atras and Enviar reporte sit under the bar, and a tap on them lands on Horario, Ayuda or Mensajes and leaves the form, dropping the page being filled in (PORT-21).
- Where: src/App.js:1754 (the room kept for the chrome), 3360 and 3383 (the bar stays live under a form).
- Proof: full suite, "Site walk, every area", "the rooms", "sign it", "review" and "the walk" at es/largest, dark and light: rows "covered", in known.json.
- Fix size: S (hide the bar while a form is open, or measure it). Needs another repository: no.
- Already known: new.

### PORT-23 A shift drop request has no guard against a double tap
- When: Before 100. Class: phone. Checklist: 5.16. Who first: 1, field staff.
- What happens: Submit Request on the drop form has no busy state, so two taps send two requests.
- Where: src/App.js:4697-4709.
- Proof: code; the stub answers each one.
- Fix size: S. Needs another repository: ocsa-api, whether a second pending drop is refused.
- Already known: new.

### PORT-24 A critical block after midnight reads Overdue all day, and an evening one stops reading Overdue at midnight
- When: Before 100 (Now if any site has a critical block between midnight and 4:00 AM). Class: time. Checklist: 5.7, part 14. Who first: 1, field staff on night shifts.
- What happens: the checklist day runs 4:00 AM to 4:00 AM, but the block window test counts minutes from midnight. A critical block from 1:00 to 2:00 AM reads Overdue from 5:00 AM to midnight, and at 10:30 PM reads Next and Overdue at once. An unfinished 10:00 to 11:00 PM critical block stops reading Overdue at 12:30 AM.
- Where: src/App.js:4998-4999 (`windowPast`, `windowHolds`), 5113-5116, 5491.
- Proof: reproduction with the two helpers on a fixed clock (05:00, 18:00, 22:30 and 00:30 Eastern).
- Fix size: S (count minutes from the 4:00 AM start). Needs another repository: no; whether such blocks exist is a data question for the chat.
- Already known: new.

### PORT-25 Home shows Start Shift when the shift status could not be read
- When: Before 100. Class: silent. Checklist: 5.6, part 13. Who first: 1, field staff.
- What happens: at sign-in a failed `GET /api/clock/status` is only logged. The status stays empty and Home draws the site list and Start Shift as if no shift were open, until the app comes back to the front.
- Where: src/App.js:2224, 4731, 2813.
- Proof: code.
- Fix size: S (draw "Your shift did not load" with Try again). Needs another repository: no.
- Already known: new.

### PORT-26 My Schedule hides time off, or says there is none, when its read fails
- When: Before 100. Class: silent. Checklist: 5.6, part 13. Who first: 1, field staff.
- What happens: when the leave types fail to load, the whole time off part is not drawn, with no line and no retry. When My time off fails, it reads "No time off requests yet."
- Where: src/App.js:4105, 4092, 4383.
- Proof: code.
- Fix size: S. Needs another repository: no.
- Already known: new.

### PORT-27 Issue and resolution photos go at full camera size, with no HEIC conversion
- When: Before 100. Class: phone. Checklist: 5.8, part 12. Who first: 1, field staff.
- What happens: Report an Issue, Assigned's Resolve and the issue sheet's Resolve send the camera's file as it is, checked only against 10 MB. A 24 to 48 megapixel iPhone photo is 5 to 15 MB: slow in a basement, or refused with "Photo must be under 10MB", with no progress shown. Every other upload in the app shrinks to 2000 px JPEG first (`prepareFormPhoto`), which would make it about 1 MB. The older inspection photo path has no size check at all.
- Where: src/App.js:221-235 (`uploadPhoto`), 7694-7695, 7266, 7074; 17016 and 17461 (`uploadTaskMedia`).
- Proof: code; the upload table in the appendix.
- Fix size: S (route these through `prepareFormPhoto`). Needs another repository: ocsa-api, the upload byte limit and what it does with HEIC.
- Already known: section 4 notes most staff carry iPhones; the path is new.

### PORT-28 With one bar, the service worker waits on the network with no time limit
- When: Before 100. Class: phone. Checklist: 5.16, part 10. Who first: 1, field staff in basements and closets.
- What happens: the page and its files are fetched network first with no timeout, and the kept copy is used only once the network throws. With one bar the screen stays white until the browser gives up. A 5xx answer for the page is drawn in place of the kept app.
- Where: public/sw.js:96-107.
- Proof: code; the slow-connection first load in the bundle appendix.
- Fix size: S (about 4 seconds, then the kept copy; the kept copy for a non-ok answer too). Needs another repository: no.
- Already known: section 4 says the worker asks the network first; the missing limit is new.

### PORT-29 Nothing in the app says a new notice came, and iPhone users in the browser get no push and are not told why
- When: Before 100. Class: notice. Checklist: 2.5, 5.16, part 9. Who first: 1, field staff using Safari (every iPhone not added to the Home Screen).
- What happens: there is no toast for a new notice; the bell polls every 60 seconds while the app is in front and is not refreshed when it comes back. iPhones allow push only for an app added to the Home Screen (iOS 16.4 or later). The first-sign-in alerts card skips an iPhone browser tab without a word, and the Add to Home Screen sheet never says alerts need it; only Settings, Phone alerts does, and iOS before 16.4 reads "This phone cannot receive alerts" with no hint to update.
- Where: src/App.js:3092 (no toast), 3201-3205 (the poll), 2813, 3163; src/HomeScreenPrompt.js:141-163; src/App.js:11425-11426.
- Proof: code.
- Fix size: S. Needs another repository: no.
- Already known: new.

### PORT-30 A training notice can open an empty My training
- When: Before 100. Class: notice. Checklist: 2.6, part 9. Who first: 1, field staff.
- What happens: training_assigned and training_session open My training with no item named. That screen is drawn only once `GET /api/training/me` has answered, so from a cold push it is empty, and stays empty with no Try again when that read failed.
- Where: src/App.js:10981, 11000, 3339, 2958-2962.
- Proof: code; smoke "The training_assigned notice opens My training" passes on a warm phone.
- Fix size: S (draw TrainingView, which reads and retries on its own). Needs another repository: no.
- Already known: new.

### PORT-31 A laborer never sees the issues they reported
- When: Before 100 (owner decision). Class: other. Checklist: part 15. Who first: 1, field staff.
- What happens: Report works out the person's own issues and then draws the list only for an admin or a supervisor, so a cleaner never sees whether what they reported was fixed. The lead is treated the same.
- Where: src/App.js:7692 (the list), 7711-7716 (drawn only when `isAdmin`).
- Proof: code; smoke "one place to work an issue" (the cleaner's Assigned list).
- Fix size: S to M. Needs another repository: no, if `GET /api/issues` answers the caller's own.
- Already known: yes, section 4 (owner, Oct 7); what is true today is in Appendix J, part 15.

### PORT-32 App support sends its screenshot as text inside the request, with no size cap
- When: Before 100. Class: input. Checklist: 5.8, part 12. Who first: 1, field staff.
- What happens: the screenshot is shrunk to 2000 px and sent as a data URL inside the JSON body, 0.3 to 1.5 MB, with no cap. If the API's body limit is lower, the ticket is refused.
- Where: src/App.js:14309-14331.
- Proof: code.
- Fix size: S. Needs another repository: ocsa-api, the body limit on /api/support/tickets.
- Already known: new.

### PORT-33 Every failure is a 3-second toast that cannot be tapped
- When: Before 100. Class: phone. Checklist: 5.6, 5.16. Who first: 1, field staff.
- What happens: Start Shift, End Shift, check-off refusals, issue failures, drop and claim say what went wrong only in a toast that lasts 3 seconds and passes taps through. A cleaner who looks away misses it.
- Where: src/App.js:1875 (`TOAST_MS`), 3459.
- Proof: code; `watchToasts` in audit/journeys.js measures it.
- Fix size: S. Needs another repository: no.
- Already known: new.

### PORT-34 A push tap never marks its notice read
- When: Before 100. Class: notice. Checklist: 2.6, part 9. Who first: 1, field staff.
- What happens: the worker keeps only the subject type and id, and the app opens the place with no read call, so the bell keeps counting an item the person already opened.
- Where: public/sw.js:128, src/App.js:2794-2801.
- Proof: code.
- Fix size: S. Needs another repository: ocsa-api, the notice id in the push payload.
- Already known: new.

### PORT-35 The largest text size is 150%, and the phone's own text size is ignored
- When: Before 100. Class: phone. Checklist: 5.16, part 16. Who first: 1, field staff with large text.
- What happens: every font is set in pixels, so iPhone Larger Text changes nothing in the app. The app's own sizes stop at 1.5 times (the contract asks for 200%), and a new person starts at Standard until they find Settings. The bar's labels stop growing at Large, and 158 inline sizes are 8 to 10 px (the More labels at 10, the bell count at 9, Edit shortcuts' preview at 8 with an ellipsis). Nothing is cut off at the app's own sizes, since the zoom grows boxes too: the text is simply small.
- Where: src/App.js:1683-1688 (`TEXT_SIZES`), 1695 (`barFontSize`), 1710-1715, 3362, 3388, 3398, 10787, 10793, 1162, 1165, 3313.
- Proof: full suite at Largest (the clipped and too small rows in known.json); smoke "Home at the Largest text size".
- Fix size: M (a 2.0 step and a first-run question). Needs another repository: no.
- Already known: new.

### PORT-36 Start Shift sits below every site row and nothing scrolls to it
- When: Before 100. Class: phone. Checklist: part 6, part 16. Who first: 1, field staff.
- What happens: the button comes after Scheduled Today, Your Assigned Sites and All Other Sites. Tapping a site does not bring the button into view, so at Largest with several sites it can be screens away.
- Where: src/App.js:4750, 4812-4815.
- Proof: code.
- Fix size: S. Needs another repository: no.
- Already known: new.

### PORT-37 Unfinished forms are "per person" only through a filter that keeps rows naming no person
- When: Before 100 (confirm in ocsa-api). Class: access. Checklist: 5.1, part 15. Who first: 2, supervisors.
- What happens: the drafts route answers everyone's drafts to people who may read reports, and the portal keeps any row with no `userId`. If the API names the field `user_id` or leaves it off, a supervisor's Home lists every person's unfinished reports and Continue opens someone else's. The toast promises "You will get a reminder until it is sent"; the reminder's subject type is not in contract section 3.
- Where: src/App.js:7417, 12762-12765, 13524, 10974.
- Proof: code. Not reproducible here.
- Fix size: S. Needs another repository: ocsa-api, the field's name, a mine-only read, and the reminder's subject type.
- Already known: section 4 (owner, Oct 7) asks for per-person drafts; this is what the code does.

### PORT-38 A supervisor's Issues list stops at the newest 20, and Assigned loses older issues
- When: Before 100. Class: growth. Checklist: 5.9, part 15. Who first: 2, supervisors.
- What happens: Issues asks `/api/issues?limit=20` with no paging and no more. Assigned takes the issues given to the person from that same 20, so an older issue assigned to someone drops off their Assigned list.
- Where: src/App.js:2660, 7716, 7248-7252.
- Proof: code.
- Fix size: M. Needs another repository: ocsa-api, paging and an assigned-to-me read.
- Already known: new.

### PORT-39 An inspection finding is listed twice on Issues, with three different ways to finish it
- When: Before 100. Class: together. Checklist: part 15. Who first: 2, supervisors.
- What happens: a finding shows in Inspection findings and again in the issue list. Fixed in the findings section needs no note and no photo; Resolved on the issue sheet needs both; Assigned needs both.
- Where: src/App.js:8425 and 2658 (findings), 7716 (the list), 8442, 7085-7088, 7267.
- Proof: code; the stub's issue list includes `source: inspection` rows.
- Fix size: S. Needs another repository: no.
- Already known: section 4 (owner, Oct 7: overlap).

### PORT-40 The field kit's Periodic work shows Overdue at a reference site
- When: Before 100. Class: reference. Checklist: 2.8. Who first: 2, supervisors.
- What happens: Periodic work draws any row with `state: overdue` in red and never reads `checklistMode`, so a reference site's list shows overdue work that contract 2.8 says never goes overdue.
- Where: src/App.js:15738-15790 (opened at 15459).
- Proof: code; the only reference checks are at 3250-3251, 4802, 5442, 5447 and 5472-5491.
- Fix size: S. Needs another repository: ocsa-api, periodic work and periodic_overdue answering nothing for a reference site.
- Already known: new.

### PORT-41 Issue PPE has the employee sign on the supervisor's phone
- When: Before 100 (owner decision). Class: signing. Checklist: 2.13. Who first: 2, supervisors.
- What happens: the field kit's Issue PPE takes the employee's signature on the supervisor's own phone, beside the Sign on your own phone flow that sends PPE to the person's phone. Contract 2.13 says a person signs on their own phone.
- Where: src/App.js:15513, 15600.
- Proof: smoke "the workspace" (the field kit issues PPE with a signature drawn).
- Fix size: M. Needs another repository: ocsa-api, if the in-person path is retired.
- Already known: new.

### PORT-42 A refusal never says which permission is missing, and three screens turn it into Try again
- When: Before 100. Class: access. Checklist: 5.1, part 5. Who first: 2, supervisors.
- What happens: nothing reads the refusal's `capability`. Most screens show "Insufficient permissions" as the API wrote it, naming no role and no next step. Workspace, Equipment and Chat show their own lines only for their own codes, so this 403 reads as a fault with Try again, and every retry fails.
- Where: src/App.js:504-517 (`refusalOf`), 14469-14470 (`wsSaidOf`, `wsFaultWords`), 15251 (`eqSaidOf`), 5664-5668 (`chatSaidOf`), 15501 (`fkSaidOf`).
- Proof: code; stub.js now answers the contract's capabilities (stub drift).
- Fix size: S. Needs another repository: no.
- Already known: new.

### PORT-43 The private chats row has no search
- When: Before 100. Class: picker. Checklist: 2.11. Who first: 2, supervisors and admins.
- What happens: every staff member's private chat sits in one row that scrolls sideways, 43 names today. New message has a search, so there is a way around it.
- Where: src/App.js:5913-5920.
- Proof: full suite "Chat, every chat".
- Fix size: S to M. Needs another repository: no.
- Already known: new.

### PORT-44 The field kit's guide entry says four tiles; there are seven
- When: Before 100. Class: guide. Checklist: part 16. Who first: 2, supervisors.
- What happens: "Open the field kit" names Issue PPE, Periodic work, Equipment and Awaiting review. Sign off training, Training session and Watch and sign off were added on Oct 5.
- Where: guide/APP-PORTAL.md:1053 against src/App.js:15392-15402.
- Proof: guide walk.
- Fix size: S. Needs another repository: no.
- Already known: new.

### PORT-45 There is no error tracking, and one boundary covers the whole app
- When: Before 100. Class: silent. Checklist: 5.6, part 13. Who first: 4, admins, who never learn a crash happened.
- What happens: a render error anywhere replaces the whole app with "Something went wrong on this screen." and Reload, and only `console.error` hears of it. A crash that repeats comes back each time the tab is opened, and nobody in the office knows.
- Where: src/App.js:1907-1926 (`LastResort`); no Sentry, `window.onerror` or `unhandledrejection` anywhere in src/ or index.html.
- Proof: journey `listfaults` (a screen that throws draws the last resort).
- Fix size: M (a boundary per tab, and a small error report route or a tracker). Needs another repository: ocsa-api for a report route.
- Already known: section 4 says the API has none; the front's is new.

### PORT-46 There is no vercel.json, so headers and caching are whatever the preset gives
- When: Before 100. Class: deploy. Checklist: 5.4, part 10. Who first: 5, nobody yet.
- What happens: there is no X-Content-Type-Options, no frame-ancestors, no Referrer-Policy and no Permissions-Policy. Hashed files are not marked immutable for phones, and the caching of sw.js, index.html and version.json is not pinned. The suite's own server answers every path with index.html, so a missing rewrite would never show in a run. The appendix holds the proposed file.
- Where: the repository root; audit/serve.js:20-27.
- Proof: the file is absent; contract section 4.
- Fix size: S. Needs another repository: no (the chat checks Vercel's live headers, contract 7).
- Already known: yes, section 4.

### PORT-47 The API address falls back to production when the build is not told one
- When: Before 100. Class: link. Checklist: 5.10. Who first: 5, nobody yet.
- What happens: when `REACT_APP_API_URL` is unset, the build talks to the production Railway address, so a preview or a new client's build would quietly use production data. `.env` sets only the theme color.
- Where: src/App.js:7; scripts/guide-sync.js:19 has the same fallback.
- Proof: search battery line 5.
- Fix size: S (fail the build when it is unset; the value in clientConfig). Needs another repository: no.
- Already known: new.

### PORT-48 Create React App is deprecated, and its whole toolchain counts as shipped
- When: Before 100. Class: dependency. Checklist: 5.12, part 17. Who first: 5, nobody yet.
- What happens: react-scripts 5.0.1 sits in `dependencies`, so `npm audit --omit=dev` reports 110 vulnerabilities (2 critical, 70 high), all in the build and dev-server toolchain (webpack-dev-middleware, proxy-addr, shell-quote, uuid and their parents); none is in the shipped bundle (react, react-dom and heic2any have none). A CI gate on high would fail for ever. Create React App was deprecated in February 2025 and gets no fixes.
- Where: package.json.
- Proof: the dependency report appendix.
- Fix size: S (move react-scripts to devDependencies), L (move to Vite or similar). Needs another repository: no.
- Already known: new.

### PORT-49 The stub had drifted from the API as built
- When: Before 100 (fixed here). Class: stub. Checklist: 5.13, part 2. Who first: 5, nobody yet.
- What happens: the stub's capabilities lagged contract section 1, it answered `checklistMode` only behind a switch, no case served 11 of the 26 notice types in contract section 3, it never answered the client acknowledgement page or the forms people route, it took a second send of a sent report, and it could not play a save whose answer is lost. Each is listed in the stub drift appendix with what this pull request changed.
- Where: audit/stub.js.
- Proof: the stub drift appendix.
- Fix size: done here (S). Needs another repository: no.
- Already known: contract 5.13.

### PORT-50 The full suite had fallen behind the app since its pause
- When: Before 100 (fixed here). Class: harness. Checklist: parts 1, 3, 4. Who first: 5, nobody yet.
- What happens: since Sept 28, 12 screens and 11 sheets were added with no case, so the suite failed on coverage before it judged anything. A day sheet added first in My Schedule moved every later sheet's id up one, so three cases inspected the sheet beside the one they name. The sweep's More search took Home's week (also a grid of seven buttons) for the More sheet. Fourteen journeys still read the app of September: a check-off's body without its clientId, a checklist row and a week day before they were tap frames, a shift's detail before the day sheet, Help's question before its requestId, the sign-in card before its lock line, Chat before it opened on the person's site, the toast strip before it became a live region, and a customer page before it asked the language list; between them and the stub's gaps they made 100 of the first run's 177 new rows (53 more were names the Spanish check cannot take apart, now accepted, and 24 were real and are in known.json). Playwright's offline switch does not stop requests the harness routes to the stub. jscpd skips App.js under its default size cap, and the word reader never read words passed through a helper. The smoke took 167 of its 180 seconds, and the full suite, one piece at a time, had not left its screen sweep after 45 minutes. All of it is fixed in this pull request; the full suite runs in lanes and the smoke in a queue of three.
- Where: audit/inventory.js, audit/screens.js, audit/journeys.js, audit/words.js, audit/smoke.js, audit/lanes.js, audit/known.json.
- Proof: the suite summary and the smoke times at the end of this file.
- Fix size: done here. Needs another repository: no.
- Already known: section 4 (smoke at 161 to 162 s); the rest is new.

## Later

### PORT-51 Two clocks: a phone outside Eastern time, or set by hand, disagrees with itself
- When: Later. Class: time. Checklist: 2.9, 5.7, part 14. Who first: 1, field staff.
- What happens: My Schedule's today and week, worked shifts, the time off form's default day, Workspace's Overdue, Home's clock and Started at all use the phone's clock. Now and Next, Done today, Start an inspection's date and a training session's day use the company clock. On a phone in Chicago at 11:30 PM Eastern, Schedule marks Oct 1 while the checklist marks the Oct 2 block, and a scheduled 7:00 PM chip (company time) sits beside a worked 6:00 PM (phone time). A phone set behind by hand can show a negative Time on Site.
- Where: src/App.js:700 (`todayLocal`), 4009-4017, 4052, 4059, 4113-4119, 4129-4132, 4164-4168, 4792-4799, 14462; company clock at 4935-4946, 5003-5025, 5435, 16169, 16253, 17756.
- Proof: reproduction with the helpers at 2026-10-02T04:30Z with TZ=America/Chicago.
- Fix size: M (one company-day helper, used for every today). Needs another repository: no.
- Already known: new.

### PORT-52 On the night of Nov 1 a block in the repeated hour is Now for about two hours
- When: Later. Class: time. Checklist: 5.7, part 14. Who first: 1, field staff on night shifts.
- What happens: the block test reads the wall clock, so a 1:30 to 2:30 AM block is Now from 1:30 to 1:59 EDT, off from 1:00 to 1:29 EST, then Now again from 1:30 to 2:29 EST. Weeks are built with setDate, and Time on Site is a difference of times, so both are right across the change.
- Where: src/App.js:4935-4946 (`companyMinutes`), 5110-5116.
- Proof: reproduction across 2026-11-01T05:30Z to 07:30Z.
- Fix size: S. Needs another repository: no.
- Already known: new.

### PORT-53 The checklist is never read again on its own, so after 4:00 AM its rows are yesterday's
- When: Later. Class: time. Checklist: part 14. Who first: 1, field staff on night shifts.
- What happens: the list is read when its key changes, after a check and after the queue sends. Coming back to the app reads only the status, so after the day turns the status is on the new day and the rows on the old one until the next check.
- Where: src/App.js:2707, 2562, 2600, 2813.
- Proof: code.
- Fix size: S. Needs another repository: no.
- Already known: new.

### PORT-54 A chat whose messages fail to load is blank, with no line and no retry
- When: Later. Class: silent. Checklist: 5.6. Who first: 1, field staff.
- What happens: `loadMessages` only logs the error; "No messages yet." is drawn only for a list that loaded.
- Where: src/App.js:2685, 5927.
- Proof: code.
- Fix size: S. Needs another repository: no.
- Already known: new.

### PORT-55 Unfinished forms disappear from Forms when their read fails
- When: Later. Class: silent. Checklist: 5.6. Who first: 1, field staff.
- What happens: a failed drafts read sets an empty list with no line on Forms; Home's card does say "Unfinished reports did not load."
- Where: src/App.js:12766.
- Proof: code.
- Fix size: S. Needs another repository: no.
- Already known: new.

### PORT-56 The profile photo is checked before it is shrunk, and never as HEIC
- When: Later. Class: input. Checklist: part 12. Who first: 1, field staff.
- What happens: the 20 MB check runs on the raw file before it is cut to 800 px; there is no HEIC conversion; the photo can be tapped again while it uploads; its object URL is never released; and the comment says 512 px where the code does 800. The picture is drawn from the public profile-photos address (section 4).
- Where: src/App.js:17910-17929, 408-429, 17977.
- Proof: code.
- Fix size: S; M if the bucket goes private (an API route that streams it). Needs another repository: ocsa-api for the private bucket.
- Already known: section 4 (public buckets).

### PORT-57 An update reload empties the offline copy
- When: Later. Class: deploy. Checklist: part 10. Who first: 1, field staff.
- What happens: the app's update deletes every cache, the worker's shell among them, and its comment says the worker has never cached anything, which sw.js contradicts. Until the worker keeps the shell again (up to 30 seconds), a phone that loses signal has no offline copy.
- Where: src/App.js:132-148; public/sw.js:17, 47, 55-69.
- Proof: code.
- Fix size: S. Needs another repository: no.
- Already known: new.

### PORT-58 A HEIC photo cannot be converted with no signal, and says so in the wrong words
- When: Later. Class: phone. Checklist: part 12. Who first: 1, field staff (rarely: iOS usually hands the browser a JPEG).
- What happens: heic2any loads as its own 1.35 MB chunk, which the service worker never keeps. With no signal a HEIC fails as "This photo could not be read. Try another one."
- Where: src/App.js:332-346, 368-370; public/sw.js:25-45.
- Proof: build/static/js/833.*.chunk.js; code.
- Fix size: S. Needs another repository: no.
- Already known: new.

### PORT-59 A form's photo question sends more photos than it has room for, and loses the batch
- When: Later. Class: input. Checklist: 5.8, part 12. Who first: 1, field staff.
- What happens: picking photos does not trim them to the room left, so all go in one upload and the API's refusal drops the whole batch. Inspections and the request page trim.
- Where: src/App.js:13327-13343.
- Proof: code.
- Fix size: S. Needs another repository: no.
- Already known: new.

### PORT-60 Assigned's Can't resolve and In Progress have no double-tap guard
- When: Later. Class: phone. Checklist: 5.16. Who first: 1, field staff.
- What happens: neither button is disabled while its request runs, so a double tap sends twice.
- Where: src/App.js:7268, 7298-7313.
- Proof: code.
- Fix size: S. Needs another repository: no.
- Already known: new.

### PORT-61 Tapping an alert while typing loses what was typed
- When: Later. Class: phone. Checklist: 5.16, part 9. Who first: 1, field staff.
- What happens: opening a notice's place changes tab without asking whether something is underway, so an issue report in progress is gone.
- Where: src/App.js:2740-2759, 7682-7686.
- Proof: code.
- Fix size: S. Needs another repository: no.
- Already known: new.

### PORT-62 A coworker's check offers Uncheck Task, which then refuses
- When: Later. Class: words. Checklist: part 6. Who first: 1, field staff.
- What happens: the box on a coworker's check stays live as "Mark X not done" and its detail offers Uncheck Task; a tap only says "Only the person who checked this can uncheck it." The refusal is handled; the offer should not be there.
- Where: src/App.js:5466, 5504, 2567.
- Proof: journey `notyourcheck`.
- Fix size: S. Needs another repository: no.
- Already known: new.

### PORT-63 A status or role the API adds later shows in English
- When: Later. Class: words. Checklist: 2.10. Who first: 1, field staff.
- What happens: the role, status, origin and request type words fall back to the code in title case, which never goes through `tr()`, so a code the API adds tomorrow shows in English on a Spanish screen.
- Where: src/App.js:773, 781, 790, 4668, 7852 (drawn at 4616, 7146, 7810, 17666).
- Proof: code.
- Fix size: S. Needs another repository: no.
- Already known: new.

### PORT-64 Spanish uses one word for two things in three places
- When: Later. Class: words. Checklist: 2.10. Who first: 1, field staff.
- What happens: "My tickets" is "Mis reportes", the same word as a form report ("Enviar reporte") and close to the Report tab ("Reportar"). Supply requests are "Pedidos de suministros" on the alert switch and "Solicitudes de suministros" elsewhere. A written warning is "Amonestacion por escrito" here and "amonestacion escrita" in the API's words the stub mirrors.
- Where: src/words.js:1387, 473, 703, 814, 1428, 1325; translation/portal_words.csv rows 1216, 669.
- Proof: the words table.
- Fix size: S. Needs another repository: ocsa-api for the warning's words.
- Already known: section 4 names "advertencia" against "amonestacion"; in the portal only "amonestacion" is used.

### PORT-65 Cannot Resolve escalates the issue, and the toast says the task was updated
- When: Later. Class: words. Who first: 1, field staff.
- Where: src/App.js:7105. Proof: code. Fix size: S. Needs another repository: no. Already known: new.
- What happens: the toast reads "Task updated to unable to resolve" for an action that sends the issue up to a supervisor.

### PORT-66 A finding the card files reads "Inspection finding:" in English
- When: Later. Class: words. Who first: 1, field staff.
- What happens: the fallback title is English on purpose, so a Spanish owner reads it in English on Assigned.
- Where: src/App.js:17068. Proof: code. Fix size: S. Needs another repository: no. Already known: new.

### PORT-67 The Schedule Inspection sheet uses a raw 85vh
- When: Later. Class: phone. Checklist: part 16. Who first: 2, supervisors.
- What happens: inside the zoomed app, 85vh is taller than the screen at Largest, so the title and its close can sit above the top of a short phone. It is the one raw vh left; the rule at 1728-1735 says to divide by the zoom.
- Where: src/App.js:17680.
- Proof: code.
- Fix size: S. Needs another repository: no.
- Already known: new.

### PORT-68 Site dropdowns are plain lists
- When: Later. Class: picker. Checklist: 2.11 (people only today). Who first: 2, supervisors.
- What happens: Report's site, the supply label's site, the field kit's site and Schedule Inspection's template and site are plain selects; Start an inspection uses the searchable picker. Fine at today's site count, slow as sites are added.
- Where: src/App.js:7703, 12465, 15477, 17687, 17694 (SearchPick at 17784).
- Proof: code.
- Fix size: S. Needs another repository: no.
- Already known: new.

### PORT-69 The guide names Report where supervisors see Issues, and six titles lack "(staff portal)"
- When: Later. Class: guide. Checklist: part 16. Who first: 2, supervisors.
- What happens: "What Home shows" and "See everything assigned to you" say Report; supervisors and admins see Issues. "Work an issue from its sheet" says the reporter can work an issue, but a cleaner's Report draws no list (PORT-31). Six entry titles have no "(staff portal)", which tells Help's portal entries from the dashboard's.
- Where: guide/APP-PORTAL.md lines 890-892 and the six titles at 1190, 1246, 1256, 1277, 1289, 1299; src/App.js:866, 7716.
- Proof: guide walk.
- Fix size: S (a renamed entry retires the old one, guide/README.md). Needs another repository: no.
- Already known: new.

### PORT-70 The workspace_member notice offers the dashboard to a supervisor who has Workspace in the portal
- When: Later. Class: notice. Checklist: 2.6. Who first: 2, supervisors.
- What happens: the portal keeps workspace_member as a subject with no place, so a supervisor added to a project is sent to the dashboard though More has Workspace.
- Where: src/App.js:10898-10941; smoke "The workspace_member notice keeps the rule for a subject with no place".
- Proof: journey `everynotice` (passes as "offers Open in the dashboard", by today's design).
- Fix size: S. Needs another repository: no.
- Already known: new.

### PORT-71 The build is hard to name from a phone, and a redeploy of one commit never reloads phones
- When: Later. Class: deploy. Checklist: part 10. Who first: 3, the office.
- What happens: the build stamp is drawn only under More, App support, as a 40-character commit, and that place shows only once the support route answers. The stamp is the commit alone, so a redeploy of the same commit with new settings never tells open phones to reload.
- Where: src/App.js:14305, 14373, 890; scripts/stamp.js:15-16.
- Proof: code.
- Fix size: S. Needs another repository: no.
- Already known: new.

### PORT-72 The build ships its source maps
- When: Later. Class: deploy. Checklist: 5.11. Who first: 5, nobody yet.
- What happens: build/static/js holds main.*.js.map (3.0 MB) and the heic2any chunk's map, which Vercel serves with the rest. The repository is public, so nothing secret is in them; they add weight and show the source line by line to anyone.
- Where: build/static/js/*.map; no GENERATE_SOURCEMAP setting.
- Proof: `ls build/static/js`.
- Fix size: S. Needs another repository: no.
- Already known: new.

### PORT-73 The stub took every upload and ignored a check-off's clientId
- When: Later. Class: stub. Checklist: 5.13. Who first: 5, nobody yet.
- What happens: `/api/uploads` answers 200 to any size or type, and the check-off route dedupes by task, person and day, so the suite cannot prove the API refuses an oversized photo or answers one clientId once.
- Where: audit/stub.js (the uploads route and the check-off route).
- Proof: code.
- Fix size: S. Needs another repository: ocsa-api, the shapes to mirror.
- Already known: new.

### PORT-74 Who may do what is worked out five ways
- When: Later. Class: duplication. Checklist: 5.1, 5.14. Who first: 5, nobody yet.
- What happens: `isAdmin` means admin or supervisor; `issueIsManager`, `OFFICE_ROLES` and `isManager` (which adds custodial_lead) say the same thing differently; the field kit is gated by role alone; the permissions route is read twice for one capability each; and when it answers 404 the lead is offered Start an inspection, which the API refuses the staff tier. A later admin-only item gated by `isAdmin` would reach the two supervisors. The stub's lead is `lead`, so the suite never meets `custodial_lead`.
- Where: src/App.js:2819, 7691, 7023, 5627, 16864-16874, 881, 3340, 2928, 16870.
- Proof: code.
- Fix size: S to M (one `canDo(capability)` over one permissions read). Needs another repository: no.
- Already known: new.

### PORT-75 The same helpers are written more than once
- When: Later. Class: duplication. Checklist: 5.14, part 17. Who first: 5, nobody yet.
- What happens: jscpd finds little pasted code (2 clones of 12 lines or more, 68 of 5 or more, 2.46%), but the same jobs are done by separate helpers: the company clock twice (`companyDay` 5003, `companyYmd` 16169: keep `companyDay`); a date-only day three ways (`localDay` 694, `dueDayText` 711, `ackDay` 12520: keep `localDay`); photo preparation four ways (`uploadPhoto` 221 sends raw, `prepareFormPhoto` 346, `compressImage` 408, Help's own at 281-302: keep `prepareFormPhoto`); and a refusal's words six ways (`openSaidOf` 5638, `chatSaidOf` 5664, `requestFaultOf` 7386, `wsSaidOf` 14469, `eqSaidOf` 15251, `fkSaidOf` 15501: keep one `saidOf(err, prefix)`). PORT-27, PORT-42 and PORT-51 are each a symptom of a copy that did not win.
- Where: as listed.
- Proof: jscpd with the size cap raised (the battery's line skips App.js), and the helper list.
- Fix size: M. Needs another repository: no.
- Already known: contract 5.14.

### PORT-76 A push with no title shows nothing
- When: Later. Class: notice. Who first: 5, nobody yet.
- What happens: the worker returns without a notification, and Safari can end a subscription whose pushes show nothing.
- Where: public/sw.js:121. Proof: code. Fix size: S. Needs another repository: no. Already known: new.

### PORT-77 A service worker that stops registering, or a queue the phone cannot store, is silent
- When: Later. Class: silent. Checklist: 5.6. Who first: 5, nobody yet.
- What happens: `register` ends in `.catch(() => {})`, so alerts and the offline app vanish with no trace; and when storage throws, the check-off queue lives in memory alone while the screen still says "Saved on this phone".
- Where: src/index.js:22; src/App.js:1353.
- Proof: search battery line 1.
- Fix size: S. Needs another repository: no.
- Already known: new.

### PORT-78 A non-ASCII middle dot is in the source
- When: Later. Class: words. Checklist: 2.15. Who first: 5, nobody (it draws fine).
- Where: src/App.js:7233, 7234, 7244, 7251 (added Oct 7 in 79fa641); elsewhere it is written as an escape (8457).
- What happens: CLAUDE.md and contract 2.15 ask for ASCII in source. Proof: `grep -nP "[^\x00-\x7F]" src/App.js`. Fix size: S. Needs another repository: no. Already known: new.

### PORT-79 src/App.js is one file of 18,048 lines, and CLAUDE.md says 12,600
- When: Later. Class: process. Checklist: part 19. Who first: 5, nobody yet.
- What happens: every screen lives in one file (the screen map appendix), which makes each change touch the whole app, keeps the jscpd and words readers on edge cases, and leaves a new session misled about its size.
- Where: src/App.js; CLAUDE.md line 13.
- Proof: `wc -l src/App.js`.
- Fix size: L (split by screen). Needs another repository: no.
- Already known: section 4 gives 18,015.

## The runs

### The full suite, as printed

`npm run build`, then `npm run audit -- --no-build` with `AUDIT_LANES=3` (every pass: the sweep of 35 screens in 12 combinations of language, size and theme, the 28 sheets at both ends of the text size scale, and 100 journeys), Oct 15, 2026, 19:41 to 20:12 UTC:

```
  screens covered     35 of 35
  sheets covered      25 of 28
  forms covered       24 of 24
  journeys            100 of 100
  refusals shown      98 of 124
  words with Spanish  1127 of 1132
  languages x sizes   12 combinations
  accepted            381
  known failures      792
  FAILURES            0
  ran in 1870.3s
```

Exit code 0. NOT COVERED lines (each named on every run, none failing it): the Text size, Inspect, schedule one, and Report, send it sheets, which the suite cannot open yet; and seven journey steps it does not yet drive (a session that runs out mid screen, ending a shift through the browser's own confirm box, sending a supply request and a damage report, filling in the incident report page by page and its refused submit, and a reload while a refused save is pending).

The first run with this pull request's coverage and lanes (before the journeys were brought up to the app) took 26.5 minutes and printed 182 failures: 177 new rows and 5 known entries the app had fixed. 100 of the rows were the harness lagging (PORT-50), 53 are names the Spanish check cannot take apart and are now accepted, and 24 were real and are in known.json beside the weak-signal and word rows. A run on the harness as main left it, one piece at a time, had not left its screen sweep after 45 minutes and was stopped there; its coverage rows alone would have failed it.

### The smoke check

| Run | Lanes | Seconds | Checks |
|---|---|---|---|
| Before part 1 (main, two fixed lanes) | 2 | 167 | 130, 0 failed |
| After part 1, first | 3, one queue | 99 | 130, 0 failed |
| Final, first (with the stub's changes and the pay check) | 3, one queue | 98 | 131, 0 failed |
| Final, second | 3, one queue | 98 | 131, 0 failed |

Where the time went: the checks summed to about 300 seconds of work; the two fixed lanes held 27 checks each, with the three longest (a cleaner's run in each language, 13 to 14 seconds, and Step 264, 14) split unevenly, so one lane ran 167 seconds while the other waited. One queue, longest first, drained by three lanes brings it to the work divided by three. `SMOKE_TIMES=1` prints each check's seconds; `SMOKE_LANES` sets the lanes.

### The guide check and the build

```
guide-check: 123 entries, 1768 bold names, 1768 with English, Spanish and French, 170 allowed, 133 pictures, fingerprint 8a662fe0e275c40c09cd4345e49a75d9, passed
```

`npm run build`: Compiled successfully, 13.6 seconds (37.8 on a cold cache); main.9a28a5f8.js 286.92 kB gzipped, the heic2any chunk 338.42 kB. `git diff --stat origin/main` lists audit/ files alone.

### The search battery, counts

106 swallowing catches; 18 date and clock calls; 0 template filter strings; 2 awaits in a loop; 2 hard-coded hosts; 0 `select('*')`; 2 console lines naming a token (neither logs one); 5 secret-shaped lines in history (one old key, Appendix E); `npm audit --omit=dev` 110 (2 critical, 70 high); depcheck 0; jscpd 0 as written (App.js skipped by its size cap), 2 with the cap raised. Every hit worth reading is in Appendix G.

## Appendix A. Stub drift (contract 5.13)

Each place `audit/stub.js` answered differently from API #146 as contract sections 1 to 3 give it, or from the shapes `src/App.js` already reads, and what this pull request did. The API's own code is out of reach from this session, so every shape below is the contract's or the portal's reading of it.

| # | Where the stub lagged | As built (contract or src/) | This pull request |
|---|---|---|---|
| 1 | `CAPABILITIES` gave manage_staff and read_incident_reports to admins alone | Contract 1: supervisors hold both | Fixed: both held by admin and supervisor |
| 2 | `CAPABILITIES` had no manage_employment, read_hr_records or manage_cases | Contract 1: admin; admin; admin and supervisor | Fixed: all three on the list, so `GET /api/users/me/permissions` answers them |
| 3 | `access.insufficientPermissions` refusals carried no `capability` | Contract 1: the refusal names the capability | Listed only: which capability each field kit and supply route checks is in the API |
| 4 | `checklistMode` answered only when a case passed `checklistModes` | API #146 (Step 337, migration 0070) answers it on every site, status, session and task read | Fixed: answered `tracked` on every read unless a case says `reference`; `checklistModes: null` still plays an API from before Step 337 |
| 5 | Of the 26 subject types in contract 3, no case on main served 11: client_request, customer_concern, document_to_sign, hr_case_due_soon, hr_case_escalated, hr_case_filed, hr_case_overdue, inspection_finding, issue_assigned, periodic_overdue and support_ticket | Contract 3 | Fixed: `EVERY_NOTICE`, one of each with the link the API builds, driven by the new `everynotice` journey |
| 6 | The client acknowledgement page, `/a/<token>` (`GET` and `POST /api/public/acknowledge/:token`), was never answered, so the screen could only show its fault | src/App.js:12586 and 12644 read and send it | Fixed: `acknowledge` switch, in the shape AcknowledgeScreen reads, signed out and answered in the request's language |
| 7 | No way to play an API that keeps the work while the answer is lost, so no case could ask whether a retry makes a second record | Contract 5.16 | Fixed: `state.trouble` gives the next matching call a 500, a hold or a lost answer |
| 8 | No reply was ever read for a pay figure | Contract 2.1: pay is admin-only in every reply | Fixed: `payIn` reads every answer of every case; `payRows()` fails the full suite and the smoke on one served to anyone without manage_employment. None is served today |
| 9 | The custodial lead is `lead` in the stub; src/App.js tests `custodial_lead` | src/App.js:16864 | Listed only (PORT-74): the role string the API sends needs the API |
| 10 | The check-off route dedupes by task, person and day, and ignores `clientId` and `completedAt` | The API answers one clientId once and keeps a late tap's time (src/App.js:1338-1340) | Listed only (PORT-73) |
| 11 | `/api/uploads` takes any size, type and bucket | The API's limits, and the bucket allow list (PORT-15) | Listed only (PORT-73) |
| 12 | `startNow` and the 409 `tasks.siteNotTracked` | Present behind `startInspection` and `checklistModes` since Steps 335 and 339 | No drift found |
| 13 | The checklist day is the company date of the time minus four hours of milliseconds | If the API does the same, the day turns at 3:00 AM on Nov 1 (PORT-07) | Listed only: the stub mirrors the API; the fix is the API's |
| 14 | `GET /api/users/profile/me` answers no `personalNotes` or `addressLine2` | src/App.js:17931-17947 sends both | Listed only (PORT-18): what the API answers needs the API |
| 15 | `GET /api/forms/people` was never answered, so the read fell to the form-by-code route and the person question drew nobody | src/App.js:13044 reads it first, ids and whole names | Fixed: answered with the person and the invented staff |
| 16 | A second send of a sent draft answered 200 | src/App.js:13496 reads a 409 as already sent | Fixed: a sent draft's second send is refused 409 |
| 17 | A lesson picture's signed address, fetched by an `<img>`, was flagged for saying no language | It is never built through `reach()` and needs none | Fixed: left out of the language check |
| 18 | The walk's safety form words had no Spanish twins, so the sweep's first look at the walk's Sections read the Spanish as English | audit/stub.js `WALK_WORDS` | Fixed: registered as twins |

## Appendix B. Weak signal and lost work (contract 5.16, part 7)

Run by the `weak*` journeys in the full suite, in English and Spanish (the 30 second case in English alone), on the phone the suite plays (an iPhone's user agent at 375 wide). Each action is put through four kinds of trouble as the tap is made: the signal gone (the browser's offline switch with the stub's own, since Playwright's switch alone never stops a request the harness routes to the stub, then the signal back for 6 seconds); the API answering 500 once; the API doing the work and answering 30 seconds late, with a second tap 1.5 seconds in; and the API keeping the work while its answer is lost on the way back, then the person trying again (the same tap if the work is still on the screen, the work done again if it is gone). What each cell says:

- **kept**: the work is still there to send: the typed words or the drawing on the screen, or the tap in the phone's queue for a check-off. For Start Shift and End Shift it means the button is still there to tap again; nothing is kept to send.
- **said**: a line on the screen said it had not gone (any of the app's own lines for no signal, a server error, "Saved on this phone", a form or a signature not sent).
- **went by itself**: the API heard it again with nobody tapping, within 6 seconds of the signal coming back.
- **records after a retry**: how many the API answered as done, counting the one whose answer was lost. A repeat the API refuses (a shift already ended, a request already signed, a report already sent) is not a second record. Start Shift: the stub keeps one open session and answers every start 200, so 2 there is two answered starts; whether the API makes two sessions is the API's. A time off request: the stub takes every request; whether the API refuses an overlap is the API's.
- **busy shown**: 1.5 seconds into a 30 second wait, the button reads busy (disabled or "...ing...").

| Action | The signal gone as the tap is made | The API answers 500 | The API takes 30 seconds, tapped twice (en) | The work kept, the answer lost, tried again |
|---|---|---|---|---|
| A check-off | kept yes; said yes; went by itself yes | kept no; said yes; went by itself no | busy shown no; a second tap: one record | kept yes; said yes; records after a retry: 1 |
| An uncheck | kept yes; said yes; went by itself yes | kept no; said yes; went by itself no | busy shown no; a second tap: one record | kept yes; said yes; records after a retry: 1 |
| Start Shift | kept no; said yes; went by itself no | kept no; said yes; went by itself no | busy shown yes; a second tap: one record | kept no; said yes; records after a retry: 2 |
| End Shift | kept yes; said yes; went by itself no | kept yes; said yes; went by itself no | busy shown yes; a second tap: one record | kept yes; said yes; records after a retry: 1 |
| An issue with a photo | kept yes; said yes; went by itself no | kept no; said yes; went by itself no | busy shown yes; a second tap: one record | kept no; said yes; records after a retry: 2 |
| An issue with no photo | kept no; said yes; went by itself no | kept no; said yes; went by itself no | busy shown yes; a second tap: one record | kept no; said yes; records after a retry: 2 |
| A form submit | kept yes; said yes; went by itself no | kept yes; said yes; went by itself no | busy shown yes; a second tap: one record | kept yes; said yes; records after a retry: 1 |
| A signature | kept yes; said yes; went by itself no | kept yes; said yes; went by itself no | busy shown yes; a second tap: one record | kept yes; said yes; records after a retry: 1 |
| A time off request | kept yes; said yes; went by itself no | kept yes; said yes; went by itself no | busy shown yes; a second tap: one record | kept yes; said yes; records after a retry: 2 |

What it says, against part 7's questions:

- **Is the work kept?** A check-off and an uncheck are kept on the phone with no signal and after a lost answer, and are not kept after a 500 (PORT-03). An issue is wiped after a 500 and after a lost answer, and with no signal unless it carries a photo, whose upload fails first (PORT-01). A form submit, a signature and a time off request keep what was typed or drawn. Start Shift keeps nothing to send (the site must be picked again); End Shift keeps the person on shift with End Shift to tap again.
- **Does the screen say it has not gone?** Yes, for every action and every trouble, in both languages: a 3-second toast for check-offs, shifts and issues (PORT-33), a lasting line for forms, signatures and time off.
- **Does it go by itself when signal returns?** Only check-offs and unchecks (the queue). Nothing else does; End Shift's end is then the time of the next tap (PORT-06).
- **Can a double tap or a retry make two records?** A double tap: no; every button but the check-off box is busy while it waits, and the check-off ignores a second tap on the same box. A retry after a lost answer: yes for an issue (no clientId; PORT-01), and the stub answers a second Start Shift and a second time off request too, which the API may refuse (PORT-23 covers the shift drop's missing guard). A check-off's clientId, a signed request's state, a sent report's state and an ended shift hold a retry to one record.
- **The 30 second wait**: no request has a time limit (PORT-04), so each waits for the answer; a check-off box shows nothing while it waits.

## Appendix C. The service worker and old builds (part 10)

Read whole: public/sw.js (156 lines), src/index.js, the update hook in src/App.js:93-220 and scripts/stamp.js.

- **How a new build reaches a phone that keeps the app open for days.** The app asks for `/version.json?t=<now>` with no-store and an 8 second limit (src/App.js:113-130): 5 seconds after it starts, then every 15 minutes while it is in front (hidden ticks are skipped), when it comes back to the front after more than a minute, and when the phone comes back online. When the stamp differs and nothing is underway (a request in flight, a busy screen, a full-screen sheet or a filled field), it reloads by itself; otherwise it shows "A new version is ready" with Update now, and tries again every 20 seconds. A guard stops a second automatic reload for the same stamp. The reload is a navigation, so the browser fetches sw.js past its cache and the new worker takes over at once.
- **How long that can take.** About 15 minutes for a phone left open and idle; seconds once it comes back to the front; no limit while something stays underway, until Update now is tapped; never while offline.
- **Whether the build shows anywhere.** `BUILD_STAMP` is drawn only under More, App support, as the 40-character commit, and that place shows only once the support route answers (PORT-71). It goes with every ticket.
- **Whether a waiting worker is told to take over.** It never waits: install calls `skipWaiting()` and activate calls `clients.claim()` (sw.js:74-87). There is no SKIP_WAITING message, no updatefound and no controllerchange listener anywhere, so a new worker takes pages over as soon as it activates.
- **What is kept for no signal, and when it is cleared.** One cache, `ocsa-shell-v2`: index.html under `/` and `/sds`, the `/static` js and css files that page names, `/icons/`, `/manifest.json` and `/ocsa-logo-sm.png` (sw.js:25-45). It is replaced whole on every good online load of `/` or `/sds`, only once every file it names arrived (sw.js:55-69); old cache names go on activate; and the app's own update reload deletes every cache, this one included (PORT-57). Not kept: the heic2any chunk, the guide pictures, version.json and every API answer. Unsent check-offs and the last checklist are in localStorage (`ocsa-pending-checkoffs`, `ocsa-checklist-kept`), outside the worker.
- **What it asks the network for.** Navigations to `/` and `/sds` are network first, with the kept copy on a thrown error alone (no time limit, PORT-28); files a kept page asks for (known by the referrer) are network first with the cache on error; everything else is left alone: the API, `/activate`, `/join/...` and anything on another origin. Contract section 4's "asks the network first for every request" is wider than the code.
- **Whether a broken build could be kept.** A build is kept only if the page and every file it names answered 200. A build that throws when it runs is kept like any other and replaced at the next good online load. While the app shows its last resort the update hook is gone, so the phone stays on "Something went wrong on this screen." until Reload is tapped (src/App.js:1908).
- **Registration.** src/index.js:20-23, production only, on load, scope `/`, the default updateViaCache, errors swallowed (PORT-77).
- **What a host must send.** sw.js: `Cache-Control: no-cache`. index.html and every app route: `no-cache`. version.json: `no-store`. manifest.json: `no-cache`. `/static/*` (hashed): `public, max-age=31536000, immutable`. Service-Worker-Allowed is not needed (the worker sits at the root). Never `Referrer-Policy: no-referrer`, since sw.js:29-32 reads the referrer to decide what to serve offline.
- **What the chat should check on Vercel** (contract 7): that the Build Command runs `npm run build` (without it version.json is missing, the fallback answers it with index.html, and no phone ever updates by itself), and that `REACT_APP_API_URL` is set (PORT-47).

## Appendix D. Proposed vercel.json

Not added by this pull request (only audit/ changes). Check on a preview before rollout that each of these loads the app: /activate, /reset-pin, /c/x, /r/x, /sup/x, /a/x, /sds and /sds/x, /eq/x, /requests/x, /issues/x, /join/x, /training/c/x, /sign/x, /inspect/x, /drafts/x, /supplies/x. Photos use input capture, which needs no camera policy; `camera=(self)` leaves room for a live scanner.

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Content-Security-Policy", "value": "frame-ancestors 'none'" },
        { "key": "Permissions-Policy", "value": "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" }
      ]
    },
    {
      "source": "/((?!static/|icons/|guide-shots/|sw\\.js|version\\.json|manifest\\.json).*)",
      "headers": [{ "key": "Cache-Control", "value": "no-cache" }]
    },
    { "source": "/static/(.*)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] },
    { "source": "/sw.js", "headers": [{ "key": "Cache-Control", "value": "no-cache" }] },
    { "source": "/version.json", "headers": [{ "key": "Cache-Control", "value": "no-store" }] },
    { "source": "/manifest.json", "headers": [{ "key": "Cache-Control", "value": "no-cache" }] },
    { "source": "/icons/(.*)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=86400" }] },
    { "source": "/guide-shots/(.*)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=3600" }] }
  ],
  "rewrites": [
    { "source": "/((?!static/|icons/|guide-shots/|sw\\.js|version\\.json|manifest\\.json).*)", "destination": "/index.html" }
  ]
}
```

## Appendix E. Secrets and the bundle (contract 5.11, part 11)

**`REACT_APP_` names used in src/.** Every one is baked into the public bundle by design; none holds a secret.

| Name | Where | What it holds |
|---|---|---|
| `REACT_APP_API_URL` | src/App.js:7 | The API's address. Unset, the build falls back to the production Railway address (PORT-47). |
| `REACT_APP_CANONICAL_ORIGIN` | src/canonicalRedirect.js:23 | The address to move to (staff.ocsaco.com on Vercel). |
| `REACT_APP_REDIRECT_FROM_HOST` | src/canonicalRedirect.js:23 | The old host to move away from (the vercel.app address). |
| `REACT_APP_THEME_COLOR` | .env only | Read by nothing in src/ or public/; a leftover. |

**The bundle after `npm run build`.** build/static/js holds main.9a28a5f8.js (1,098,877 bytes, 286,840 gzipped), the heic2any chunk 833.1551f807.chunk.js (1,351,985 bytes, about 338 KB gzipped) and both source maps (PORT-72). Searched for key shapes: `eyJhbGciOi` 0, `sk-ant-` 0, `sb_secret_` 0, `sb_publishable_` 0, `service_role` 0, `BEGIN ... PRIVATE KEY` 0, `AIza...` 0, `supabase.co` 0, `apikey` 0, `secret` 0, `Bearer <long token>` 0. The two hits for "anon" are React's `<anonymous>` stack text. The only host in the bundle is the production API's (the fallback above).

**Git history, every branch (6 remote branches, 447 commits, unshallowed).** The battery's line counts 5. Every one is the same kind: a Supabase JWT (the contract names it the legacy anon key; this session did not decode it) with the project's Supabase address beside it.

| Commit | Date | File | Kind |
|---|---|---|---|
| 5801546 | 2026-03-25 | src/App.js | `SUPA_URL` (Supabase address) and `SUPA_KEY` (Supabase JWT) added |
| 390d402 | 2026-03-27 | src/App.js | the same JWT in an `Authorization` and an `apikey` header, uploading straight to the task-media bucket |
| 91250e2 | 2026-03-27 | src/App.js | the `SUPA_KEY` line as diff context |
| 78cd9b5 | 2026-03-31 | src/App.js | all of it removed |

No other secret-shaped line (`sk-ant-`, `sb_secret_`, `service_role`, a private key, a Google key) is anywhere in history. `.env` has been committed since 7521fea (2026-06-29) and holds one name, `REACT_APP_THEME_COLOR`. The key still works for whatever the public role may do (contract section 4): the chat's storage work is what limits it, and PORT-15 is the portal's side of that.

**Supabase and storage from src/ and public/.** Nothing in src/ talks to Supabase or to storage directly; every upload goes through the API's `/api/uploads`, which the portal tells which bucket to use (issue-photos, task-media, agent-photos, profile-photos; PORT-15). No file in public/ names a bucket. The profile photo is drawn from the public profile-photos address the API answers (PORT-56).

## Appendix F. The screen map of src/App.js

Every component of 40 lines or more, with its lines. The file is 18,048 lines; helpers and small components fill the rest.

| Lines | Count | Component |
|---|---|---|
| 1929-3483 | 1555 | OCSAStaffPortal |
| 3484-3570 | 87 | LoginScreen |
| 3571-3614 | 44 | RegisterScreen |
| 3673-3798 | 126 | ActivateScreen |
| 3799-3890 | 92 | ResetScreen |
| 3891-3944 | 54 | ForgotScreen |
| 3945-3987 | 43 | SetPinScreen |
| 3991-4725 | 735 | MyScheduleSection |
| 4726-4822 | 97 | ClockView |
| 5165-5205 | 41 | ShiftSheet |
| 5206-5530 | 325 | TasksView |
| 5689-6028 | 340 | ChatView |
| 6119-6218 | 100 | SdsBrowser |
| 6418-6466 | 49 | RateAnswer |
| 6507-6946 | 440 | AgentView |
| 7025-7222 | 198 | IssueSheet |
| 7257-7343 | 87 | AssignedTasksView |
| 7483-7577 | 95 | ClientRequestsSection |
| 7578-7624 | 47 | RequestApproveSheet |
| 7625-7680 | 56 | RequestNoteSheet |
| 7681-7736 | 56 | IssuesView |
| 7833-7972 | 140 | SuppliesView |
| 8055-8117 | 63 | SupplyOrdersView |
| 8134-8281 | 148 | SupplySignOrder |
| 8282-8324 | 43 | SupplyOrderLine |
| 8325-8405 | 81 | SupplyOrder |
| 8425-8498 | 74 | FindingsSection |
| 8640-8939 | 300 | TrainingView |
| 8951-9064 | 114 | TrainingJoin |
| 9136-9285 | 150 | DocumentReader |
| 9286-9326 | 41 | DocDesigned |
| 9437-9728 | 292 | HandbookReader |
| 9771-9869 | 99 | LibraryView |
| 9964-10225 | 262 | TrainingLesson |
| 10284-10500 | 217 | SignScreen |
| 10516-10561 | 46 | MyPropertyView |
| 10566-10731 | 166 | SpeakUpView |
| 10732-10897 | 166 | ShortcutsSheet |
| 10898-10951 | 54 | NOTIF_TAB |
| 11034-11158 | 125 | NotificationsSheet |
| 11166-11222 | 57 | AnnouncementSheet |
| 11223-11275 | 53 | ChangePinCard |
| 11276-11351 | 76 | SettingsView |
| 11352-11499 | 148 | PhoneAlertsView |
| 11721-11777 | 57 | SignatureBox |
| 11932-11997 | 66 | CustomerFormScreen |
| 12040-12306 | 267 | ClientRequestScreen |
| 12323-12500 | 178 | SupplyScreen |
| 12556-12729 | 174 | AcknowledgeScreen |
| 12730-12947 | 218 | FormsView |
| 12948-14159 | 1212 | FormFiller |
| 14184-14248 | 65 | SearchPick |
| 14288-14406 | 119 | SupportView |
| 14580-14641 | 62 | WsHome |
| 14667-14724 | 58 | WsProject |
| 14725-14798 | 74 | WsBoard |
| 14799-14876 | 78 | WsComments |
| 14877-14918 | 42 | WsPost |
| 14919-14979 | 61 | WsTodo |
| 14980-15105 | 126 | WsTodos |
| 15106-15229 | 124 | WsFiles |
| 15253-15391 | 139 | EquipmentView |
| 15421-15500 | 80 | FieldKitView |
| 15550-15715 | 166 | FkPpe |
| 15738-15793 | 56 | FkPeriodic |
| 15802-15861 | 60 | FkEquipment |
| 15910-16042 | 133 | FkInspection |
| 16061-16105 | 45 | FkSignoff |
| 16106-16163 | 58 | TrainerSignoffSheet |
| 16192-16391 | 200 | FkSession |
| 16409-16582 | 174 | FkObserve |
| 16583-16772 | 190 | PickupView |
| 16773-17725 | 953 | InspectView |
| 17726-17822 | 97 | StartInspectionSheet |
| 17850-17890 | 41 | WalkSectionsSheet |
| 17891-18048 | 158 | MyProfileView |

## Appendix G. The search battery (contract 6)

Run from the repository root with `--exclude-dir=node_modules --exclude-dir=build --exclude-dir=audit --exclude-dir=.git`, on Oct 15, 2026, at 3f5980e plus this branch's audit/ changes.

| # | Line | Count | Hits worth reading |
|---|---|---|---|
| 1 | empty or swallowing catches | 106 | src/App.js 94, public/sw.js 5, src/HomeScreenPrompt.js 3, src/canonicalRedirect.js, src/homeScreenPromptRules.js, src/index.js, src/words.js 1 each. Most guard storage, history, clipboard, object URLs and the like. The ones that hide a failure a person should know about: src/App.js:7095 (PORT-19), 1353 (PORT-77), 2450-2451 (PORT-05), src/index.js:22 (PORT-77); later ones at 1147, 2928 (a failed permissions read hides Approve supplies with no word), 7847, 11080, 16238 and 16243. |
| 2 | date and clock calls | 18 | all src/App.js; none is a literal `new Date('YYYY-MM-DD')` and none is `toISOString().slice(0, 10)`. The `.getDate()` and `.getDay()` hits build weeks with setDate on the phone's clock (PORT-51) or read local days; part 14 below. |
| 3 | template strings in a supabase-js filter or SQL | 0 | |
| 4 | await in a loop | 2 | src/App.js:144 (clearing caches one by one, harmless), 13378 (a form's photo thumbnails read all at once, six at most) |
| 5 | hard-coded hosts | 2 | src/App.js:7 and scripts/guide-sync.js:19, both the production API as a fallback (PORT-47) |
| 6 | `.select('*')` | 0 | |
| 7 | logging a PIN, code, token, password, rate or SSN | 2 | src/App.js:2180 and 2181, both `console.error(err)` on a line that names `token` as an argument; nothing secret is logged |
| 8 | secret-shaped lines in all of git history | 5 | the old Supabase JWT and address (Appendix E) |
| 9 | `npm audit --omit=dev` | 110 | 3 low, 35 moderate, 70 high, 2 critical, all in react-scripts' toolchain (Appendix H) |
| 10 | `npx --yes depcheck` | 0 | "No depcheck issue" |
| 11 | `npx --yes jscpd --min-lines 12 ... src` | 0 | jscpd's default size cap skips src/App.js, so the line reads 6 small files. With `--max-size 10mb`: 2 clones, 30 lines (0.14%), App.js:1802-1818 against 1840-1850 (TextSizeButton and LanguageButton's sheet) and 13726-13738 against 17354-17363. At `--min-lines 5`: 68 clones, 522 lines (2.46%). The battery should carry `--max-size 10mb`. |

## Appendix H. Dependencies (contract 5.12 and 5.14, part 17)

- `npm audit --omit=dev`: 110 (3 low, 35 moderate, 70 high, 2 critical) over 1,298 packages counted as production, because react-scripts is in `dependencies`. The one direct package flagged is react-scripts (high). The two critical: proxy-addr (IP spoofing through an IPv4-mapped IPv6 trust subnet) and shell-quote (`quote()` command injection), both in the dev server and build tooling. react, react-dom, scheduler and heic2any have none. Nothing flagged ships in build/static/js. The fix npm offers is "react-scripts@0.0.0, a breaking change", which is no fix. PORT-48.
- `npx depcheck`: no unused and no missing package.
- Packages added in the last 60 days (since Aug 16, 2026), from package.json's history:
  - heic2any ^0.0.4, Sep 27 (c7a22e8, "Small photos from the phone"): turns an iPhone HEIC photo into a JPEG on the phone before it is shrunk. It exists on npm under that name (MIT), but 0.0.4 is its last release (published March 2023), it weighs 2.7 MB on disk and builds a 1.35 MB chunk, loaded only when a HEIC is picked (src/App.js:333). Unmaintained; keep it lazy and keep its chunk for no signal (PORT-58).
  - playwright 1.56.1 (dev), Sep 19 (2119060, "The audit harness"): drives the suite, the smoke check and the shots.
  - Nothing else was added; the rest of package.json's changes are scripts.
- The lockfile is committed and `npm ci` installs from it (20 s here). Vercel's install command is the chat's to check (contract 7).
- Size: main.9a28a5f8.js is 1,098,877 bytes, 286,840 gzipped (287 KB at level 9); the heic2any chunk is lazy. First load on a slow phone connection, measured in the harness with the build served gzipped and Chrome's network throttled (scripts/slow-load.js in the session's notes, not committed): the build reached the sign-in card in 2.1 s and Home in 2.0 s at 1.6 Mbps with 150 ms of latency; 6.8 s and 6.9 s at 400 kbps with 400 ms; and 17.4 s at 150 kbps with 800 ms, about one bar in a basement. The API's answers came from the stub at once, so on a real phone Home's own reads add to the last two. A phone that has loaded the app before can read the hashed files from its own cache once the host marks them immutable (Appendix D); today the service worker asks the network for them first on every load (PORT-28).
- Helpers written more than once, and which copy should win: PORT-75.

## Appendix I. Process, and the proposed CI workflow (part 19)

**CLAUDE.md, read as a new session reads it.** What it is missing or gets wrong:
- It says src/App.js is about 12,600 lines; it is 18,048 (PORT-79), and it names none of the other files in src/ (canonicalRedirect.js, clientConfig.js, HomeScreenPrompt.js, homeScreenPromptRules.js, buildStamp.js).
- It never mentions the full suite, `npm run audit`, audit/known.json, or that the owner paused the suite in late September (audit/README.md says so; CLAUDE.md does not), nor when to run it. Contract section 0 says CLAUDE.md carries the pause; it does not.
- It says the smoke check takes about two minutes; it took 161 to 167 seconds and now about 100.
- It says to push and that Vercel redeploys, with no word on what CI runs (nothing, PORT-16), on which environment variables a build needs (`REACT_APP_API_URL`, `REACT_APP_CANONICAL_ORIGIN`, `REACT_APP_REDIRECT_FROM_HOST`; PORT-47), or on `version.json` needing `npm run build` as Vercel's build command.
- It has no rule for secrets (never a key in src/ or in a REACT_APP_ name; the history already holds one) and none for the stub (every new API shape the portal reads goes into audit/stub.js in the same pull request, so the suite keeps up).
- It has no word on weak signal: every send keeps its work until the API has answered, carries a clientId, and has a time limit (PORT-01 to PORT-06).
- "Show a diff and wait for review before committing" and "Every build runs ... before a pull request opens" are hard to follow for an unattended session; say what an unattended audit or fix round may do.

**Proposed `.github/workflows/ci.yml`.** Not added by this pull request.

```yaml
# Proposed: .github/workflows/ci.yml (part 344). Runs on every pull
# request and on main. Not added by the audit; the fix round adds it.
name: CI

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build-and-check:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v5
        with:
          # The whole history: guide-check compares against the base branch,
          # and the secret count reads every commit.
          fetch-depth: 0
      - uses: actions/setup-node@v5
        with:
          node-version: 22
          cache: npm
      - name: Install from the lockfile
        run: npm ci
      - name: Build
        # CI=true turns every build warning into a failure.
        env:
          CI: "true"
        run: npm run build
      - name: Guide check
        env:
          GUIDE_BASE: origin/${{ github.base_ref || 'main' }}
        run: npm run guide-check
      - name: Browser for the smoke check
        run: npx playwright install --with-deps chromium
      - name: Smoke check
        run: npm run smoke
      - name: Dependencies, high and critical
        # Fails today: react-scripts sits in "dependencies", so its whole
        # toolchain counts as shipped (70 high, 2 critical on Oct 15). Move
        # react-scripts to devDependencies first; then this reads only what
        # the bundle carries (react, react-dom, heic2any).
        run: npm audit --omit=dev --audit-level=high
      - name: No new secret in history
        # Five lines in this repository's history hold the old Supabase
        # public key (commits 5801546 and 390d402, removed in 78cd9b5).
        # The count may never grow. Never print a match.
        run: |
          n=$(git log -p --all | grep -cE "eyJhbGciOi|sk-ant-|sb_secret_|service_role|BEGIN [A-Z ]*PRIVATE KEY|AIza[0-9A-Za-z_-]{30}" || true)
          echo "secret-shaped lines in history: $n (allowed: 5)"
          test "$n" -le 5
      - name: No key in the bundle
        run: |
          if grep -lE "eyJhbGciOi|sk-ant-|sb_secret_|sb_publishable_|service_role|BEGIN [A-Z ]*PRIVATE KEY|AIza[0-9A-Za-z_-]{30}|supabase\.co" build/static/js/*.js; then
            echo "a key-shaped value is in the built bundle"; exit 1
          fi
      - name: No source maps shipped
        # Vercel serves build/ as it is; the maps carry the whole source.
        run: test -z "$(ls build/static/js/*.map 2>/dev/null)" || echo "::warning::source maps are in build/ (set GENERATE_SOURCEMAP=false)"
```

## Appendix J. Answers by part

### Part 5. Role by role

The bar is the same for every role: Home, four shortcuts (Schedule, Tasks, Chat and Help unless the person changes them) and More; the header holds Profile, the bell, Settings and Sign out. Twelve places can sit on the bar or under More for every role with no condition: Schedule, Tasks, Chat, Help, Assigned, Report (Issues for an admin or a supervisor), Supplies, Pickup, Inspect, Speak Up, Settings and Forms (src/App.js:860-897, 2982, 3227-3228). The rest:

| Place | Laborer (43) | Lead (1) | Supervisor (2) | Admin (6) | Shown when |
|---|---|---|---|---|---|
| Safety data sheets | yes | yes | yes | yes | the API has sheets, or the phone kept a list |
| My training | yes | yes | yes | yes | `GET /api/training/me` answered |
| My company property | yes | yes | yes | yes | `GET /api/hr/property/mine` answered a list |
| App support | yes | yes | yes | yes | `GET /api/support/tickets/mine` answered |
| Library | yes | yes | yes | yes | `GET /api/library` answered |
| Approve supplies | if they hold approve_supplies | same | same | same | `canDecide`, or the permissions route (2920-2931) |
| Workspace | no | no | yes | yes | role, and `GET /api/workspace/projects` answered (2975) |
| Field kit (seven tiles) | no | no | yes | yes | role alone (881) |
| Issues list and its sheet | no list (PORT-31) | no list | yes | yes | role (7691-7716) |
| Assign, Reassign | no | no | yes | yes | the API's `actions`, else role (7053-7061) |
| Start an inspection, + Schedule | no | only when the permissions route answers 404 (PORT-74) | yes | yes | manage_inspections |
| Chat, New message | no | no | yes | yes | role and `GET /api/chat/people` (5714, 5728) |

The lead sees exactly what a laborer sees; an admin and a supervisor see the same portal, and nothing in it is admin-only. Shown that the API refuses: Start an inspection for the lead on an API with no permissions route; Speak Up for staff if /api/hr-cases is guarded literally (PORT-09). Allowed and hidden: a laborer's own issues (PORT-31); the field kit's Periodic work at a reference site shows more than it should (PORT-40). **Pay:** nothing in src/App.js reads or draws a pay figure (no hourlyRate, payRate, wage, salary, laborCost or cost); the only pay-like line is an overtime warning in hours about the person's own claim (16623). The stub serves no pay figure to anyone, and from this pull request on the suite and the smoke fail if any case's answer carries one to someone without manage_employment. The replies the portal keeps whole, which the API must keep pay out of: `GET /api/auth/me` (2210), `GET /api/users/profile/me`, `GET /api/sites/:id`'s staff rows (feeding Assign and Issue PPE, 7107 and 15575-15577) and /api/pickups. A person's phone, email, badge and employee id show on their own Profile alone (17988-17998); every people picker carries names only.

Checked in the harness at 390 and 320 wide in English and Spanish by the smoke (a cleaner's run, the workspace and the field kit for a supervisor, signing, pickers) and at 375 wide at every text size by the full suite, now with the eight places above in sessions of their own.

### Part 6. The field staff day

| Step | On main today |
|---|---|
| Sign in with a given PIN | works; a 403 `auth.mustSetPin` opens Choose your PIN (2233, 2262, 3945) with the weak-PIN rule (1192) |
| First-day training | a card on Home only; nothing opens by itself and nothing is gated (2471-2477): contract 2.12 holds |
| Start Shift at a site with two shifts | the API's suggested shift is chosen ("Chosen by the time you started") and confirmed on a sheet (5165-5170); smoke "Timed site schedules" |
| Check off and uncheck | works, with the queue for no signal (2538-2600); only the checker can uncheck (403 `NOT_YOUR_CHECK`, 2567), but a coworker's check still offers Uncheck Task (PORT-62) |
| Report an issue with an iPhone photo | works on good signal; full-size upload (PORT-27), wiped on a failed send (PORT-01) |
| A form left half done | picked up from Home's card (7410-7445) and Save and finish later (13517-13525); per person only through a client filter (PORT-37) |
| Sign something from the office | Home's card and the signature_request notice open the signing screen (10284); smoke "Sign on your own phone" |
| Help in Spanish | every request carries the screen's language (src/App.js:32-35); smoke "a cleaner's run (es)" |
| At a reference site | the list reads with no box, no percentage and no count; Home's bar, the Tasks card and period counts and block Overdue are hidden; a refused check turns into the list to read (smoke "A task list to read"). Not covered: the field kit's Periodic work (PORT-40) and the periodic_overdue notice (PORT-10) |

### Part 8. Sign-in and session end

- **Token expiry mid-shift or mid-form:** any 401 signs the person out (PORT-17). The sign-in card is blank, with no line saying why; unsaved work is lost except the check-off queue and form parts already saved; the person signs in with badge, phone or email and PIN, and a remembered office phone skips the code; only queued check-offs go after; the tap that met the 401 does not; the person lands on Home. There is no token_version or refresh in the front, and a 401 for an older token is ignored (3138).
- **Lockout:** the API's 429 `auth.locked` sentence is shown as sent; in the stub "Too many tries. Wait {minutes} minutes, then try again." and "Demasiados intentos. Espere {minutes} minutos y vuelva a intentarlo." Under it, and from the third wrong try, the portal adds "After too many wrong tries, sign-in stops for a while. Ask your supervisor for help." in both languages (src/words.js:116, src/App.js:3560). It says what to do next; whether a supervisor can unlock an account is the API's and the dashboard's.
- **Weak PIN:** PORT-08.

### Part 9. Notices and push

Every bell tap and every push tap goes through `notifPlace` (src/App.js:10975), so they open the same place; a push with a window open tells it (`ocsa-open`), and with none opens `/?open=<type>:<id>`. The `everynotice` journey taps one of each on a supervisor's bell in both languages.

| Type | A tap opens |
|---|---|
| chat, chat_mention | Chat, on that chat |
| client_request | Report (Issues for a supervisor), with the request open |
| customer_concern | nothing; Open in the dashboard (PORT-10) |
| document_to_sign | My training, on the document |
| issue, issue_assigned, issue_escalated, inspection_finding | the issue's sheet |
| periodic_overdue | nothing (PORT-10) |
| shift_assigned and any other shift_* | My Schedule, at the week (the shift itself is one tap further) |
| shift_drop, shift_claim | Pickup |
| support_ticket | nothing (PORT-10) |
| support_ticket_new | Open in the dashboard (office) |
| time_off | My Schedule, at the week (the request itself is one tap further) |
| hr_case_assigned, _escalated, _filed, _due_soon, _overdue | Open in the dashboard (PORT-14) |
| task_assigned | Tasks, on that task when the open shift holds it |
| training_assigned, training_session, other training_* | the top of My training, which may be empty (PORT-30) |
| site_assigned | Home |
| workspace_member | Open in the dashboard (PORT-70) |
| inspection_unfinished and any inspection_* | Inspect, on that inspection |
| a type the portal does not know | marked read and left on the bell; a push opens the bell; nothing breaks (`everynotice`) |

A tap never asks for sign-in while the token is under 12 hours old; after that it asks first and then opens the item, and after a 401 it lands on Home (PORT-17). **Permission** is asked only inside `turnOnPhoneAlerts` (src/App.js:1508; `requestPermission` at 1512, `subscribe` at 1520, both before its first await, so inside the tap), from two taps: Turn on on the first-sign-in card and Turn on alerts on this phone in Settings. **Without push** a person gets the bell, polled every 60 seconds while the app is in front, and no toast (PORT-29). **A locked phone** shows the API's title and body as sent (PORT-13). **Every address src/ builds:** one hard-coded host, the API fallback (src/App.js:7). Everything else is relative or read: canonicalRedirect.js from its two names; `notifOffOrigin` against `window.location.origin` (11021-11025); a notice's own link from the API (11129); blob addresses (571-575); the concern link's `concernUrl` from the API (12112); mailto and tel (3519, 12028); `PUBLIC_URL` paths (114, 430-431, 6467); the Home Screen sheet copies `location.href` (HomeScreenPrompt.js:131); sw.js uses `self.location.origin` and a relative `/?open=`. Nothing is built on STAFF_APP_ORIGIN, admin.ocsaco.com, staff.ocsaco.com or the vercel.app address: the portal never builds a link to another app, it opens the one the API sent.

### Part 12. Photos and files

| Upload | Where (src/App.js) | Prepared on the phone | Phone's check | While slow | App closed | Over the limit |
|---|---|---|---|---|---|---|
| Issue report photo | 7695, 7708 | none | 10 MB raw | Uploading..., button off | lost | "Photo must be under 10MB" |
| Issue sheet resolve photo | 7074, 7085 | none | 10 MB raw | Uploading... | lost | same |
| Assigned resolve photo | 7266-7267 | none | 10 MB raw | Uploading... | lost | same |
| Client request Done photos | 7631-7650 | HEIC to JPEG, 2000 px, 0.85 | none | Sending | lost | the API's words |
| Form photo question | 13327-13345 | same | count only (six by default) | per photo | kept in the server draft | the API's words |
| Inspection photos | 17031-17052 | same | six a card, ten a walk | busy tile | addresses kept on the phone | the API's words |
| Inspection photo, older answer | 17016, 17461 | none | none | Uploading... | lost | "Upload failed" |
| Help photos | 281-302, 6576-6600 | 1568 px JPEG, down to 5 MB, no HEIC | three photos | status on each | lost | "Choose a JPEG or PNG" |
| Profile photo | 17910-17929 | 800 px, 0.85, no HEIC | 20 MB raw | "..." over the avatar | lost | "Photo must be under 20MB" |
| Request page (public) | 12140-12164 | HEIC to JPEG, 2000 px | three | Send waits | lost | the API's words |
| Concern and customer forms (public) | 13299-13322 | same | the form's limit | busy | lost | the API's words |
| App support screenshot | 14309-14331 | same, as a data URL | none (PORT-32) | Send waits | lost | "This photo could not be read" |
| Workspace file (office) | 15136-15160 | photos prepared, documents raw | 25 MB | Uploading... | lost | "over 25 MB" |
| Equipment tag out photo | 15293-15308 | HEIC to JPEG, 2000 px | none | sending | lost | "The photo did not upload" |
| Signatures | 11698-11712 | PNG, shrunk under 300 KB | 300 KB | | lost | |

heic2any loads only when a HEIC is picked (src/App.js:333). A double tap on a photo send is held by a disabled button everywhere but Assigned's Can't resolve and In Progress (PORT-60).

### Part 13. Errors you cannot see

One boundary, `LastResort` (src/App.js:1907-1926), wraps the whole app: a crash shows "Something went wrong on this screen." / "Algo salio mal en esta pantalla." with Reload / "Volver a cargar", in the stored language and theme, and logs to the console alone. No error tracking (PORT-45). The battery's catch line finds 106; the ones that hide a real failure are in Appendix G. With the API down at load: a stored session shows "You are still signed in. The app tries again on its own." with Try again and retries every 15 seconds, or opens the kept checklist when a shift was open in the last 24 hours; sign-in says "Could not reach OCSA. Check your connection and try again."; Home's sites say "Your sites did not load." with Try again, and a failed status read shows the person off shift (PORT-25); Tasks says "Your tasks did not load."; Schedule says "This list did not load." and hides or empties time off (PORT-26); Forms shows a lasting line with Try again and loses Unfinished forms (PORT-55); Help keeps the question and reads a dropped answer back; Chat says "Your chats did not load. Try again in a minute." and a chat's messages show blank (PORT-54); Issues shows staff the form alone and supervisors "This list did not load."; Supplies says "This list did not load." The full suite's `listfaults` journey proves eight of these lists.

### Part 14. Time

Every date-only value the portal reads is taken as a calendar day, never as midnight UTC: shift dates by slicing the text (src/App.js:4123, 4134), time off by `localDay` (694, 746), due dates by `dueDayText` (710; 5346, 7287), training expiry (8636), inspection dates (1018, 4004), hire date and birthday (17908), workspace due dates (14442), pickups (16593, 16775), the day sheet (4429) and equipment service dates (15241). The full suite's clock (9:30 PM in New York, already the next day in UTC) holds that. "Today" comes from three places: the API (the checklist day, Scheduled Today, due states), the company clock (blocks, Done today, an inspection's day) and the phone's clock (Schedule, time off, Home): PORT-51. The 4:00 AM change is the API's; the portal compares the list's `checklistDay` with each completion's (5013-5025). The shift by start time is the API's `suggested`, confirmed by the person. On Nov 1, 2026: weeks are built with setDate (4013-4015, 4055, 4110-4111) and land on midnight; Time on Site is a difference of times and reads true hours; nothing adds 24 hours of milliseconds for tomorrow. What remains is the API's day boundary (PORT-07) and the repeated hour's Now block (PORT-52).

### Part 15. Issues and assigned tasks, as on main today

- Report (laborer and lead): the client request and inspection finding sections when the person is assigned one, and the report form; no issue rows (PORT-31).
- Issues (supervisor and admin): the newest 20 (PORT-38); every row is tappable (`data-issue-row`, 7716) and opens its sheet, which offers In Progress, Resolved and Cannot Resolve for the person's own issues and Assign or Reassign for managers, so the work can be done from here. A finding is listed twice (PORT-39).
- Assigned: each item once, by issue (7225-7253); an issue, finding or request opens its own sheet, a plain task the old detail.
- The bell: every issue notice opens its sheet directly (10969, 2743).
- Unfinished forms: saved on the server only; Home's card; per person only through the client filter (PORT-37); the reminder is the API's job.
- The owner's Oct 7 note today: "not tappable" and "only from Assigned" stopped being true with Step 297; the overlap remains for findings, and laborers have no list.

### Part 16. Words, the guide and large text

- Keys with no Spanish: 5 (PORT-11), now caught by the suite. The suite's word count reads 1,130 words written through `tr()` or a helper.
- French: 1,317 of 1,317 keys have French (a count only, as asked).
- src/words.js against translation/portal_words.csv: 0 keys in one and not the other, 0 values that differ, in Spanish and in French.
- Written warning: the portal says only "amonestacion" (5 keys, 5 CSV rows, 2 guide lines); "advertencia" appears nowhere. "insumo": 0.
- CIMS: 0 in src/, public/, guide/, translation/ and scripts/; the stub's field name `cims_category` is never drawn.
- Guide entries whose steps no longer match: "Use the bottom bar and More" step 2 and "What Home shows" steps 2 and 3 (PORT-12); "Open the field kit" step 3 (PORT-44); "What Home shows" step 2 and "See everything assigned to you" step 4 name Report where supervisors see Issues, and "Work an issue from its sheet" names a reporter who has no row (PORT-69). The other 118 entries match: every bold name is still drawn on its screen in the order the steps give. 197 bold names are the API's words (form questions and refusals) and were checked against guide/check-allow.txt only.
- People pickers: no `<select>` lists people. SearchPick at 7202, 7617, 15093, 15642, 16560 and 17444; Chat's tag, New message, Speak Up and the form person question carry their own search. The one list of names with none is Chat's private row (PORT-43).
- Large text: PORT-35 and PORT-36. Of 478 buttons, all but 19 carry a 44 px floor in their style and those 19 reach it through padding; quantity buttons are 36 px circles inside 44 px frames. The full suite's too-small rows are in known.json.

### Part 20. Anything else a cleaner should not meet this week

- **PORT-15, the upload route's bucket.** Not asked about, and the one that could undo the storage work the chat did on Oct 14 and 15: a person with a staff sign-in names the bucket each upload goes to.
- **PORT-07, the night of Nov 1.** The night crew's list may reset an hour early, 17 days from now, and only the API can say.
- **PORT-22, Spanish at Largest.** The cleaners most likely to use the largest text in Spanish are the ones a hidden Next sends out of a form, losing the page.
- **PORT-06, End Shift in a basement.** Hours are paid from these times; a shift ended underground ends when the person next has signal.
- **PORT-47 and PORT-48.** A preview build quietly talks to production, and the toolchain gets no fixes; neither hurts a cleaner today, both make the next mistake easier.

## What this contract got wrong

- **src/App.js is 18,048 lines** on main (sections 0 and 4 give 18,015); CLAUDE.md still says about 12,600.
- **CLAUDE.md carries no pause line.** Section 0 quotes CLAUDE.md as saying "The full npm run audit stays as it is and is not run"; this repository's CLAUDE.md never mentions `npm run audit`. The pause is in audit/README.md ("The owner paused this suite in late September").
- **"The staff app's service worker asks the network first for every request"** (section 4): it handles only navigations to `/` and `/sds` and the files those pages name; every other request, the API's among them, goes past it untouched (Appendix C).
- **There is no in-app toast for a new notice** (part 9 asks about one): a new notice only raises the bell's count (PORT-29).
- **"advertencia" and "amonestacion" both used for a written warning** (section 4, both fronts): the portal uses "amonestacion" alone; "advertencia" appears nowhere in src/, translation/ or guide/. The "22 keys missing, 40 extra" word drift is the dashboard's; in the portal, src/words.js and the CSV match key for key in Spanish and French.
- **Part 7's offline switch**: `context.setOffline(true)` does not stop a request the harness routes to the stub, since Playwright's route answers before the network is consulted. The weak-signal journeys set the stub's own `offline` switch beside it, which is what makes the signal really go.
- **Part 17's jscpd line** reads no App.js at all under jscpd's default size cap, so it reports 0 clones for the file where every duplicate lives; it needs `--max-size 10mb`.
- **Section 3's notice list** says hr_case_*, task_assigned and the rest are "not yet seen on live"; the portal already routes every one of them (Step 336), and the three that open nothing in the portal (support_ticket, periodic_overdue and customer_concern) are among the ones written on live.
- **Part 9 "every place src/ builds an address" against rule 2.6's STAFF_APP_ORIGIN**: the portal builds no link to itself or to the dashboard; it opens the link the API sent, so STAFF_APP_ORIGIN is entirely the API's to get right.

## What this session could not check, and what it would need

- **The API's own code** (ocsa-api is not in this session): Speak Up's access to /api/hr-cases (PORT-09), Step 124's day boundary (PORT-07), whether reset and register refuse a weak PIN (PORT-08), the upload route's bucket allow list and byte limit (PORT-15, PORT-27), the issue and time off routes' answer to a repeat (PORT-01), the token's lifetime and any refresh (PORT-17), the drafts route's field name and filter (PORT-37), periodic work at a reference site (PORT-40), the push words for each type (PORT-13), what the profile read returns (PORT-18) and which capability each refusal names. The ocsa-api audit session can answer each from its routes.
- **Live headers and Vercel's settings**: what staff.ocsaco.com sends today, whether the build command is `npm run build` (without it version.json is missing and no phone ever updates by itself), and whether `REACT_APP_API_URL` is set. The chat checks these (contract 7).
- **A real iPhone**: the lock screen's preview, push on a Home Screen app, Larger Text, HEIC from the camera and the photo library, and an app left open for days. The harness plays an iPhone's user agent in Chromium, which is not WebKit.
- **The guide pictures**: `npm run shots` was not run (about fifteen minutes, and it writes into public/, which this round may not change).
- **Load**: nothing here measures the API at 100 users; the portal's own growth limits are PORT-38 and PORT-43.
