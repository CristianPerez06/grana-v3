-- 0026_restrict_category_subcategory_deletes.sql
--
-- La DB es la autoridad contra la pérdida de clasificación histórica: borrar una
-- categoría o subcategoría que todavía está referenciada debe quedar BLOQUEADO,
-- no resolverse anulando (`SET NULL`) la referencia en silencio. Esta garantía no
-- debe depender de que cada frontend (web, mobile, SQL manual, clientes futuros)
-- recuerde consultar las tres tablas que referencian categorías.
--
-- Convierte a `ON DELETE RESTRICT` los FK que hoy son `ON DELETE SET NULL`:
--   - transactions.subcategory_id
--   - recurrences.category_id
--   - recurrences.subcategory_id
--   - recurrence_instances.category_id
--   - recurrence_instances.subcategory_id
--
-- `transactions.category_id` ya es RESTRICT desde 0008 y se deja como está.
-- Los guards de aplicación (web + mobile) siguen existiendo para mostrar un
-- mensaje útil ("archivá en lugar de eliminar"); este FK es la última barrera
-- ante carreras o caminos no previstos.

DO $$
DECLARE
  -- {tabla, columna, tabla_referenciada}
  targets text[][] := ARRAY[
    ['transactions', 'subcategory_id', 'subcategories'],
    ['recurrences', 'category_id', 'categories'],
    ['recurrences', 'subcategory_id', 'subcategories'],
    ['recurrence_instances', 'category_id', 'categories'],
    ['recurrence_instances', 'subcategory_id', 'subcategories']
  ];
  i int;
  v_conname text;
BEGIN
  FOR i IN 1 .. array_length(targets, 1) LOOP
    -- Descubrir el nombre real del FK de una sola columna sobre (tabla, columna)
    -- que apunta a la tabla destino esperada.
    SELECT con.conname INTO v_conname
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_class ref ON ref.oid = con.confrelid
      JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
     WHERE con.contype = 'f'
       AND rel.relnamespace = 'public'::regnamespace
       AND rel.relname = targets[i][1]
       AND att.attname = targets[i][2]
       AND ref.relname = targets[i][3]
       AND array_length(con.conkey, 1) = 1;

    IF v_conname IS NULL THEN
      RAISE EXCEPTION 'FK de una columna sobre %.% no encontrado', targets[i][1], targets[i][2];
    END IF;

    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', targets[i][1], v_conname);
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.%I(id) ON DELETE RESTRICT',
      targets[i][1], v_conname, targets[i][2], targets[i][3]
    );
  END LOOP;
END $$;

-- ============================================================================
-- Self-check: cada triple esperado (tabla, columna, tabla_referenciada) debe
-- existir como FK de una sola columna ON DELETE RESTRICT. Validar triple por
-- triple (no contar == 6) evita el falso positivo de "uno falta y otro sobra".
-- ============================================================================
DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(format('%s.%s->%s', e.tbl, e.col, e.ref), ', ') INTO v_missing
    FROM (VALUES
      ('transactions', 'category_id', 'categories'),
      ('transactions', 'subcategory_id', 'subcategories'),
      ('recurrences', 'category_id', 'categories'),
      ('recurrences', 'subcategory_id', 'subcategories'),
      ('recurrence_instances', 'category_id', 'categories'),
      ('recurrence_instances', 'subcategory_id', 'subcategories')
    ) AS e(tbl, col, ref)
   WHERE NOT EXISTS (
     SELECT 1
       FROM pg_constraint con
       JOIN pg_class rel ON rel.oid = con.conrelid
       JOIN pg_class refc ON refc.oid = con.confrelid
       JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
      WHERE con.contype = 'f'
        AND con.confdeltype = 'r' -- 'r' = RESTRICT
        AND rel.relnamespace = 'public'::regnamespace
        AND rel.relname = e.tbl
        AND att.attname = e.col
        AND refc.relname = e.ref
        AND array_length(con.conkey, 1) = 1
   );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'SELF-CHECK FAILED: FK ON DELETE RESTRICT faltantes o incorrectos: %', v_missing;
  END IF;

  RAISE NOTICE 'SELF-CHECK PASSED: los 6 FK category/subcategory existen y son ON DELETE RESTRICT';
END $$;
