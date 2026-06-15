-- user_guidance_events: Sistema de persistencia para hints contextuales
-- Registra cuándo un hint fue visto (seen_at), dismissido (dismissed_at) o completado (completed_at)
-- RLS habilitado: usuario solo puede ver sus propios registros

CREATE TABLE user_guidance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  guidance_id TEXT NOT NULL,

  -- Timestamps de eventos
  seen_at TIMESTAMP WITH TIME ZONE,
  dismissed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,

  -- Metadata flexible
  metadata JSONB,

  -- Auditoría
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  UNIQUE(user_id, guidance_id)
);

-- Índice para queries por user_id
CREATE INDEX idx_user_guidance_events_user_id ON user_guidance_events(user_id);

-- RLS: usuario solo puede SELECT/INSERT/UPDATE sus propios registros
ALTER TABLE user_guidance_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_guidance_events_select ON user_guidance_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY user_guidance_events_insert ON user_guidance_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_guidance_events_update ON user_guidance_events
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- No permitir DELETE directo (hints no se borran, solo se marcan dismissed/completed)
-- Si necesitas limpiar, usa UPDATE dismissed_at

COMMENT ON TABLE user_guidance_events IS 'Persistencia de hints contextuales. Sincroniza entre web/mobile.';
COMMENT ON COLUMN user_guidance_events.guidance_id IS 'ID del hint (ej: first_movement.type, accounts.discovery)';
COMMENT ON COLUMN user_guidance_events.seen_at IS 'Cuándo se renderizó/vio el hint';
COMMENT ON COLUMN user_guidance_events.dismissed_at IS 'Cuándo el user lo cerró/dismissió';
COMMENT ON COLUMN user_guidance_events.completed_at IS 'Cuándo se completó la acción objetivo';
