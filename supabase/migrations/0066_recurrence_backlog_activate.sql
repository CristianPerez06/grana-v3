-- ═══════════════════════════════════════════════════════════════════════════
-- 0066 · Activación: el atraso puede existir
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Migración B del par expandir/activar (decisión 17). 0064 y 0065 son aditivas
-- y no cambian ningún comportamiento; ESTA sí. Retira
-- `recurrence_instances_one_pending_per_rule`, el índice de 0011 que permitía
-- una sola ocurrencia sin resolver por regla.
--
-- Ese índice ES el #96. Con él, una ocurrencia que el usuario no revisó traba
-- la regla para siempre: el generador no puede escribir la siguiente, así que
-- el atraso no existe en la base y por lo tanto no existe en ninguna pantalla.
-- Sin él, una regla puede deber varias y cada una se resuelve por separado, en
-- cualquier orden.
--
-- ═══ NO SE APLICA HASTA QUE SE CUMPLAN LAS TRES CONDICIONES ═══
--
--   1. Web y nativo desplegados con el modelo nuevo: generador por tandas,
--      reads que devuelven colecciones, dashboard y proyección leyendo las
--      ocurrencias existentes. Una pantalla que todavía renderiza `[0]` de una
--      lista mostraría una de varias como si fuera la única.
--   2. Ningún cliente nativo anterior en uso (tarea 2.8b). Un cliente viejo no
--      ejecuta el generador nuevo, así que su atraso nunca se materializa y el
--      #96 sigue vivo para él — ahora sin el índice que lo contenía. Hoy se
--      cumple porque no hay builds nativos distribuidos; se REVERIFICA en el
--      momento de aplicar, no se asume.
--   3. QA manual de los seis comportamientos, hecho contra un entorno con esta
--      migración ya aplicada: el comportamiento central —varios vencimientos a
--      la vez— no se puede probar mientras el índice siga vivo.
--
-- La verificación de la condición 1 es lo único que se puede automatizar desde
-- acá, y se hace abajo: no se retira el índice si el modelo nuevo no está.
--
-- ═══ QUÉ NO HACE ═══
--
-- No toca `resolution_kind` ni sus CHECK: entraron en la expansión (0064, tarea
-- 1.4b), donde tienen que estar, porque el trigger de compatibilidad los
-- completa antes de que el CHECK corra.
--
-- No retira `scheduled_date` ni `last_generated_date`. Eso es el paso C, una
-- entrega posterior con su propia verificación: hay que sacar antes las ramas de
-- compatibilidad del trigger y las lecturas que todavía muestran la columna.
--
-- REVERSIBLE. Volver a crear el índice es una línea, y está escrita al final de
-- este archivo. Lo que NO se puede deshacer es el atraso ya materializado: si el
-- índice vuelve mientras una regla tiene dos pendientes, el `CREATE UNIQUE
-- INDEX` falla. Esa es la razón por la que el orden de arriba no es negociable.

begin;

-- ── Condición 1, verificada ────────────────────────────────────────────────
-- 0064 tiene que estar aplicada. Retirar el índice sin la identidad de
-- ocurrencia deja el peor estado posible: la base admite varias pendientes y
-- nada las distingue, así que un generador que reintenta escribe duplicados.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'recurrence_instances'
       and column_name  = 'due_date'
  ) then
    raise exception 'activación abortada: falta recurrence_instances.due_date — aplicá 0064 primero';
  end if;

  -- El índice de identidad es lo que impide que el generador duplique una
  -- ocurrencia cuando dos corridas se pisan. Sin el de pendiente única, es lo
  -- ÚNICO que lo impide.
  if not exists (
    select 1 from pg_class where relname = 'recurrence_instances_one_per_rule_due_date'
  ) then
    raise exception 'activación abortada: falta el índice de identidad recurrence_instances_one_per_rule_due_date (0064)';
  end if;

  -- Y toda pendiente tiene que tener vencimiento exacto: sin él la fila no tiene
  -- identidad, así que el índice de arriba no la cubre.
  if exists (
    select 1 from public.recurrence_instances
     where status = 'pending' and due_date is null
  ) then
    raise exception 'activación abortada: hay pendientes sin due_date — no tienen identidad y el índice único no las cubre';
  end if;
end $$;

-- ── La activación ──────────────────────────────────────────────────────────
drop index if exists public.recurrence_instances_one_pending_per_rule;

-- ── Autoverificación ───────────────────────────────────────────────────────
-- Que el índice se haya ido, y que lo que lo reemplaza siga en pie. Un `drop`
-- silencioso sobre un nombre equivocado dejaría la migración "exitosa" y el #96
-- intacto.
do $$
begin
  if exists (
    select 1 from pg_class where relname = 'recurrence_instances_one_pending_per_rule'
  ) then
    raise exception 'activación fallida: el índice de pendiente única sigue existiendo';
  end if;

  if not exists (
    select 1 from pg_class where relname = 'recurrence_instances_one_per_rule_due_date'
  ) then
    raise exception 'activación fallida: el índice de identidad desapareció';
  end if;

  raise notice '✓ 0066 — backlog activado: una regla puede deber varias ocurrencias sin resolver';
end $$;

commit;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Solo funciona si ninguna regla acumuló todavía dos pendientes. Si alguna lo
-- hizo, el CREATE falla y volver atrás exige decidir a mano cuál de sus
-- ocurrencias se conserva — que es exactamente la decisión que este change
-- existe para no tener que tomar.
--
--   create unique index recurrence_instances_one_pending_per_rule
--     on public.recurrence_instances (recurrence_id)
--     where status = 'pending';
