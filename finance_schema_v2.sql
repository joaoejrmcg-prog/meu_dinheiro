-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 0. CLEANUP (Optional - Uncomment if you want to force a fresh start)
-- drop table if exists public.movements;
-- drop table if exists public.loans;
-- drop table if exists public.reserves;
-- drop table if exists public.recurrences;
-- drop table if exists public.transactions; -- Legacy
-- drop table if exists public.payment_methods; -- Legacy

-- 1. ACCOUNTS (Contas)
create table if not exists public.accounts (
  id uuid not null default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('wallet', 'bank', 'savings')),
  balance decimal(12,2) default 0.00,
  created_at timestamp with time zone default now(),
  
  constraint accounts_pkey primary key (id)
);

-- 2. CREDIT CARDS (Cartões)
create table if not exists public.credit_cards (
  id uuid not null default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  closing_day integer not null check (closing_day between 1 and 31),
  due_day integer not null check (due_day between 1 and 31),
  limit_amount decimal(12,2),
  created_at timestamp with time zone default now(),
  
  constraint credit_cards_pkey primary key (id)
);

-- 3. CATEGORIES (Categorias)
-- Using IF NOT EXISTS to avoid error if already exists
create table if not exists public.categories (
  id uuid not null default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  icon text,
  is_default boolean default false,
  created_at timestamp with time zone default now(),
  
  constraint categories_pkey primary key (id)
);

-- 4. RESERVES (Reservas)
create table if not exists public.reserves (
  id uuid not null default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  current_amount decimal(12,2) default 0.00,
  target_amount decimal(12,2),
  color text,
  created_at timestamp with time zone default now(),
  
  constraint reserves_pkey primary key (id)
);

-- 5. LOANS (Empréstimos)
create table if not exists public.loans (
  id uuid not null default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  total_amount decimal(12,2) not null,
  remaining_amount decimal(12,2) not null,
  type text not null check (type in ('taken', 'given')),
  interest_rate decimal(5,2),
  due_date date,
  created_at timestamp with time zone default now(),
  
  constraint loans_pkey primary key (id)
);

-- 6. MOVEMENTS (Movimentações)
create table if not exists public.movements (
  id uuid not null default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  amount decimal(12,2) not null,
  date date not null,
  type text not null check (type in ('income', 'expense', 'transfer', 'adjustment')),
  
  account_id uuid references public.accounts(id) on delete set null,
  card_id uuid references public.credit_cards(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  
  is_loan boolean default false,
  loan_id uuid references public.loans(id) on delete set null,
  
  is_reserve boolean default false,
  reserve_id uuid references public.reserves(id) on delete set null,
  
  is_reimbursement boolean default false,
  parent_movement_id uuid references public.movements(id) on delete set null,
  
  is_paid boolean default true,
  
  created_at timestamp with time zone default now(),
  
  constraint movements_pkey primary key (id)
);

-- 7. RECURRENCES (Recorrências)
-- We DROP this one if it exists because the schema has changed (payment_method_id -> account_id/card_id)
drop table if exists public.recurrences;

create table public.recurrences (
  id uuid not null default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  amount decimal(12,2) not null,
  type text not null check (type in ('income', 'expense')),
  frequency text not null check (frequency in ('monthly', 'weekly', 'yearly')),
  next_due_date date not null,
  active boolean default true,
  
  category_id uuid references public.categories(id) on delete set null,
  account_id uuid references public.accounts(id) on delete set null,
  card_id uuid references public.credit_cards(id) on delete set null,
  
  created_at timestamp with time zone default now(),
  
  constraint recurrences_pkey primary key (id)
);

-- RLS POLICIES (Using DO block to avoid errors if policies already exist)
do $$
begin
  -- Accounts
  if not exists (select 1 from pg_policies where tablename = 'accounts' and policyname = 'Users manage their own accounts') then
    alter table public.accounts enable row level security;
    create policy "Users manage their own accounts" on public.accounts using (auth.uid() = user_id);
  end if;

  -- Credit Cards
  if not exists (select 1 from pg_policies where tablename = 'credit_cards' and policyname = 'Users manage their own cards') then
    alter table public.credit_cards enable row level security;
    create policy "Users manage their own cards" on public.credit_cards using (auth.uid() = user_id);
  end if;

  -- Categories (Check first)
  if not exists (select 1 from pg_policies where tablename = 'categories' and policyname = 'Users manage their own categories') then
    alter table public.categories enable row level security;
    create policy "Users manage their own categories" on public.categories using (auth.uid() = user_id or is_default = true);
  end if;

  -- Reserves
  if not exists (select 1 from pg_policies where tablename = 'reserves' and policyname = 'Users manage their own reserves') then
    alter table public.reserves enable row level security;
    create policy "Users manage their own reserves" on public.reserves using (auth.uid() = user_id);
  end if;

  -- Loans
  if not exists (select 1 from pg_policies where tablename = 'loans' and policyname = 'Users manage their own loans') then
    alter table public.loans enable row level security;
    create policy "Users manage their own loans" on public.loans using (auth.uid() = user_id);
  end if;

  -- Movements
  if not exists (select 1 from pg_policies where tablename = 'movements' and policyname = 'Users manage their own movements') then
    alter table public.movements enable row level security;
    create policy "Users manage their own movements" on public.movements using (auth.uid() = user_id);
  end if;

  -- Recurrences
  if not exists (select 1 from pg_policies where tablename = 'recurrences' and policyname = 'Users manage their own recurrences') then
    alter table public.recurrences enable row level security;
    create policy "Users manage their own recurrences" on public.recurrences using (auth.uid() = user_id);
  end if;
end
$$;
