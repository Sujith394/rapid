async function loadStations() {
  try {
    const res = await fetch('/api/stations');
    const stations = await res.json();
    const from = document.getElementById('from');
    const to = document.getElementById('to');
    
    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '-- Select Station --';
    from.appendChild(defaultOption);
    to.appendChild(defaultOption.cloneNode(true));
    
    for (const s of stations) {
      const o1 = document.createElement('option');
      o1.value = s.name;
      o1.textContent = s.name;
      from.appendChild(o1);
      
      const o2 = document.createElement('option');
      o2.value = s.name;
      o2.textContent = s.name;
      to.appendChild(o2);
    }
  } catch (error) {
    console.error('Error loading stations:', error);
  }
}

function formatDuration(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function showLoading() {
  const box = document.getElementById('results');
  box.innerHTML = '<div class="loading">🔍 Searching for trains...</div>';
}

function showNoResults() {
  const box = document.getElementById('results');
  box.innerHTML = '<div class="no-results">❌ No trains found for the selected route</div>';
}

async function search() {
  const from = document.getElementById('from').value;
  const to = document.getElementById('to').value;
  const sort = document.getElementById('sort').value;
  
  if (!from || !to) {
    alert('Please select both departure and arrival stations');
    return;
  }
  
  if (from === to) {
    alert('Departure and arrival stations cannot be the same');
    return;
  }
  
  showLoading();
  
  try {
    const res = await fetch(`/api/search?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&sortBy=${sort}`);
    const data = await res.json();
    const box = document.getElementById('results');
    box.innerHTML = '';
    
    if (!Array.isArray(data) || data.length === 0) {
      showNoResults();
      return;
    }
    
    // Add results header
    const header = document.createElement('div');
    header.className = 'results-header';
    header.innerHTML = `
      <div class="results-count">Found ${data.length} route${data.length > 1 ? 's' : ''} from ${from} to ${to}</div>
    `;
    box.appendChild(header);
    
    data.forEach((it, index) => {
      const card = document.createElement('div');
      card.className = 'card';
      
      const head = document.createElement('div');
      head.className = 'row';
             head.innerHTML = `
         <span class="badge">${it.type === 'direct' ? '🚂 Direct' : it.type === 'transfer' ? '🔄 Transfer' : 'ℹ️ Available'}</span>
         <div class="route-info">
           <span class="station">${it.legs[0].from}</span>
           <span class="route-arrow">→</span>
           <span class="station">${it.legs[it.legs.length - 1].to}</span>
         </div>
         ${it.type === 'available' ? 
           `<div class="note-info">${it.note}</div>` :
           `<div class="time-info">
             <span>🕐 ${it.legs[0].departTime} - ${it.legs[it.legs.length - 1].arriveTime}</span>
           </div>
           <div class="distance-info">
             <span>📏 ${it.totalDistanceKm} km</span>
           </div>
           <div class="duration-info">
             <span>⏱️ ${formatDuration(it.totalDurationMin)}</span>
           </div>
           <span class="price">₹ ${it.totalPrice}</span>`
         }
       `;
      card.appendChild(head);
      
      const legs = document.createElement('div');
      legs.className = 'legs';
      
      it.legs.forEach((l, legIndex) => {
        const el = document.createElement('div');
        el.className = 'leg';
        el.innerHTML = `
          <div class="leg-train">${l.trainName}</div>
          <div class="leg-route">${l.from} → ${l.to}</div>
          <div class="leg-details">
            ${l.departTime} - ${l.arriveTime} • ${l.distanceKm} km • ₹ ${l.price}
          </div>
        `;
        legs.appendChild(el);
      });
      
      card.appendChild(legs);
      box.appendChild(card);
    });
  } catch (error) {
    console.error('Error searching:', error);
    const box = document.getElementById('results');
    box.innerHTML = '<div class="no-results">❌ Error occurred while searching. Please try again.</div>';
  }
}

// Event listeners
document.getElementById('search').addEventListener('click', search);

// Allow Enter key to trigger search
document.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    search();
  }
});

// Initialize
loadStations();


