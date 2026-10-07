-- Migration 0001: Initial schema for categories and places

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  icon TEXT
);

CREATE TABLE IF NOT EXISTS places (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category_id TEXT NOT NULL,
  short_description TEXT NOT NULL,
  description TEXT NOT NULL,
  address TEXT,
  latitude REAL,
  longitude REAL,
  image_url TEXT,
  images_json TEXT,
  map_url TEXT,
  opening_hours TEXT,
  phone TEXT,
  website TEXT,
  is_featured INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_places_category_id ON places(category_id);
CREATE INDEX IF NOT EXISTS idx_places_slug ON places(slug);
CREATE INDEX IF NOT EXISTS idx_places_is_featured ON places(is_featured);
