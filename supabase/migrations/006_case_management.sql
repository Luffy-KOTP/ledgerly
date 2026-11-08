-- Two-way messaging, private airline notes, proposed resolutions, response deadlines and escalation tracking.
alter table complaints
  add column if not exists desired_resolution text,
  add column if not exists response_due_at timestamptz,
  add column if not exists first_response_at timestamptz,
  add column if not exists escalation_level smallint not null default 1,
  add column if not exists ledgerly_requested_at timestamptz,
  add column if not exists regulator_referred_at timestamptz,
  add column if not exists regulator_reference text;

create table complaint_messages (
  id uuid primary key default gen_random_uuid(), complaint_id uuid not null references complaints on delete cascade,
  sender text not null check (sender in ('customer','airline','ledgerly')), sender_user uuid references auth.users,
  body text not null check (char_length(body) between 1 and 4000), created_at timestamptz not null default now());
create index on complaint_messages (complaint_id, created_at);
create table complaint_internal_notes (  -- never shown to customers: a separate table keeps access control simple
  id uuid primary key default gen_random_uuid(), complaint_id uuid not null references complaints on delete cascade,
  author uuid not null references auth.users, body text not null check (char_length(body) between 1 and 4000), created_at timestamptz not null default now());
create table complaint_resolutions (
  id uuid primary key default gen_random_uuid(), complaint_id uuid not null references complaints on delete cascade, proposed_by uuid references auth.users,
  kind text not null check (kind in ('Refund','Compensation','Rebooking','Baggage recovery','Formal apology','Other corrective action')),
  details text not null check (char_length(details) between 1 and 2000), status text not null default 'proposed' check (status in ('proposed','accepted','rejected','withdrawn')),
  customer_comment text, created_at timestamptz not null default now(), decided_at timestamptz);

-- Response deadline: 7 days to resolve (the Nigeria Civil Aviation Regulations, Part 19, let passengers go to the NCAA after that), 2 hours target for critical safety reports.
create function set_response_due() returns trigger language plpgsql as $$
begin new.response_due_at := now() + case when new.is_critical then interval '2 hours' else interval '7 days' end; return new; end $$;
create trigger complaints_due before insert on complaints for each row execute function set_response_due();
update complaints set response_due_at = created_at + case when is_critical then interval '2 hours' else interval '7 days' end where response_due_at is null;
update complaints set first_response_at = coalesce(resolved_at, created_at) where airline_response is not null and first_response_at is null;
create function note_first_response() returns trigger language plpgsql security definer set search_path = public as $$
begin if new.sender = 'airline' then update complaints set first_response_at = coalesce(first_response_at, now()) where id = new.complaint_id; end if; return new; end $$;
create trigger msg_first_response after insert on complaint_messages for each row execute function note_first_response();

do $$ declare t text; begin
  foreach t in array array['complaint_messages','complaint_internal_notes','complaint_resolutions'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy admin_all on %I for all to authenticated using (my_role() = ''admin'') with check (my_role() = ''admin'')', t);
  end loop; end $$;
create policy staff_msgs on complaint_messages for select to authenticated using (exists (select 1 from complaints c where c.id = complaint_id and c.airline_id = my_airline()));
create policy staff_msgs_add on complaint_messages for insert to authenticated with check (sender = 'airline' and sender_user = auth.uid() and exists (select 1 from complaints c where c.id = complaint_id and c.airline_id = my_airline()));
create policy staff_notes on complaint_internal_notes for select to authenticated using (exists (select 1 from complaints c where c.id = complaint_id and c.airline_id = my_airline()));
create policy staff_notes_add on complaint_internal_notes for insert to authenticated with check (author = auth.uid() and exists (select 1 from complaints c where c.id = complaint_id and c.airline_id = my_airline()));
create policy staff_res on complaint_resolutions for select to authenticated using (exists (select 1 from complaints c where c.id = complaint_id and c.airline_id = my_airline()));
create policy staff_res_add on complaint_resolutions for insert to authenticated with check (status = 'proposed' and proposed_by = auth.uid() and exists (select 1 from complaints c where c.id = complaint_id and c.airline_id = my_airline()));
grant select, insert on complaint_messages, complaint_internal_notes, complaint_resolutions to authenticated;
grant select, insert, update, delete on complaint_messages, complaint_internal_notes, complaint_resolutions to service_role;
-- Customers act through server code after the one-time code, so they get no direct table access.
alter publication supabase_realtime add table complaint_messages, complaint_resolutions;
