-- Ledgerly schema. Run in the Supabase SQL editor (or `supabase db push`).
create extension if not exists pgcrypto;
create type app_role as enum ('admin','airline_staff','lawyer');
create type complaint_status as enum ('pending','in_progress','resolved','escalated');
create type severity_level as enum ('low','medium','high','critical');
create type lawyer_grade as enum ('junior','mid_level','senior','corporate_firm');
create type lawyer_status as enum ('pending','approved','rejected','suspended');
create type case_status as enum ('awaiting_lawyer','active','completed','declined','expired','cancelled');
create type pay_status as enum ('initiated','held','released','refunded','failed');
create sequence complaint_seq start 1001;
create sequence case_seq start 1001;

create table airlines (
  id uuid primary key default gen_random_uuid(), name text not null, slug text unique not null, industry text,
  status text not null default 'pending_approval' check (status in ('active','pending_approval','suspended')),
  verified boolean not null default false, created_at timestamptz not null default now());
create table profiles (  -- one row per staff/lawyer/admin login; written only by the server
  id uuid primary key references auth.users on delete cascade, role app_role not null, full_name text,
  airline_id uuid references airlines, created_at timestamptz not null default now());
create table lawyers (
  id uuid primary key default gen_random_uuid(), user_id uuid unique references auth.users on delete cascade,
  full_name text not null, firm text, call_year int not null, enrolment_no text not null, bar_branch text,
  practice_areas text[] not null default '{}', requested_grade lawyer_grade not null, grade lawyer_grade,
  status lawyer_status not null default 'pending', available boolean not null default false, bio text,
  conflicts text[] not null default '{}', rating numeric(2,1) not null default 0,
  payout_bank_code text, payout_account_no text, paystack_recipient_code text, created_at timestamptz not null default now());
create table lawyer_documents (id uuid primary key default gen_random_uuid(), lawyer_id uuid not null references lawyers on delete cascade, storage_path text not null, file_name text, created_at timestamptz not null default now());
create table lawyer_prices (
  lawyer_id uuid references lawyers on delete cascade,
  service text check (service in ('Demand letter','Negotiation / mediation','Regulator petition','Court representation')),
  price_kobo bigint not null check (price_kobo > 0), primary key (lawyer_id, service));
create table platform_settings (grade lawyer_grade primary key, min_price_kobo bigint not null, max_price_kobo bigint not null, platform_fee_pct numeric(4,1) not null check (platform_fee_pct between 0 and 50));
insert into platform_settings values ('junior',1500000,4000000,20),('mid_level',4000000,10000000,15),('senior',10000000,25000000,12),('corporate_firm',25000000,75000000,10);

create table complaints (
  id uuid primary key default gen_random_uuid(),
  ref text unique not null default ('LDG-'||to_char(now(),'YYYY')||'-'||lpad(nextval('complaint_seq')::text,5,'0')),
  airline_id uuid not null references airlines, customer_name text not null, customer_email text not null, customer_phone text not null,
  flight_number text not null, flight_date date not null, route text, booking_ref text,
  category text not null, subject text not null, description text not null check (char_length(description) >= 30),
  rating smallint not null check (rating between 1 and 5), sentiment text,
  is_critical boolean not null default false, severity severity_level not null default 'low',
  status complaint_status not null default 'pending', airline_response text, resolved_at timestamptz,
  created_at timestamptz not null default now());
create index on complaints (airline_id, status);
create table complaint_events (id uuid primary key default gen_random_uuid(), complaint_id uuid not null references complaints on delete cascade, kind text not null, detail text, actor uuid, created_at timestamptz not null default now());
create table attachments (id uuid primary key default gen_random_uuid(), complaint_id uuid not null references complaints on delete cascade, storage_path text not null, file_name text, mime text, size_bytes int check (size_bytes <= 10485760), created_at timestamptz not null default now());
create table alerts (
  id uuid primary key default gen_random_uuid(), airline_id uuid not null references airlines, complaint_id uuid references complaints,
  source text not null check (source in ('customer_report','media_watch')), title text not null, level smallint not null default 1,
  acknowledged_at timestamptz, acknowledged_by uuid references auth.users, regulator_notified_at timestamptz, created_at timestamptz not null default now());
create index on alerts (airline_id) where acknowledged_at is null;

