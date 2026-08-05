CREATE TABLE IF NOT EXISTS learner_state (
  id text PRIMARY KEY,
  state jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
