-- Explicit Data API grants. Newer Supabase projects no longer expose new tables automatically,
-- so every table needs a grant before supabase-js can reach it. Row Level Security still decides which rows each role sees.
grant usage on schema public to anon, authenticated, service_role;

-- Server code uses the service role: it bypasses RLS but still needs table privileges.
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to service_role;

-- Visitors who are not signed in: only the airline list and price bands (the views were granted in 001).
grant select on airlines, platform_settings to anon;

-- Signed-in users: the policies in 001 limit rows (an airline sees only its own, a lawyer only theirs, admins everything).
grant select on airlines, profiles, lawyers, lawyer_documents, lawyer_prices, platform_settings, complaints, complaint_events,
  attachments, alerts, legal_cases, case_messages, payments, payouts, consents, audit_log to authenticated;
grant insert on complaint_events, case_messages to authenticated;
grant insert, update, delete on lawyer_prices to authenticated;
-- Column-level UPDATE grants on complaints, alerts and lawyers were set in 001_schema.sql and stay as they are.

grant execute on function my_role(), my_airline(), my_lawyer(), lawyer_case_detail(uuid) to authenticated;
