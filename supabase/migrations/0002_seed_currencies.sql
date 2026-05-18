create table currencies (
  code    text primary key,
  name    text not null,
  symbol  text not null,
  is_active boolean not null default true
);

alter table currencies enable row level security;

create policy "authenticated users can read currencies"
  on currencies for select
  to authenticated
  using (true);

insert into currencies (code, name, symbol) values
  ('ARS', 'Peso argentino',        '$'),
  ('USD', 'Dólar estadounidense',  'US$'),
  ('EUR', 'Euro',                  '€')
on conflict (code) do nothing;
