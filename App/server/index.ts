import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { pool } from './db';

// Single-learner app: one fixed row holds the whole LearnerState blob, same
// shape as the DynamoDB design in infra/lambda/state-handler.ts.
const ROW_ID = 'local';
const MAX_STATE_BYTES = 380_000;
const PORT = Number(process.env.PORT ?? 8787);

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/state', async (_req, res) => {
  const { rows } = await pool.query(
    'SELECT state, updated_at FROM learner_state WHERE id = $1',
    [ROW_ID],
  );
  if (rows.length === 0) {
    res.status(404).json({ error: 'no state saved yet' });
    return;
  }
  res.json({ state: rows[0].state, updatedAt: rows[0].updated_at });
});

app.put('/api/state', async (req, res) => {
  const bodyBytes = Buffer.byteLength(JSON.stringify(req.body ?? {}), 'utf8');
  if (bodyBytes > MAX_STATE_BYTES) {
    res.status(413).json({ error: 'state too large' });
    return;
  }
  const state = req.body?.state;
  if (typeof state !== 'object' || state === null || typeof state.version !== 'number') {
    res.status(400).json({ error: 'body must be { state: LearnerState }' });
    return;
  }
  const { rows } = await pool.query(
    `INSERT INTO learner_state (id, state, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at
     RETURNING updated_at`,
    [ROW_ID, state],
  );
  res.json({ updatedAt: rows[0].updated_at });
});

app.listen(PORT, () => {
  console.log(`Yorùbá Yé Mi state server listening on http://localhost:${PORT}`);
});
