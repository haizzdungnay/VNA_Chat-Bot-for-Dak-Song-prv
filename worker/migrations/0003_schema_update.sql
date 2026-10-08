-- Migration 0003: Add source_type to places and ensure articles schema
ALTER TABLE places ADD COLUMN source_type TEXT DEFAULT 'verified';

CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category_name TEXT NOT NULL,
  quote TEXT,
  content TEXT,
  image_url TEXT,
  publish_date TEXT,
  view_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category_name);
