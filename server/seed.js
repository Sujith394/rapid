import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbFile = path.join(__dirname, 'trains.db');
const db = new Database(dbFile);

db.exec(`
PRAGMA foreign_keys = ON;
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
`);

const argMode = process.argv[2] || 'example';

function reset() {
  db.exec('DELETE FROM train_stops; DELETE FROM trains; DELETE FROM stations;');
}

function getOrCreateStation(name) {
  const row = db.prepare('SELECT id FROM stations WHERE name = ?').get(name);
  if (row) return row.id;
  return db.prepare('INSERT INTO stations(name) VALUES(?)').run(name).lastInsertRowid;
}

function addTrain(name, stops) {
  const trainId = db.prepare('INSERT INTO trains(name) VALUES(?)').run(name).lastInsertRowid;
  const stmt = db.prepare('INSERT INTO train_stops(train_id, station_id, stop_index, distance_from_prev_km, departure_time) VALUES (?, ?, ?, ?, ?)');
  stops.forEach((s, idx) => {
    const sid = getOrCreateStation(s.station);
    stmt.run(trainId, sid, idx, s.distanceFromPrevKm, s.departureTime);
  });
}

function seedExample() {
  reset();
  addTrain('Train A', [
    { station: 'Chennai', distanceFromPrevKm: 0, departureTime: '09:00' },
    { station: 'Vellore', distanceFromPrevKm: 170, departureTime: '11:00' },
    { station: 'Bangalore', distanceFromPrevKm: 200, departureTime: '15:30' },
    { station: 'Mysuru', distanceFromPrevKm: 120, departureTime: '17:30' },
    { station: 'Mangalore', distanceFromPrevKm: 300, departureTime: '21:45' }
  ]);

  addTrain('Train B', [
    { station: 'Bangalore', distanceFromPrevKm: 0, departureTime: '09:00' },
    { station: 'Shimoga', distanceFromPrevKm: 180, departureTime: '12:00' },
    { station: 'Mangalore', distanceFromPrevKm: 250, departureTime: '17:30' }
  ]);

  addTrain('Train C', [
    { station: 'Bangalore', distanceFromPrevKm: 0, departureTime: '16:00' },
    { station: 'Shimoga', distanceFromPrevKm: 180, departureTime: '19:00' },
    { station: 'Mangalore', distanceFromPrevKm: 250, departureTime: '23:45' }
  ]);
}

