-- system categories (user_id IS NULL)
insert into categories (name, canonical_name, color, icon, type) values
  -- gastos (12)
  ('Comida',             'comida',             '#F59E0B', '🍔', 'expense'),
  ('Transporte',         'transporte',          '#3B82F6', '🚌', 'expense'),
  ('Salud',              'salud',               '#10B981', '🏥', 'expense'),
  ('Educación',          'educacion',           '#06B6D4', '📚', 'expense'),
  ('Entretenimiento',    'entretenimiento',     '#8B5CF6', '🎬', 'expense'),
  ('Ropa y calzado',     'ropa-y-calzado',      '#EC4899', '👕', 'expense'),
  ('Hogar',              'hogar',               '#14B8A6', '🏠', 'expense'),
  ('Servicios',          'servicios',           '#F97316', '⚡', 'expense'),
  ('Tecnología',         'tecnologia',          '#64748B', '📱', 'expense'),
  ('Impuestos',          'impuestos',           '#EF4444', '🏛️', 'expense'),
  ('Financiero',         'financiero',          '#6366F1', '🏦', 'expense'),
  ('Otros gastos',       'otros-gastos',        '#6B7280', '📦', 'expense'),
  -- ingresos (5)
  ('Sueldo',             'sueldo',              '#10B981', '💼', 'income'),
  ('Freelance',          'freelance',           '#0EA5E9', '💻', 'income'),
  ('Inversiones',        'inversiones',         '#8B5CF6', '📈', 'income'),
  ('Otros ingresos',     'otros-ingresos',      '#6B7280', '💰', 'income'),
  ('Reintegros / Cashback', 'reintegros-cashback', '#F59E0B', '🔄', 'income')
on conflict do nothing;

-- system subcategories (user_id IS NULL)
insert into subcategories (category_id, name, canonical_name)
select c.id, s.name, s.canonical_name
from (values
  ('comida',         'Supermercado',                 'supermercado'),
  ('comida',         'Restaurante',                  'restaurante'),
  ('comida',         'PedidosYa',                    'pedidosya'),
  ('comida',         'Rappi',                        'rappi'),
  ('comida',         'Cafetería',                    'cafeteria'),
  ('transporte',     'Nafta',                        'nafta'),
  ('transporte',     'Uber / Cabify',                'uber-cabify'),
  ('transporte',     'Transporte público',            'transporte-publico'),
  ('transporte',     'Estacionamiento',               'estacionamiento'),
  ('salud',          'Farmacia',                     'farmacia'),
  ('salud',          'Médico',                       'medico'),
  ('salud',          'Obra social',                  'obra-social'),
  ('entretenimiento','Netflix / Streaming',           'netflix-streaming'),
  ('entretenimiento','Cine',                         'cine'),
  ('entretenimiento','Salidas',                      'salidas'),
  ('entretenimiento','Juegos',                       'juegos'),
  ('servicios',      'Luz',                          'luz'),
  ('servicios',      'Gas',                          'gas'),
  ('servicios',      'Internet',                     'internet'),
  ('servicios',      'Celular',                      'celular'),
  ('ropa-y-calzado', 'Ropa',                         'ropa'),
  ('ropa-y-calzado', 'Calzado',                      'calzado'),
  ('ropa-y-calzado', 'Accesorios',                   'accesorios'),
  ('hogar',          'Alquiler',                     'alquiler'),
  ('hogar',          'Limpieza',                     'limpieza'),
  ('hogar',          'Muebles',                      'muebles'),
  ('hogar',          'Reparaciones',                 'reparaciones'),
  ('impuestos',      'Impuesto de sellos',            'impuesto-de-sellos'),
  ('financiero',     'Comisión compra USD',           'comision-compra-usd'),
  ('financiero',     'Constitución plazo fijo',       'constitucion-plazo-fijo'),
  ('financiero',     'Intereses cuenta remunerada',   'intereses-cuenta-remunerada')
) as s(cat_canonical, name, canonical_name)
join categories c on c.canonical_name = s.cat_canonical and c.user_id is null
on conflict do nothing;
