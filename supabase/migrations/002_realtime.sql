-- Live updates for the airline workspace (Supabase Realtime respects Row Level Security).
alter publication supabase_realtime add table alerts, complaints;