create table legal_cases (
  id uuid primary key default gen_random_uuid(), ref text unique not null default ('LGL-'||to_char(now(),'YYYY')||'-'||lpad(nextval('case_seq')::text,5,'0')),
  complaint_id uuid not null references complaints, lawyer_id uuid not null references lawyers,
  service text not null, grade lawyer_grade not null, price_kobo bigint not null, fee_kobo bigint not null, total_kobo bigint not null,
  status case_status not null default 'awaiting_lawyer', accept_by timestamptz not null default now() + interval '48 hours',
  consent_at timestamptz not null, accepted_at timestamptz, completed_at timestamptz, created_at timestamptz not null default now());
create index on legal_cases (complaint_id);
create table case_messages (id uuid primary key default gen_random_uuid(), case_id uuid not null references legal_cases on delete cascade, sender text not null check (sender in ('customer','lawyer','system')), body text not null, created_at timestamptz not null default now());
create table payments (id uuid primary key default gen_random_uuid(), case_id uuid not null references legal_cases, paystack_reference text unique not null, amount_kobo bigint not null, status pay_status not null default 'initiated', paid_at timestamptz, refunded_at timestamptz, raw jsonb, created_at timestamptz not null default now());
create table payouts (id uuid primary key default gen_random_uuid(), case_id uuid unique not null references legal_cases, lawyer_id uuid not null references lawyers, amount_kobo bigint not null, paystack_transfer_code text, status text not null default 'pending', created_at timestamptz not null default now());
create table otp_challenges (id uuid primary key default gen_random_uuid(), purpose text not null, subject text not null, code_hash text not null, expires_at timestamptz not null, attempts int not null default 0, consumed_at timestamptz, created_at timestamptz not null default now());
create table consents (id uuid primary key default gen_random_uuid(), subject_email text not null, document text not null, version text not null, ip inet, accepted_at timestamptz not null default now());
create table audit_log (id bigserial primary key, actor uuid, action text not null, entity text, entity_id text, meta jsonb, created_at timestamptz not null default now());

-- helpers used by policies (security definer so they can read profiles)
create function my_role() returns app_role language sql stable security definer set search_path = public as $$ select role from profiles where id = auth.uid() $$;
create function my_airline() returns uuid language sql stable security definer set search_path = public as $$ select airline_id from profiles where id = auth.uid() $$;
create function my_lawyer() returns uuid language sql stable security definer set search_path = public as $$ select id from lawyers where user_id = auth.uid() $$;

-- row level security: on everywhere; admin can do everything; others get narrow access
do $$ declare t text; begin
  foreach t in array array['airlines','profiles','lawyers','lawyer_documents','lawyer_prices','platform_settings','complaints','complaint_events','attachments','alerts','legal_cases','case_messages','payments','payouts','otp_challenges','consents','audit_log'] loop
    execute format('alter table %I enable row level security', t);
    if t <> 'otp_challenges' then execute format('create policy admin_all on %I for all to authenticated using (my_role() = ''admin'') with check (my_role() = ''admin'')', t); end if;
  end loop; end $$;
-- otp_challenges has no policies on purpose: only the server (service role) can touch it.
-- Customers never query the database directly: guests act through server actions after OTP.

create policy airlines_public on airlines for select to anon, authenticated using (status = 'active');
create policy airlines_own on airlines for select to authenticated using (id = my_airline());
create policy profiles_own on profiles for select to authenticated using (id = auth.uid());
create policy settings_read on platform_settings for select to anon, authenticated using (true);

create policy staff_read on complaints for select to authenticated using (airline_id = my_airline());
create policy staff_update on complaints for update to authenticated using (airline_id = my_airline()) with check (airline_id = my_airline());
revoke update on complaints from authenticated; grant update (status, airline_response, resolved_at) on complaints to authenticated;
create policy staff_events on complaint_events for select to authenticated using (exists (select 1 from complaints c where c.id = complaint_id and c.airline_id = my_airline()));
create policy staff_events_add on complaint_events for insert to authenticated with check (exists (select 1 from complaints c where c.id = complaint_id and c.airline_id = my_airline()));
create policy staff_files on attachments for select to authenticated using (exists (select 1 from complaints c where c.id = complaint_id and c.airline_id = my_airline()));
create policy staff_alerts on alerts for select to authenticated using (airline_id = my_airline());
create policy staff_ack on alerts for update to authenticated using (airline_id = my_airline()) with check (airline_id = my_airline());
revoke update on alerts from authenticated; grant update (acknowledged_at, acknowledged_by) on alerts to authenticated;

