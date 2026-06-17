-- Drop the redundant "Banco " prefix from system bank institutions.
-- Institution names are display-only (every lookup goes by slug or id), so this
-- is a purely cosmetic rename. Scoped to system rows (user_id IS NULL) so any
-- user-created custom institution keeps the name its owner chose.

update institutions
set name = substring(name from 7)
where user_id is null
  and name like 'Banco %';
