import express from 'express';
import Database from 'better-sqlite3';
import path from 'path';
import cors from 'cors';
import morgan from 'morgan';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbFile = path.join(__dirname, 'trains.db');
const db = new Database(dbFile);

db.pragma('journal_mode = WAL');

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Create tables if not exists
db.exec(`
CREATE TABLE IF NOT EXISTS stations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS trains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS train_stops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  train_id INTEGER NOT NULL,
  station_id INTEGER NOT NULL,
  stop_index INTEGER NOT NULL,
  distance_from_prev_km INTEGER NOT NULL,
  departure_time TEXT NOT NULL,
  FOREIGN KEY (train_id) REFERENCES trains(id) ON DELETE CASCADE,
  FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_train_stops_train ON train_stops(train_id, stop_index);
CREATE INDEX IF NOT EXISTS idx_train_stops_station ON train_stops(station_id);
`);

// Helpers
function getOrCreateStation(name) {
  const trimmed = name.trim();
  const row = db.prepare('SELECT id FROM stations WHERE name = ?').get(trimmed);
  if (row) return row.id;
  const info = db.prepare('INSERT INTO stations(name) VALUES(?)').run(trimmed);
  return info.lastInsertRowid;
}

function timeToMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins) {
  const m = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

// Price per km
const PRICE_PER_KM = 1.25;

// Routes
app.get('/api/stations', (req, res) => {
  // Only return stations that have trains available
  const rows = db.prepare(`
    SELECT DISTINCT s.id, s.name 
    FROM stations s
    INNER JOIN train_stops ts ON s.id = ts.station_id
    ORDER BY s.name
  `).all();
  res.json(rows);
});

// Search trains for direct or multi-leg routes
// Query params: from, to, sortBy=price|duration
app.get('/api/search', (req, res) => {
  const { from, to, sortBy = 'price' } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from and to are required' });

  const fromStation = db.prepare('SELECT id, name FROM stations WHERE name = ? OR id = ?').get(from, from);
  const toStation = db.prepare('SELECT id, name FROM stations WHERE name = ? OR id = ?').get(to, to);
  if (!fromStation || !toStation) return res.status(404).json({ error: 'Station not found' });

  // Find direct trains first
  const direct = db.prepare(`
    SELECT t.id as train_id, t.name as train_name,
           s1.departure_time as depart_time,
           s2.departure_time as arrive_time,
           s1.stop_index as from_index, s2.stop_index as to_index
    FROM trains t
    JOIN train_stops s1 ON s1.train_id = t.id AND s1.station_id = ?
    JOIN train_stops s2 ON s2.train_id = t.id AND s2.station_id = ?
    WHERE s1.stop_index < s2.stop_index
    ORDER BY t.id, s1.stop_index
  `).all(fromStation.id, toStation.id);

  const results = [];
  for (const row of direct) {
    const dist = db.prepare(`
      SELECT SUM(distance_from_prev_km) as km
      FROM train_stops
      WHERE train_id = ? AND stop_index > ? AND stop_index <= ?
    `).get(row.train_id, row.from_index, row.to_index).km || 0;
    const duration = (timeToMinutes(row.arrive_time) - timeToMinutes(row.depart_time) + 1440) % 1440;
    results.push({
      type: 'direct',
      legs: [
        {
          trainId: row.train_id,
          trainName: row.train_name,
          from: fromStation.name,
          to: toStation.name,
          departTime: row.depart_time,
          arriveTime: row.arrive_time,
          distanceKm: dist,
          price: +(dist * PRICE_PER_KM).toFixed(2),
          durationMin: duration
        }
      ],
      totalDistanceKm: dist,
      totalPrice: +(dist * PRICE_PER_KM).toFixed(2),
      totalDurationMin: duration
    });
  }

  // One-transfer itineraries - use only stations that have trains
  const transferStations = db.prepare(`
    SELECT DISTINCT s.id, s.name 
    FROM stations s
    INNER JOIN train_stops ts ON s.id = ts.station_id
  `).all();
  
  for (const mid of transferStations) {
    if (mid.id === fromStation.id || mid.id === toStation.id) continue;
    
    const leg1 = db.prepare(`
      SELECT t.id as train_id, t.name as train_name,
             s1.departure_time as depart_time,
             s2.departure_time as arrive_time,
             s1.stop_index as from_index, s2.stop_index as to_index
      FROM trains t
      JOIN train_stops s1 ON s1.train_id = t.id AND s1.station_id = ?
      JOIN train_stops s2 ON s2.train_id = t.id AND s2.station_id = ?
      WHERE s1.stop_index < s2.stop_index
    `).all(fromStation.id, mid.id);

    if (leg1.length === 0) continue;

    const leg2 = db.prepare(`
      SELECT t.id as train_id, t.name as train_name,
             s1.departure_time as depart_time,
             s2.departure_time as arrive_time,
             s1.stop_index as from_index, s2.stop_index as to_index
      FROM trains t
      JOIN train_stops s1 ON s1.train_id = t.id AND s1.station_id = ?
      JOIN train_stops s2 ON s2.train_id = t.id AND s2.station_id = ?
      WHERE s1.stop_index < s2.stop_index
    `).all(mid.id, toStation.id);

    if (leg2.length === 0) continue;

    for (const a of leg1) {
      for (const b of leg2) {
        // Simple transfer rule: second leg departs same day after first arrives, or later time
        const arriveA = timeToMinutes(a.arrive_time);
        const departB = timeToMinutes(b.depart_time);
        if (departB <= arriveA) continue;

        const distA = db.prepare(`
          SELECT SUM(distance_from_prev_km) as km
          FROM train_stops WHERE train_id = ? AND stop_index > ? AND stop_index <= ?
        `).get(a.train_id, a.from_index, a.to_index).km || 0;
        const distB = db.prepare(`
          SELECT SUM(distance_from_prev_km) as km
          FROM train_stops WHERE train_id = ? AND stop_index > ? AND stop_index <= ?
        `).get(b.train_id, b.from_index, b.to_index).km || 0;
        const duration = (timeToMinutes(b.arrive_time) - timeToMinutes(a.depart_time) + 1440) % 1440;

        const totalKm = distA + distB;
        results.push({
          type: 'transfer',
          legs: [
            {
              trainId: a.train_id,
              trainName: a.train_name,
              from: fromStation.name,
              to: mid.name,
              departTime: a.depart_time,
              arriveTime: a.arrive_time,
              distanceKm: distA,
              price: +(distA * PRICE_PER_KM).toFixed(2)
            },
            {
              trainId: b.train_id,
              trainName: b.train_name,
              from: mid.name,
              to: toStation.name,
              departTime: b.depart_time,
              arriveTime: b.arrive_time,
              distanceKm: distB,
              price: +(distB * PRICE_PER_KM).toFixed(2)
            }
          ],
          totalDistanceKm: totalKm,
          totalPrice: +(totalKm * PRICE_PER_KM).toFixed(2),
          totalDurationMin: duration
        });
      }
    }
  }

  // If no direct or transfer routes found, try to find any possible route
  if (results.length === 0) {
    // Find any train that goes through both stations (even if not in sequence)
    const fallbackRoutes = db.prepare(`
      SELECT DISTINCT t.id as train_id, t.name as train_name
      FROM trains t
      JOIN train_stops s1 ON s1.train_id = t.id AND s1.station_id = ?
      JOIN train_stops s2 ON s2.train_id = t.id AND s2.station_id = ?
    `).all(fromStation.id, toStation.id);
    
    if (fallbackRoutes.length > 0) {
      // Create a simple route showing these trains exist
      for (const route of fallbackRoutes) {
        results.push({
          type: 'available',
          legs: [
            {
              trainId: route.train_id,
              trainName: route.train_name,
              from: fromStation.name,
              to: toStation.name,
              departTime: 'Check Schedule',
              arriveTime: 'Check Schedule',
              distanceKm: 0,
              price: 0,
              durationMin: 0
            }
          ],
          totalDistanceKm: 0,
          totalPrice: 0,
          totalDurationMin: 0,
          note: 'Trains available on this route - check detailed schedule'
        });
      }
    }
  }

  const sorted = results.sort((a, b) => {
    if (sortBy === 'duration') return a.totalDurationMin - b.totalDurationMin;
    return a.totalPrice - b.totalPrice;
  });
  res.json(sorted);
});

// Admin endpoints for adding trains and stops (simple, not authenticated)
app.post('/api/stations', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const id = getOrCreateStation(name);
    res.json({ id, name });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/trains', (req, res) => {
  const { name, stops } = req.body;
  if (!name || !Array.isArray(stops) || stops.length === 0) {
    return res.status(400).json({ error: 'name and stops[] required' });
  }
  const tx = db.transaction(() => {
    const trainId = db.prepare('INSERT INTO trains(name) VALUES(?)').run(name).lastInsertRowid;
    const insertStop = db.prepare(`INSERT INTO train_stops(train_id, station_id, stop_index, distance_from_prev_km, departure_time) VALUES (?, ?, ?, ?, ?)`);
    stops.forEach((s, idx) => {
      const stationId = getOrCreateStation(s.station);
      insertStop.run(trainId, stationId, idx, s.distanceFromPrevKm, s.departureTime);
    });
    return trainId;
  });
  try {
    const id = tx();
    res.json({ id });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Serve frontend
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server listening on http://localhost:${port}`));