create policy lawyer_self on lawyers for select to authenticated using (user_id = auth.uid());
create policy lawyer_edit on lawyers for update to authenticated using (user_id = auth.uid() and status = 'approved') with check (user_id = auth.uid());
revoke update on lawyers from authenticated; grant update (bio, available, conflicts, payout_bank_code, payout_account_no) on lawyers to authenticated;
create policy lawyer_docs on lawyer_documents for select to authenticated using (lawyer_id = my_lawyer());
create policy lawyer_price on lawyer_prices for all to authenticated using (lawyer_id = my_lawyer()) with check (lawyer_id = my_lawyer());
create policy lawyer_cases on legal_cases for select to authenticated using (lawyer_id = my_lawyer());
create policy lawyer_msgs on case_messages for select to authenticated using (exists (select 1 from legal_cases k where k.id = case_id and k.lawyer_id = my_lawyer()));
create policy lawyer_msgs_add on case_messages for insert to authenticated with check (sender = 'lawyer' and exists (select 1 from legal_cases k where k.id = case_id and k.lawyer_id = my_lawyer() and k.status = 'active'));
create policy lawyer_payouts on payouts for select to authenticated using (lawyer_id = my_lawyer());
-- case status changes (accept / decline / complete) and anything touching money go through server code with the service role.

create function check_price_band() returns trigger language plpgsql as $$
declare g lawyer_grade; b platform_settings;
begin
  select grade into g from lawyers where id = new.lawyer_id;
  select * into b from platform_settings where grade = g;
  if g is null or new.price_kobo < b.min_price_kobo or new.price_kobo > b.max_price_kobo then raise exception 'Price is outside your grade band'; end if;
  return new;
end $$;
create trigger lawyer_price_band before insert or update on lawyer_prices for each row execute function check_price_band();

-- safe, read-only views (they expose only the columns listed)
create view airline_directory as select a.id, a.name, a.slug, a.industry, a.verified, coalesce(round(avg(c.rating),1),0) as avg_rating, count(c.id) as review_count from airlines a left join complaints c on c.airline_id = a.id where a.status = 'active' group by a.id;
create view public_feed as select c.ref, split_part(c.customer_name,' ',1) as first_name, a.name as airline, c.category, c.subject, left(c.description,220) as excerpt, c.rating, c.status, c.created_at from complaints c join airlines a on a.id = c.airline_id where a.status = 'active';
create view lawyer_directory as select l.id, l.full_name, l.firm, l.call_year, l.grade, l.bio, l.rating, l.conflicts from lawyers l where l.status = 'approved' and l.available;
create view airline_legal_flags as select k.complaint_id, k.service, k.status from legal_cases k join complaints c on c.id = k.complaint_id where k.status not in ('declined','expired','cancelled') and c.airline_id = my_airline();
grant select on airline_directory, public_feed, lawyer_directory to anon, authenticated;
grant select on airline_legal_flags to authenticated;

-- lawyers see a case summary before accepting; customer contact details unlock only after acceptance
create function lawyer_case_detail(p_case uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('ref',k.ref,'status',k.status,'service',k.service,'airline',a.name,'flight',c.flight_number,'category',c.category,'subject',c.subject,'description',c.description,
    'customer', case when k.status in ('active','completed') then jsonb_build_object('name',c.customer_name,'email',c.customer_email,'phone',c.customer_phone) end)
  from legal_cases k join complaints c on c.id = k.complaint_id join airlines a on a.id = c.airline_id where k.id = p_case and k.lawyer_id = my_lawyer() $$;

-- scheduled jobs (enable pg_cron, then schedule: tick_alerts every minute, expire_cases every 10 minutes)
create function tick_alerts() returns void language sql as $$
  update alerts set level = case when now() - created_at > interval '30 minutes' then 3 when now() - created_at > interval '10 minutes' then 2 else 1 end where acknowledged_at is null $$;
create function expire_cases() returns void language sql as $$ update legal_cases set status = 'expired' where status = 'awaiting_lawyer' and accept_by < now() $$;
-- after expiry, a server job must refund the held payment through Paystack and mark payments.status = 'refunded'.

insert into storage.buckets (id, name, public) values ('complaint-attachments','complaint-attachments',false),('lawyer-credentials','lawyer-credentials',false) on conflict do nothing;
