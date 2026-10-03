# Top-3 Vote Page

A static voting page for GitHub Pages. Visitors rank their top 3 options without signing up. Duplicate votes are blocked by cookie and by IP address.

GitHub Pages can't store data or see visitor IPs, so votes go to a free **Supabase** database.

## Files

| File | Purpose |
|---|---|
| `index.html` | Voting page |
| `thanks.html` | Confirmation page (also shown if someone has already voted) |
| `config.js` | **Edit this**: title, question, options, Supabase keys |
| `app.js` | Voting logic |
| `styles.css` | Styling (light and dark mode) |
| `supabase/setup.sql` | Database and voting function. Run once in Supabase. |

## Setup

### 1. Preview locally (optional)
Open `index.html` in a browser. With no Supabase keys set it runs in **demo mode**, which saves votes only in your browser. To vote again in demo mode, clear the site's cookies and local storage.

### 2. Create the backend
1. Create a free project at <https://supabase.com>.
2. Go to **SQL Editor → New query**, paste in `supabase/setup.sql`, then edit the block marked `EDIT THESE`:
   - `allowed_options`: the same option ids as in `config.js`
   - `max_votes_per_ip`: see the note below
   - `salt`: any long random string
3. Click **Run**.
4. Go to **Project Settings → API** and copy the **Project URL** and the **anon / publishable key** into `config.js`. The anon key is safe to make public, because it can only call `cast_vote` and can't read any votes.

### 3. Publish on GitHub Pages
1. Push these files to a GitHub repo.
2. Go to **Settings → Pages → Build and deployment**, choose *Deploy from a branch*, then `main` and `/ (root)`.
3. Your page will be at `https://<username>.github.io/<repo>/`.

### 4. See results
In Supabase, open the **SQL Editor** and run:
```sql
select * from public.results;
```
Scoring: a 1st-place pick is worth 3 points, 2nd is worth 2 and 3rd is worth 1. The query also shows how many 1st, 2nd and 3rd-place picks each option got.

To export the raw votes, use **Table Editor → votes → Export CSV**.

## How duplicate prevention works

1. **Cookie and localStorage:** each visitor gets a random ID that is stored in both places. If the browser has already voted, it goes straight to the "already voted" page.
2. **Cookie ID on the server:** the database allows each ID to vote only once.
3. **IP address on the server:** IPs are stored only as a salted hash, never in plain text. By default only one vote is allowed per IP.

**Important trade-off:** many people can share one IP address, for example a household, office, school, café wifi or mobile network. With `max_votes_per_ip = 1`, only the first person on a shared network can vote. If your audience is likely to share networks, raise the limit to around 3–5, or set it to `0` and rely on cookies alone.

No system without accounts is perfect. A determined person can use a private window plus a VPN to vote again. This setup stops casual repeat voting, which is usually what's needed.

## Changing options
1. Edit `options` in `config.js`. Each option needs an `id`, `label` and optional `description`.
2. Update `allowed_options` in `setup.sql` and run the `create or replace function` part again in Supabase.

## Privacy
You store a hashed IP and a random cookie ID. If you're in the EU, UK or Australia, it's worth adding a short note to the page, for example: "We use a cookie and a hashed IP address only to prevent duplicate votes."
