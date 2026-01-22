-- Create advisor_notifications table
create table if not exists advisor_notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  created_at timestamptz default now(),
  read_at timestamptz,
  type text check (type in ('weekly_briefing', 'budget_alert', 'insight')),
  title text not null,
  content_markdown text not null,
  priority text default 'normal' -- 'high', 'normal'
);

-- Add RLS policies
alter table advisor_notifications enable row level security;

create policy "Users can view their own advisor notifications"
  on advisor_notifications for select
  using (auth.uid() = user_id);

create policy "Users can update their own advisor notifications"
  on advisor_notifications for update
  using (auth.uid() = user_id);

-- Create index for faster querying
create index if not exists advisor_notifications_user_id_idx on advisor_notifications(user_id);
create index if not exists advisor_notifications_read_at_idx on advisor_notifications(read_at) where read_at is null;

-- Enable Realtime
alter publication supabase_realtime add table advisor_notifications;
