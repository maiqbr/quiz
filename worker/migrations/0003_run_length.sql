ALTER TABLE runs ADD COLUMN length TEXT NOT NULL DEFAULT 'legacy' CHECK(length IN ('legacy','quick','casual','training'));
CREATE INDEX IF NOT EXISTS runs_rank_length ON runs(quiz_id,length,difficulty,total,hits DESC,elapsed_ms ASC);
