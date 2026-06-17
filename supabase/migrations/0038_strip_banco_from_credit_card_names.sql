-- One-time cleanup: strip the leftover "Banco " word from existing account
-- names. New accounts/cards already drop it (the create forms run the name
-- through shortBankName), but ones created earlier baked the full institution
-- name (e.g. "Banco Galicia") into accounts.name. This rewrites that stored
-- text; scoped to credit cards and bank accounts (cash accounts have no bank).
--
-- The pattern requires whitespace after "banco", so single-word banks like
-- "Bancor" are left untouched. btrim cleans up any leading/trailing space the
-- removal leaves behind, and the inner replace collapses the gap.

update accounts
set name = btrim(regexp_replace(name, '[Bb]anco[[:space:]]+', '', 'g'))
where type in ('credit', 'bank')
  and name ~* '(^|[[:space:]])banco[[:space:]]';
