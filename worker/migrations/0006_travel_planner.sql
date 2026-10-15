-- Migration 0006: AI Travel Planner & Structured Itineraries (Additive and forward-only)

CREATE TABLE IF NOT EXISTS travel_itineraries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  start_date TEXT NOT NULL,
  departure_time TEXT,
  duration_days INTEGER NOT NULL,
  travelers_count INTEGER NOT NULL,
  children_count INTEGER NOT NULL DEFAULT 0,
  pace TEXT NOT NULL DEFAULT 'moderate',
  transportation TEXT NOT NULL DEFAULT 'car',
  budget_preference TEXT NOT NULL DEFAULT 'moderate',
  interests_json TEXT,
  summary TEXT,
  status TEXT NOT NULL DEFAULT 'saved',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_itineraries_user ON travel_itineraries(user_id);
CREATE INDEX IF NOT EXISTS idx_itineraries_status ON travel_itineraries(status);

CREATE TABLE IF NOT EXISTS itinerary_days (
  id TEXT PRIMARY KEY,
  itinerary_id TEXT NOT NULL REFERENCES travel_itineraries(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  date TEXT,
  title TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_itinerary_days_itin ON itinerary_days(itinerary_id);
CREATE INDEX IF NOT EXISTS idx_itinerary_days_order ON itinerary_days(itinerary_id, day_number);

CREATE TABLE IF NOT EXISTS itinerary_items (
  id TEXT PRIMARY KEY,
  itinerary_id TEXT NOT NULL REFERENCES travel_itineraries(id) ON DELETE CASCADE,
  day_id TEXT NOT NULL REFERENCES itinerary_days(id) ON DELETE CASCADE,
  place_id TEXT REFERENCES places(id) ON DELETE SET NULL,
  item_type TEXT NOT NULL DEFAULT 'place',
  title TEXT NOT NULL,
  planned_time TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  notes TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_user_selected INTEGER NOT NULL DEFAULT 0,
  estimated_travel_minutes INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_itinerary_items_day ON itinerary_items(day_id);
CREATE INDEX IF NOT EXISTS idx_itinerary_items_itin ON itinerary_items(itinerary_id);
CREATE INDEX IF NOT EXISTS idx_itinerary_items_place ON itinerary_items(place_id);
CREATE INDEX IF NOT EXISTS idx_itinerary_items_order ON itinerary_items(day_id, order_index);
