CREATE TABLE IF NOT EXISTS diseases (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    crop TEXT NOT NULL,
    category TEXT NOT NULL,
    symptoms TEXT NOT NULL,
    causes TEXT NOT NULL,
    conditions TEXT NOT NULL,
    prevention TEXT NOT NULL,
    management TEXT NOT NULL,
    symptom_tags TEXT NOT NULL,
    ipm TEXT NOT NULL,
    image TEXT,
    source TEXT NOT NULL DEFAULT 'local-extension-data'
);

CREATE TABLE IF NOT EXISTS symptom_queries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    crop TEXT,
    symptom TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