function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function minutesToTime(m) {
  const h = Math.floor(m / 60) % 24; const mm = m % 60; return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function seedRandom({ trains = 1000, stations = 200 }) {
  reset();

  // Generate stations with realistic names - only meaningful names, no generic numbers
  const stationNames = [
    'Mumbai Central', 'Delhi Junction', 'Bangalore City', 'Chennai Central', 'Kolkata Howrah',
    'Hyderabad Deccan', 'Ahmedabad Junction', 'Pune Junction', 'Jaipur Junction', 'Lucknow Junction',
    'Kanpur Central', 'Nagpur Junction', 'Indore Junction', 'Bhopal Junction', 'Patna Junction',
    'Varanasi Junction', 'Amritsar Junction', 'Chandigarh Junction', 'Dehradun Junction', 'Shimla',
    'Mysuru Junction', 'Mangalore Junction', 'Vellore Junction', 'Shimoga Junction', 'Hubli Junction',
    'Belgaum Junction', 'Gulbarga Junction', 'Bidar Junction', 'Nanded Junction', 'Aurangabad Junction',
    'Jalgaon Junction', 'Bhusaval Junction', 'Akola Junction', 'Wardha Junction', 'Gondia Junction',
    'Raipur Junction', 'Bilaspur Junction', 'Jabalpur Junction', 'Bina Junction', 'Gwalior Junction',
    'Agra Cantonment', 'Mathura Junction', 'Aligarh Junction', 'Bareilly Junction', 'Moradabad Junction',
    'Meerut City', 'Ghaziabad Junction', 'Faridabad Junction', 'Gurgaon Junction', 'Sonipat Junction',
    'Panipat Junction', 'Karnal Junction', 'Kurukshetra Junction', 'Ambala Cantonment', 'Ludhiana Junction',
    'Jalandhar City', 'Pathankot Junction', 'Udhampur Junction', 'Jammu Tawi', 'Srinagar',
    'Baramulla Junction', 'Anantnag Junction', 'Pulwama Junction', 'Budgam Junction', 'Ganderbal Junction',
    'Udaipur City', 'Jodhpur Junction', 'Bikaner Junction', 'Ajmer Junction', 'Kota Junction',
    'Bhilwara Junction', 'Chittorgarh Junction', 'Sawai Madhopur', 'Alwar Junction', 'Bharatpur Junction',
    'Jhansi Junction', 'Orai Junction', 'Etawah Junction', 'Firozabad Junction', 'Tundla Junction',
    'Hapur Junction', 'Rewari Junction', 'Bandikui Junction', 'Dausa Junction', 'Ramganj Mandi',
    'Bhawani Mandi', 'Nagda Junction', 'Ratlam Junction', 'Meghnagar Junction', 'Dahod Junction',
    'Godhra Junction', 'Vadodara Junction', 'Surat Junction', 'Valsad Junction', 'Vapi Junction',
    'Boisar Junction', 'Virar Junction', 'Bandra Terminus', 'Dadar Junction', 'Thane Junction',
    'Kalyan Junction', 'Karjat Junction', 'Lonavala Junction', 'Daund Junction', 'Ahmednagar Junction',
    'Manmad Junction', 'Katni Junction', 'Satna Junction', 'Manikpur Junction', 'Prayagraj Junction',
    'Mughal Sarai Junction', 'Buxar Junction', 'Ara Junction', 'Rajgir Junction', 'Gaya Junction',
    'Koderma Junction', 'Hazaribagh Junction', 'Ranchi Junction', 'Tatanagar Junction', 'Chakradharpur Junction',
    'Rourkela Junction', 'Jharsuguda Junction', 'Sambalpur Junction', 'Bargarh Junction', 'Balangir Junction',
    'Titlagarh Junction', 'Durg Junction', 'Bhubaneswar Junction', 'Cuttack Junction', 'Puri Junction',
    'Khurda Road Junction', 'Balasore Junction', 'Bhadrak Junction', 'Jajpur Keonjhar Road', 'Cuttack Junction',
    'Bhubaneswar Junction', 'Khurda Road Junction', 'Puri Junction', 'Brahmapur Junction', 'Vizianagaram Junction',
    'Visakhapatnam Junction', 'Rajahmundry Junction', 'Eluru Junction', 'Vijayawada Junction', 'Guntur Junction',
    'Ongole Junction', 'Nellore Junction', 'Gudur Junction', 'Chennai Central', 'Chengalpattu Junction',
    'Tambaram Junction', 'Chennai Egmore', 'Chennai Beach', 'Chennai Park Town', 'Chennai Fort'
  ];

  const stationIds = [];
  // Use only the meaningful station names, limit to the requested number
  const stationsToCreate = Math.min(stations, stationNames.length);
  
  for (let i = 0; i < stationsToCreate; i++) {
    const name = stationNames[i];
    stationIds.push(db.prepare('INSERT INTO stations(name) VALUES(?)').run(name).lastInsertRowid);
  }

  const insertTrain = db.prepare('INSERT INTO trains(name) VALUES(?)');
  const insertStop = db.prepare('INSERT INTO train_stops(train_id, station_id, stop_index, distance_from_prev_km, departure_time) VALUES (?, ?, ?, ?, ?)');

  // Generate more realistic train patterns
  for (let t = 0; t < trains; t++) {
    const trainId = insertTrain.run(`Train ${t + 1}`).lastInsertRowid;
    const numStops = randomInt(3, 8); // More realistic stop count
    let currentTime = randomInt(4 * 60, 22 * 60); // start between 04:00-22:00
    let prevStation = randomInt(0, stationIds.length - 1);
    
    insertStop.run(trainId, stationIds[prevStation], 0, 0, minutesToTime(currentTime));
    
    for (let s = 1; s < numStops; s++) {
      const travel = randomInt(20, 150); // More realistic distances
      currentTime = (currentTime + randomInt(15, 120)) % 1440; // 15min - 2h later
      const nextStation = (prevStation + randomInt(1, Math.min(5, stationIds.length - prevStation))) % stationIds.length;
      insertStop.run(trainId, stationIds[nextStation], s, travel, minutesToTime(currentTime));
      prevStation = nextStation;
    }
  }

  // Add some guaranteed routes between major cities
  const majorStations = stationIds.slice(0, 20); // First 20 are major stations
  for (let i = 0; i < 50; i++) {
    const fromIdx = randomInt(0, majorStations.length - 1);
    const toIdx = randomInt(0, majorStations.length - 1);
    if (fromIdx !== toIdx) {
      const trainId = insertTrain.run(`Express ${i + 1}`).lastInsertRowid;
      const fromStation = majorStations[fromIdx];
      const toStation = majorStations[toIdx];
      const distance = randomInt(50, 300);
      const duration = randomInt(30, 180);
      
      insertStop.run(trainId, fromStation, 0, 0, minutesToTime(randomInt(6 * 60, 20 * 60)));
      insertStop.run(trainId, toStation, 1, distance, minutesToTime(randomInt(6 * 60, 20 * 60) + duration));
    }
  }

  // Add guaranteed routes between all major cities for better coverage
  addGuaranteedRoutes(majorStations, insertTrain, insertStop);
}

function addGuaranteedRoutes(majorStations, insertTrain, insertStop) {
  // Create direct routes between all major cities
  const majorCityNames = [
    'Mumbai Central', 'Delhi Junction', 'Bangalore City', 'Chennai Central', 'Kolkata Howrah',
    'Hyderabad Deccan', 'Ahmedabad Junction', 'Pune Junction', 'Jaipur Junction', 'Lucknow Junction'
  ];
  
  // Create multiple trains between each pair of major cities
  for (let i = 0; i < majorCityNames.length; i++) {
    for (let j = i + 1; j < majorCityNames.length; j++) {
      const fromName = majorCityNames[i];
      const toName = majorCityNames[j];
      
      // Find station IDs
      const fromStation = db.prepare('SELECT id FROM stations WHERE name = ?').get(fromName);
      const toStation = db.prepare('SELECT id FROM stations WHERE name = ?').get(toName);
      
      if (fromStation && toStation) {
        // Add 3-5 trains between each major city pair
        const numTrains = randomInt(3, 5);
        for (let t = 0; t < numTrains; t++) {
          const trainId = insertTrain.run(`${fromName.split(' ')[0]}-${toName.split(' ')[0]} Express ${t + 1}`).lastInsertRowid;
          const distance = randomInt(100, 800);
          const departTime = randomInt(6 * 60, 20 * 60); // 6 AM to 8 PM
          const duration = randomInt(60, 300); // 1-5 hours
          
          insertStop.run(trainId, fromStation.id, 0, 0, minutesToTime(departTime));
          insertStop.run(trainId, toStation.id, 1, distance, minutesToTime(departTime + duration));
        }
      }
    }
  }
  
  // Add regional routes (shorter distances)
  const regionalStations = majorStations.slice(10, 20); // Next 10 stations
  for (let i = 0; i < 100; i++) {
    const fromIdx = randomInt(0, regionalStations.length - 1);
    const toIdx = randomInt(0, regionalStations.length - 1);
    if (fromIdx !== toIdx) {
      const trainId = insertTrain.run(`Regional ${i + 1}`).lastInsertRowid;
      const fromStation = regionalStations[fromIdx];
      const toStation = regionalStations[toIdx];
      const distance = randomInt(30, 200);
      const departTime = randomInt(5 * 60, 21 * 60);
      const duration = randomInt(20, 120);
      
      insertStop.run(trainId, fromStation, 0, 0, minutesToTime(departTime));
      insertStop.run(trainId, toStation, 1, distance, minutesToTime(departTime + duration));
    }
  }
}

if (argMode === 'random') {
  const trainsIdx = process.argv.indexOf('--trains');
  const stationsIdx = process.argv.indexOf('--stations');
  const countTrains = trainsIdx !== -1 ? Number(process.argv[trainsIdx + 1]) : 1000;
  const countStations = stationsIdx !== -1 ? Number(process.argv[stationsIdx + 1]) : 200;
  seedRandom({ trains: countTrains, stations: countStations });
  console.log(`Seeded random data: ${countTrains} trains, ${countStations} stations`);
} else {
  seedExample();
  console.log('Seeded example data');
}


