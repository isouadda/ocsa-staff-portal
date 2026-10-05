# The Help guide for the staff portal

`APP-PORTAL.md` is the staff portal's app guide: the steps Help reads
when someone asks how to do something in the portal. It lives here, beside
the screens it describes, so the pull request that changes a screen changes
its entry too.

## The format

The first line is the document's code and title:

```
# APP-PORTAL | App guide: staff portal
```

Then one entry per task. An entry starts at a line `## <entry title>` and
runs to the next such line. Inside it, in this order:

```
## <entry title>
Who can do this: <who>
1. <step>
2. <step>
If it does not work: <what goes wrong and what to do>
Words people use for this: <the words someone might ask with>
Last checked: YYYY-MM-DD
```

A name the screen shows is written in bold, in English, then in Spanish
in brackets, then in French in brackets, exactly as
`translation/portal_words.csv` has the row (Step 244; Help reads the
third name as what a French screen shows):

```
**Submit report** (**Enviar reporte**) (**Envoyer le rapport**)
```

The CSV is the word table the portal draws from, so the guide names each
button and heading the way the screen says it, in all three languages.
A name the API serves, which has no row in the CSV, is listed in
`guide/check-allow.txt` with its French: the French the API answers a
French screen with since Step 241, read from ocsa-api's
`translation/api_words.csv` for its own words and from the form's
`forms_*_french.csv` sheet for a form's words (Step 249). The guide file
itself carries Spanish and French accents on purpose; it is the one file
here, with the CSVs, written in real accented letters.

## How it reaches Help

The file loads itself into Help on every merge to `main` that changes it.
`.github/workflows/guide-sync.yml` sends it to the API, which proves the
run came from this repository's `main` branch with GitHub's own OIDC token.
No secret is stored anywhere. The job prints what changed and the
fingerprint Help holds afterwards. It can also be run by hand from the
Actions tab, with a dry run that reports the same counts and writes
nothing.

What the API does with the file:

- **Entries are matched by title.** An entry whose title Help already
  holds has its steps updated when they differ, and is left alone when
  they are the same. A new title is added.
- **Renaming a title retires the old entry and adds a new one.** Help keeps
  the retired row, so a title put back later comes back under its old
  number, with the steps the file gives it.
- **A new entry goes at the end of the file.** Help numbers a new entry
  one past the last it holds, so adding entries at the end keeps the
  file's order the same as the order Help numbers them in.
- **Removing more than three entries in one merge is refused on purpose,**
  so a stale or cut file can never empty the guide. The job fails and
  names the titles; the removals are then made by hand.
- Nothing is ever deleted. An entry taken out of the file is set inactive.

## The check on every pull request

`npm run guide-check` reads this file the way the API reads it and fails
on a first line that does not read, two entries with one title, an entry
with nothing in it, an email address or a phone number, or a bold pair
with no matching row in the CSV. A pair the CSV cannot hold goes in
`check-allow.txt` under a comment line saying why: one the screen composes
from parts, such as a line with a name filled in, or one the API sends in
both languages, such as a form's own questions. The same check runs on
every pull request. A pull request that changes `src/` and not `guide/`
gets a warning that the guide may need an entry.

This repository is public. Nothing in this folder may name a person, a
site, a phone number or an email address.

## The fingerprint when the file moved here

```
abc9c61aec0bd2d7b2faff598aceb5c8  APP-PORTAL, 73 entries, as Help held it live on 2026-09-29
```

The fingerprint is the one the API answers after a sync: the md5 of the
md5s of `<entry title>|<entry content>` for every entry, in order, run
together. It can be worked out from this file alone, and
`npm run guide-check` prints it.

The file's own md5 when it moved here was
`42bfb2a714797c5a3ad22bbf2dc814d2`.
