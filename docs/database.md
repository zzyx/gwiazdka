# Database

How to connect to each Gwiazdki database, what its tables mean, and how to look at the data safely. For the words (Task, Check-off, Approval, Contract…) see [`CONTEXT.md`](../CONTEXT.md); for how the app uses the database see [`architecture.md`](architecture.md).

There are three databases, all Supabase Postgres:

| Database | What it holds | Where it lives |
|---|---|---|
| **Gwiazdki** (production) | The real family | Supabase, eu-west-1 |
| **gwiazdka-preview** | The fake family from `supabase/seed.sql` (parent `parent@example.com`, children Ola and Kuba) | Supabase, eu-west-1 |
| **Local** | The same fake family, rebuilt whenever you like | Docker on your machine, from `npx supabase start` |

The schema is the same in all three: the files in `supabase/migrations/`, applied in date order.

## Connecting

### Supabase dashboard (production and preview)

Open [supabase.com/dashboard](https://supabase.com/dashboard) and pick the project, **Gwiazdki** or **gwiazdka-preview**.

- **Table Editor** shows each table as a spreadsheet. Pick the `public` schema. It is the quickest way to look at a few rows, and it also lets you edit cells, so read the [warning](#changing-production-by-hand) first.
- **SQL Editor** runs any SQL. The [queries below](#ready-to-paste-queries) are written for it. It runs as the `postgres` role, which **ignores Row Level Security**: you see every family's rows, and writes skip the checks the app relies on.
- **Storage** → `day-photos` shows the Photos of the day as files.
- **Authentication** → **Users** lists the accounts: the parent's email account, and one account per child who has joined on a phone.

### psql or a GUI client (TablePlus, Postico, DBeaver)

Click **Connect** at the top of the project's dashboard. It shows ready-made connection strings. Use the **Session pooler** one:

- Host `aws-…-eu-west-1.pooler.supabase.com`, port `5432`, database `postgres`.
- User `postgres.<project ref>`: `postgres.umttcwcndpftdcdmmgzf` for production, `postgres.ynvogjwcsypgicsjgsfz` for the preview.
- Password: the project's **database password**. Production's is in the parent's password manager (set up in #2 and #20); it is the same value as the `SUPABASE_PROD_DB_PASSWORD` GitHub secret. The preview's matches `SUPABASE_PREVIEW_DB_PASSWORD`. Forgot it? **Project Settings** → **Database** → **Reset database password**, then update the GitHub secret too, or the migration workflows stop working.

Why the session pooler: the **Direct connection** (`db.<ref>.supabase.co`) is IPv6 only on the free plan, and most home networks are IPv4. The **Transaction pooler** (port `6543`) is meant for serverless code and gets in the way of interactive sessions.

```sh
psql "postgresql://postgres.umttcwcndpftdcdmmgzf:<password>@aws-…-eu-west-1.pooler.supabase.com:5432/postgres"
```

Copy the host from the **Connect** dialog rather than from here; the `aws-…` prefix is set by Supabase. In TablePlus, create a PostgreSQL connection with the same fields and turn on SSL (mode `require`). TablePlus's **Safe mode** (in the connection's settings) asks before running anything that writes, which is a good idea for production.

Like the SQL Editor, this connection is the `postgres` role and ignores Row Level Security.

### Local

With Docker running, from the repository:

```sh
npx supabase start     # starts the local stack and prints its URLs and keys
npx supabase status    # prints them again later
```

- **Studio** (the local dashboard, with Table Editor and SQL Editor): <http://localhost:54323>
- **Postgres**: `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- Reset to a clean database: `npx supabase db reset` re-runs every migration, then `supabase/seed.sql`.
- Run the pgTAP tests: `npx supabase test db`.

The local stack is the place to try SQL you're not sure about. Nothing you do there reaches production or the preview.

## Tables

Everything the app stores is in the `public` schema. Stars and money are never stored while a Contract is open; they are counted from Approvals and Weekly bonus decisions every time.

```mermaid
erDiagram
  AUTH_USERS["auth.users"] {
    uuid id PK
    text email
  }
  families {
    uuid id PK
    timestamptz created_at
  }
  parents {
    uuid user_id PK,FK
    uuid family_id FK
  }
  children {
    uuid id PK
    uuid family_id FK
    uuid user_id FK "null until joined"
    text name
  }
  join_codes {
    text code_hash PK
    uuid child_id FK
    timestamptz expires_at
    timestamptz used_at
  }
  tasks {
    uuid id PK
    uuid child_id FK
    text name
    text icon
    int position
    date active_from
    date active_until "null = still on the list"
  }
  contracts {
    uuid id PK
    uuid child_id FK
    date starts_on
    date ends_on
    int grosze_per_star
    int weekly_bonus_stars
    date closed_on "null = open"
  }
  check_offs {
    uuid task_id PK,FK
    date day PK
    timestamptz created_at
  }
  approvals {
    uuid task_id PK,FK
    date day PK
    bool approved
    timestamptz decided_at
  }
  weekly_bonuses {
    uuid contract_id PK,FK
    date week_of PK "a Monday"
    bool granted
    timestamptz decided_at
  }
  payouts {
    uuid contract_id PK,FK
    date paid_on
    int task_stars
    int bonus_stars
    int amount_grosze
    int not_counted
    date planned_ends_on
  }
  day_photos {
    uuid child_id PK,FK
    date day PK
    timestamptz added_at
  }

  families ||--o{ parents : has
  families ||--o{ children : has
  AUTH_USERS ||--o| parents : "signs in as"
  AUTH_USERS |o--o| children : "signs in as"
  children ||--o{ join_codes : "gets"
  children ||--o{ tasks : "has on their list"
  children ||--o{ contracts : has
  children ||--o{ day_photos : adds
  tasks ||--o{ check_offs : "checked off on a day"
  tasks ||--o{ approvals : "decided on a day"
  contracts ||--o{ weekly_bonuses : "judged per week"
  contracts ||--o| payouts : "closed by"
```

| Table | One row is | Worth knowing |
|---|---|---|
| `families` | A family | Only an id. Everything else hangs off it. |
| `parents` | A parent's account in a family | `user_id` is the parent's `auth.users` account (email + password). |
| `children` | A child | `user_id` is empty until the child joins on their phone with a Join code; then it is their own `auth.users` account. |
| `join_codes` | A Join code the parent issued | Only a SHA-256 hash of the code is kept. Works once, for 15 minutes; `used_at` is set when redeemed. Nobody reads this table through the app's API. |
| `tasks` | A Task on one child's list | Counts on School days from `active_from` up to, not including, `active_until`. Editing the list never deletes a Task with history: a dropped Task gets an `active_until`, so old days keep their Tasks. `icon` is a short name (`tooth`, `book`…). `position` is the order on screen. |
| `contracts` | A child's Contract | `grosze_per_star` is the rate in grosze (50 = 0.50 zł). `weekly_bonus_stars` is the Weekly bonus size. `closed_on` is empty while open. The database allows one open Contract per child and no overlapping dates. |
| `check_offs` | A child's Check-off of one Task on one day | Deleting the row is how the child undoes it. |
| `approvals` | The parent's decision on one Task on one day | `approved` true earns a Star, false is a rejection. A row can exist without a Check-off: the parent may approve a Task the child didn't check off. |
| `weekly_bonuses` | Grant or No bonus for one week of a Contract | `week_of` is the Monday. Only the decision is stored; a granted week is worth the Contract's current `weekly_bonus_stars`. |
| `payouts` | The Payout that closed a Contract | Written once, by Close & pay out. It freezes what was paid: `task_stars`, `bonus_stars`, `amount_grosze`, and `not_counted` (Check-offs still waiting at closing, which counted as 0). `planned_ends_on` is the end date before an early close. |
| `day_photos` | A child's Photo of the day | The picture itself is the file `day-photos/<child_id>/<YYYY-MM-DD>.jpg` in Storage; this row says it exists. The Payout deletes the rows and the files. |

A day is always a `date` in Warsaw time. Check-offs, Approvals and photos exist only for School days (Monday to Friday) inside the child's open Contract.

### The view

- **`star_balances`**: one row per open Contract with `stars` (the whole balance), `task_stars` and `bonus_stars` (its two parts) and `grosze_per_star`. The money is `stars * grosze_per_star`. It is computed on every read and respects RLS, so a child sees only their own row.

### Functions the app calls (RPCs)

The app writes Contracts, Payouts, Weekly bonuses and Join codes only through these. Each checks the rules and that the caller is the child's parent. The tables themselves are read-only through the API.

| Function | Does |
|---|---|
| `issue_join_code(child)` | Makes a new Join code for a child, cancelling any unused one, and returns it. |
| `redeem_join_code(code)` | Marks a code used and says which child it's for. Only the server's secret key may call it. |
| `create_contract(child, starts, ends, rate, bonus, tasks)` | Opens a Contract and sets the child's Task list. |
| `update_contract(contract, starts, ends, rate, bonus, tasks)` | Changes an open Contract and its Task list (list changes count from tomorrow). |
| `close_contract(contract)` | Close & pay out: counts the Stars and bonuses, writes the `payouts` row, freezes the Contract, deletes its photo rows. |
| `decide_weekly_bonus(contract, week_of, granted)` | Grant or No bonus for a week, from its Friday, while the Contract is open. |

### The `private` schema

Helpers that the policies and functions use; the API can't call them directly.

- **Who is asking:** `my_family_id()` (the signed-in parent's family), `my_child_id()` (the signed-in child), `visible_child_ids()` (the children the caller may see), `is_my_child(child)`.
- **Time:** `clock()` is `now()`, and the pgTAP tests replace it to freeze time. `today()` is today's date in Warsaw. `check_off_deadline(day)` is 22:00 Warsaw time the next day. `is_school_day(day)` is Monday to Friday.
- **Rules:** `child_may_check_off`, `parent_may_decide`, `child_may_change_photo`, `parent_may_remove_photo`.
- `save_task_list` is the shared part of `create_contract` and `update_contract`; `forget_paid_out_photos` is the trigger that deletes photo rows at the Payout.

You can call them from the SQL Editor: `select private.today();`

### Storage

One private bucket, **`day-photos`**: JPEGs up to 1 MB, named `<child_id>/<YYYY-MM-DD>.jpg`. Policies on `storage.objects` follow the same rules as the `day_photos` table: the child and their parent can see a file, the child uploads, replaces and removes it until the deadline, and the parent removes it after the Payout. The app shows pictures through one-hour signed URLs.

## Who sees what: Row Level Security

The app talks to the database with the signed-in person's session, never with an all-powerful key (the one exception is redeeming a Join code). Every table has RLS switched on, and its policies decide what that person may read and write:

| Table | A parent may | A child may |
|---|---|---|
| `families`, `children`, `tasks`, `contracts`, `payouts`, `weekly_bonuses`, `day_photos` | read their own family's rows | read their own rows |
| `parents` | read their own row | nothing |
| `check_offs` | read | read, and add or remove their own: a School day of their open Contract, not in the future, before 22:00 the next day, and not yet decided |
| `approvals` | read, and add, change or remove them: a School day of the open Contract, up to today | read |
| `day_photos` | read | read, and add, replace or remove their own photo within the same window as Check-offs |
| `join_codes` | nothing (only through `issue_join_code`) | nothing |

Other families' rows are invisible to everyone. Anything not listed is refused. The pgTAP tests in `supabase/tests/database/` pin these rules down, one file per area.

Remember that the dashboard and a `postgres` connection skip all of this. To see the data the way the app sees it for one person, run a query as them inside a transaction (the [last query below](#see-what-one-person-sees) does this).

## Ready-to-paste queries

All of these only read. Paste them into the SQL Editor (production or preview) or local Studio. Where a query takes a child's name, change it in the first line.

### The family

```sql
select c.name as child, u.email as parent, c.user_id is not null as joined_on_phone
from public.children c
join public.parents p on p.family_id = c.family_id
join auth.users u on u.id = p.user_id
order by u.email, c.name;
```

### Open Contracts and their balance

```sql
select ch.name as child, c.starts_on, c.ends_on,
       (c.grosze_per_star / 100.0)::numeric(10,2) as zl_per_star, c.weekly_bonus_stars,
       b.task_stars, b.bonus_stars, b.stars,
       (b.stars * c.grosze_per_star / 100.0)::numeric(10,2) as zl_so_far
from public.contracts c
join public.children ch on ch.id = c.child_id
join public.star_balances b on b.contract_id = c.id
where c.closed_on is null
order by ch.name;
```

### A child's week

Each Task against Monday to Friday of this week: `✓` approved, `✕` rejected, `…` checked off and waiting, blank for nothing. Change `monday` to `private.today() - 7` for last week.

```sql
with params as (
  select 'Ola'::text as child,
         date_trunc('week', private.today())::date as monday
),
cells as (
  select t.position, t.name as task, d.day,
         case when a.approved then '✓'
              when not a.approved then '✕'
              when k.task_id is not null then '…'
              else '' end as state
  from params p
  join public.children ch on ch.name = p.child
  join public.tasks t on t.child_id = ch.id
  cross join lateral generate_series(p.monday, p.monday + 4, interval '1 day') g(d)
  cross join lateral (select g.d::date as day) d
  left join public.check_offs k on k.task_id = t.id and k.day = d.day
  left join public.approvals a on a.task_id = t.id and a.day = d.day
  where d.day >= t.active_from and (t.active_until is null or d.day < t.active_until)
)
select task,
       max(state) filter (where extract(isodow from day) = 1) as mon,
       max(state) filter (where extract(isodow from day) = 2) as tue,
       max(state) filter (where extract(isodow from day) = 3) as wed,
       max(state) filter (where extract(isodow from day) = 4) as thu,
       max(state) filter (where extract(isodow from day) = 5) as fri
from cells
group by position, task
order by position;
```

### Check-offs waiting for a decision

```sql
select ch.name as child, k.day, t.name as task, k.created_at
from public.check_offs k
join public.tasks t on t.id = k.task_id
join public.children ch on ch.id = t.child_id
where not exists (select 1 from public.approvals a where a.task_id = k.task_id and a.day = k.day)
order by ch.name, k.day, t.position;
```

### Weekly bonus decisions in open Contracts

```sql
select ch.name as child, w.week_of,
       case when w.granted then 'Grant +' || c.weekly_bonus_stars else 'No bonus' end as decision,
       w.decided_at
from public.weekly_bonuses w
join public.contracts c on c.id = w.contract_id
join public.children ch on ch.id = c.child_id
where c.closed_on is null
order by ch.name, w.week_of desc;
```

### Today's photos

```sql
select ch.name as child, d.day, d.added_at,
       o.name as file, (o.metadata->>'size')::int / 1024 as kb
from public.day_photos d
join public.children ch on ch.id = d.child_id
left join storage.objects o
  on o.bucket_id = 'day-photos' and o.name = d.child_id || '/' || d.day || '.jpg'
where d.day = private.today()
order by ch.name;
```

### Past Contracts and their Payouts

```sql
select ch.name as child, c.starts_on, c.ends_on, p.paid_on,
       p.task_stars, p.bonus_stars, p.not_counted,
       (p.amount_grosze / 100.0)::numeric(10,2) as zl_paid
from public.payouts p
join public.contracts c on c.id = p.contract_id
join public.children ch on ch.id = c.child_id
order by p.paid_on desc;
```

### See what one person sees

Runs a query as a child (or parent) with RLS applied, then undoes the role change. Put the person's account id in `sub`: a child's is `children.user_id` (empty until they have joined on a phone), a parent's is `parents.user_id`. Without a valid `sub` the query sees nothing.

```sql
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select user_id from public.children where name = 'Ola'),
                    'role', 'authenticated')::text, true);
set local role authenticated;

select * from public.star_balances;   -- or any other read
rollback;
```

## Changing production by hand

Don't, unless there is no other way. The app is the safe way to change data: every write goes through a policy or a function that checks the rules. The dashboard's Table Editor, the SQL Editor and a `postgres` connection skip all of those checks, so a hand edit can make things the app would never allow (a Check-off on a Saturday, an Approval in a closed Contract, a second open Contract, a Payout that doesn't match its Stars).

- **Deleting cascades.** Deleting a child removes their Tasks, Contracts, Check-offs, Approvals, Weekly bonuses, Payouts and photo rows. Deleting a family removes everyone in it.
- **Never change the schema by hand** (tables, columns, policies, functions). Production's schema changes only through a migration merged to `main`; a hand change makes the next migration fail or silently differ from the code.
- **Photo rows and files go together.** Deleting a `day_photos` row leaves the file in Storage, and the other way round.
- If you really must, try it on the local stack first, then run it in production inside `begin; … rollback;` to see what it touches, and only then with `commit`. Don't count on a backup to undo a mistake: restoring one, where the plan has any, rolls back the whole database.

The one expected hand edit is adding the real family once, from `supabase/production-family.example.sql` (below).

## How migrations, the seed and the family template fit together

| File | What it is | Where it runs |
|---|---|---|
| `supabase/migrations/*.sql` | The schema, one file per change, in date order. Never edit one that has been merged; add a new one. | Local (`supabase start`, `db reset`), CI's throwaway database, the preview when a PR touches `supabase/`, and production on merge to `main` (Production database workflow). |
| `supabase/seed.sql` | The fake family (parent `parent@example.com` / `password`, children Ola and Kuba, open Contracts, a few decided days). | Local after migrations, and the preview via `db push --include-seed`. **Never production.** |
| `supabase/production-family.example.sql` | A template for adding the real family: parent account, children, Tasks, Contracts. | Production, once, pasted by hand into the SQL Editor after creating the parent's account in **Authentication** → **Users**. Never commit the filled-in copy. |
| `supabase/tests/database/*.test.sql` | pgTAP tests of the rules, sharing `_fixtures.psql`. | Local (`npx supabase test db`) and CI, each on a database that is thrown away. |

To add a migration: `npx supabase migration new <name>`, write the SQL, check it with `npx supabase db reset` and `npx supabase test db`, and open a PR. Keep it safe for the rows already in production, and remember the app deploy and the migration start at the same time (see [Deploy flow](architecture.md#deploy-flow)).
