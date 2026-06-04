-- 0027_reseed_categories_argentina.sql
--
-- Enriquecimiento ADITIVO del catálogo de categorías del sistema, enfocado en
-- Argentina. NO edita 0006 (ya aplicada en prod) y NO borra ni renombra ningún
-- canonical_name existente (la regla de inmutabilidad se respeta: los renombres
-- de etiqueta visible viven en i18n, no acá).
--
-- Pasa el seed de 17 categorías / 31 subcategorías a 18 / 71:
--   + 1 categoría nueva: Cuidado personal (expense)
--   + 40 subcategorías nuevas (rubros AR: Monotributo, Expensas, Prepaga, SUBE,
--     VTV, Patente, Aguinaldo, Compra dólar/MEP, etc.)
--
-- Idempotente: ON CONFLICT DO NOTHING. Corre en el dashboard (rol postgres),
-- bypassa RLS igual que 0006.

-- categoría nueva del sistema (user_id IS NULL)
insert into categories (name, canonical_name, color, icon, type) values
  ('Cuidado personal', 'cuidado-personal', '#D946EF', '🧴', 'expense')
on conflict do nothing;

-- subcategorías nuevas del sistema (user_id IS NULL)
insert into subcategories (category_id, name, canonical_name)
select c.id, s.name, s.canonical_name
from (values
  -- comida (+3)
  ('comida',          'Kiosco / Almacén',     'kiosco-almacen'),
  ('comida',          'Verdulería',           'verduleria'),
  ('comida',          'Carnicería',           'carniceria'),
  -- transporte (+5) — incluye los gastos del auto
  ('transporte',      'Peajes',               'peajes'),
  ('transporte',      'Service / Mecánico',   'service-mecanico'),
  ('transporte',      'Seguro auto',          'seguro-auto'),
  ('transporte',      'VTV',                  'vtv'),
  ('transporte',      'Patente',              'patente'),
  -- salud (+1)
  ('salud',           'Prepaga',              'prepaga'),
  -- educacion (+4)
  ('educacion',       'Cuota colegio',        'cuota-colegio'),
  ('educacion',       'Universidad',          'universidad'),
  ('educacion',       'Cursos',               'cursos'),
  ('educacion',       'Útiles / Libros',      'utiles-libros'),
  -- hogar (+1)
  ('hogar',           'Expensas',             'expensas'),
  -- servicios (+2)
  ('servicios',       'Agua',                 'agua'),
  ('servicios',       'Cable / TV',           'cable-tv'),
  -- cuidado-personal (+4, categoría nueva)
  ('cuidado-personal','Peluquería',           'peluqueria'),
  ('cuidado-personal','Gimnasio',             'gimnasio'),
  ('cuidado-personal','Cosmética / Higiene',  'cosmetica-higiene'),
  ('cuidado-personal','Skin care',            'skin-care'),
  -- tecnologia (+3)
  ('tecnologia',      'Dispositivos',         'dispositivos'),
  ('tecnologia',      'Apps y suscripciones', 'apps-y-suscripciones'),
  ('tecnologia',      'Gadgets',              'gadgets'),
  -- impuestos (+2)
  ('impuestos',       'Monotributo',          'monotributo'),
  ('impuestos',       'Tasas municipales',    'tasas-municipales'),
  -- financiero (+2)
  ('financiero',      'Comisiones bancarias', 'comisiones-bancarias'),
  ('financiero',      'Compra dólar / MEP',   'compra-dolar-mep'),
  -- otros-gastos (+2)
  ('otros-gastos',    'Regalos',              'regalos'),
  ('otros-gastos',    'Donaciones',           'donaciones'),
  -- sueldo (+3)
  ('sueldo',          'Salario',              'salario'),
  ('sueldo',          'Aguinaldo',            'aguinaldo'),
  ('sueldo',          'Bono',                 'bono'),
  -- freelance (+2)
  ('freelance',       'Honorarios',           'honorarios'),
  ('freelance',       'Proyectos',            'proyectos'),
  -- inversiones (+4)
  ('inversiones',     'Plazo fijo',           'plazo-fijo'),
  ('inversiones',     'Dividendos',           'dividendos'),
  ('inversiones',     'Alquileres cobrados',  'alquileres-cobrados'),
  ('inversiones',     'Dólar / MEP',          'dolar-mep'),
  -- otros-ingresos (+2)
  ('otros-ingresos',  'Venta',                'venta'),
  ('otros-ingresos',  'Regalo recibido',      'regalo-recibido')
) as s(cat_canonical, name, canonical_name)
join categories c on c.canonical_name = s.cat_canonical and c.user_id is null
on conflict do nothing;
