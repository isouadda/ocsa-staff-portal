OCSA Staff Portal - Claude Code Project Guide
What this is
React single-page staff-facing portal for the OCSA operations platform. Create React App (react-scripts 5, React 18). Deployed on Vercel. Talks to the OCSA API.
Build and validate (run before every commit)
* Install: npm install
* Build, the real check: npm run build must pass with no errors.
* Dev server: npm start
* Guide check: npm run guide-check must pass.
* Report the build result after any change.
Architecture
* Single file: src/App.js, about 8,600 lines.
* Design vocabulary matches the admin app: FONT_HEAD and FONT_BODY (both the phone's own system stack), the R radius scale, a full theme token set, gold glow on primary buttons, and the shared mkLabel, mkInput, mkQtyBtn helpers.
* Auth fetch helper returns parsed JSON and throws on error.
Conventions (hard rules)
* Edit src/App.js in place. Match existing tokens and helpers exactly.
* Keep parity with the admin design vocabulary. No stray fonts, for example no DM Sans.
* This app is staff-facing. Keep all copy age-appropriate and professional, and never show the word CIMS.
* ASCII only. Straight quotes. Hyphens, never dashes. Plain, direct language. No contrastive antithesis phrasing.
Help guide (standing rule)
* Every change to a screen updates guide/APP-PORTAL.md in the same pull request.
* Bold names are read from translation/portal_words.csv and written **English** (**Spanish**), exactly as the CSV pairs them.
* Last checked: on every entry touched is set to the day of the change.
* The pull request lists the entries it changed.
* A new entry goes at the end of the file. The file loads itself into Help on merge to main. See guide/README.md.
Deploy
* Push to the connected GitHub repo. Vercel redeploys automatically.
* Confirm the live portal after deploy.
Client config (template model)
* Branding comes from the API settings endpoint, not hardcoded.
* Move any hardcoded client value to settings or a single client config module. Do not add new client-specific literals.
Out of scope for this repo
* Business logic and data live in the API and the database. Keep them out of this portal.
Approval
* Scope and get approval before building. Show a diff and wait for review before committing.
