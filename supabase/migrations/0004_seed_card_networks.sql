create table card_networks (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  slug          text not null unique,
  brand_color   text,
  display_order integer not null default 99,
  is_active     boolean not null default true
);

alter table card_networks enable row level security;

create policy "authenticated users can read card_networks"
  on card_networks for select
  to authenticated
  using (true);

insert into card_networks (name, slug, brand_color, display_order) values
  ('Visa',           'visa',          '#1A1F71', 1),
  ('Mastercard',     'mastercard',    '#EB001B', 2),
  ('American Express', 'amex',        '#006FCF', 3),
  ('Cabal',          'cabal',         '#0A4D8C', 4),
  ('Naranja',        'naranja',       '#FF6900', 5),
  ('Naranja X',      'naranja-x',     '#000000', 6),
  ('Mercado Pago',   'mercado-pago',  '#00B1EA', 7)
on conflict (slug) do nothing;
