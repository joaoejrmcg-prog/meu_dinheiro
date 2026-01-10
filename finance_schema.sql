-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create Payment Methods Table
create table public.payment_methods (
  id uuid not null default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('credit_card', 'debit_card', 'cash', 'bank_account')),
  closing_day integer,
  due_day integer,
  created_at timestamp with time zone default now(),
  
  constraint payment_methods_pkey primary key (id)
);

-- Create Categories Table
create table public.categories (
  id uuid not null default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade, -- Nullable for system defaults if we want, but let's stick to user-specific for now or global
  name text not null,
  icon text,
  is_default boolean default false,
  created_at timestamp with time zone default now(),
  
  constraint categories_pkey primary key (id)
);

-- Create Transactions Table
create table public.transactions (
  id uuid not null default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  amount decimal(12,2) not null,
  date date not null,
  type text not null check (type in ('income', 'expense')),
  category_id uuid references public.categories(id) on delete set null,
  payment_method_id uuid references public.payment_methods(id) on delete set null,
  installments_current integer default 1,
  installments_total integer default 1,
  is_paid boolean default false,
  created_at timestamp with time zone default now(),
  
  constraint transactions_pkey primary key (id)
);

-- Create Recurrences Table
create table public.recurrences (
  id uuid not null default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  amount decimal(12,2) not null,
  frequency text not null check (frequency in ('monthly', 'weekly', 'yearly')),
  next_due_date date not null,
  payment_method_id uuid references public.payment_methods(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  active boolean default true,
  created_at timestamp with time zone default now(),
  
  constraint recurrences_pkey primary key (id)
);

-- Enable RLS
alter table public.payment_methods enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.recurrences enable row level security;

-- Create Policies
create policy "Users can view their own payment methods" on public.payment_methods
  for select using (auth.uid() = user_id);

create policy "Users can insert their own payment methods" on public.payment_methods
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own payment methods" on public.payment_methods
  for update using (auth.uid() = user_id);

create policy "Users can delete their own payment methods" on public.payment_methods
  for delete using (auth.uid() = user_id);

-- Categories
create policy "Users can view their own categories" on public.categories
  for select using (auth.uid() = user_id or is_default = true);

create policy "Users can insert their own categories" on public.categories
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own categories" on public.categories
  for update using (auth.uid() = user_id);

create policy "Users can delete their own categories" on public.categories
  for delete using (auth.uid() = user_id);

-- Transactions
create policy "Users can view their own transactions" on public.transactions
  for select using (auth.uid() = user_id);

create policy "Users can insert their own transactions" on public.transactions
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own transactions" on public.transactions
  for update using (auth.uid() = user_id);

create policy "Users can delete their own transactions" on public.transactions
  for delete using (auth.uid() = user_id);

-- Recurrences
create policy "Users can view their own recurrences" on public.recurrences
  for select using (auth.uid() = user_id);

create policy "Users can insert their own recurrences" on public.recurrences
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own recurrences" on public.recurrences
  for update using (auth.uid() = user_id);

create policy "Users can delete their own recurrences" on public.recurrences
  for delete using (auth.uid() = user_id);
