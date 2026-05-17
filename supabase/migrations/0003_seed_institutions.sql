create table institutions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  brand_color text,
  icon_type   text,           -- 'bank' | 'wallet'
  country     text not null default 'AR',
  is_active   boolean not null default true
);

alter table institutions enable row level security;

create policy "authenticated users can read institutions"
  on institutions for select
  to authenticated
  using (true);

insert into institutions (name, slug, brand_color, icon_type) values
  -- Bancos
  ('Banco Santander',    'santander',    '#E31937', 'bank'),
  ('BBVA',               'bbva',         '#004481', 'bank'),
  ('Banco Galicia',      'galicia',      '#F37021', 'bank'),
  ('Banco Nación',       'nacion',       '#0055A5', 'bank'),
  ('Banco Provincia',    'provincia',    '#006633', 'bank'),
  ('Banco Macro',        'macro',        '#003366', 'bank'),
  ('Brubank',            'brubank',      '#6B27D5', 'bank'),
  ('Banco Hipotecario',  'hipotecario',  '#0066B3', 'bank'),
  ('HSBC',               'hsbc',         '#DB0011', 'bank'),
  ('ICBC',               'icbc',         '#C8102E', 'bank'),
  ('Banco Comafi',       'comafi',       '#003DA5', 'bank'),
  ('Banco Patagonia',    'patagonia',    '#00529B', 'bank'),
  ('Banco Ciudad',       'ciudad',       '#00A0E0', 'bank'),
  ('Banco Supervielle',  'supervielle',  '#0076CE', 'bank'),
  ('Banco Credicoop',    'credicoop',    '#006341', 'bank'),
  -- Billeteras virtuales
  ('Mercado Pago',       'mercado-pago', '#009EE3', 'wallet'),
  ('Ualá',               'uala',         '#7B61FF', 'wallet'),
  ('Naranja X',          'naranja-x',    '#FF6600', 'wallet'),
  ('Personal Pay',       'personal-pay', '#00B4E6', 'wallet'),
  ('Prex',               'prex',         '#00BFA5', 'wallet'),
  ('Cuenta DNI',         'cuenta-dni',   '#0055A5', 'wallet'),
  ('Lemon',              'lemon',        '#B5FF00', 'wallet'),
  ('Belo',               'belo',         '#4ADE80', 'wallet')
on conflict (slug) do nothing;
