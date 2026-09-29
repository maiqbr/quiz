ALTER TABLE runs ADD COLUMN difficulty TEXT NOT NULL DEFAULT 'easy' CHECK(difficulty IN ('easy','hard'));
ALTER TABLE runs ADD COLUMN total INTEGER NOT NULL DEFAULT 10;
ALTER TABLE runs ADD COLUMN abandoned_at INTEGER;
CREATE INDEX IF NOT EXISTS runs_rank_difficulty ON runs(quiz_id,difficulty,hits DESC,elapsed_ms ASC);
