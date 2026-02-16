document.addEventListener('DOMContentLoaded', () => {
    const DATA_URL = '../Hydroelectric/Backend/dashboard_data.json';

    fetch(DATA_URL)
        .then(response => {
            if (!response.ok) throw new Error("Data not found");
            return response.json();
        })
        .then(data => {
            updateKPIs(data.metadata);
            renderChart(data.data);
            document.getElementById('last-updated').innerText = `System Status: ONLINE | Date: ${data.metadata.date}`;
        })
        .catch(error => {
            console.error('Error:', error);
            document.getElementById('last-updated').innerText = "System Status: OFFLINE (Data Missing)";
            document.getElementById('last-updated').style.color = "#ff073a";
        });
});

function updateKPIs(meta) {
    // 1. Profit
    const profitEl = document.getElementById('kpi-profit');
    profitEl.innerText = meta.total_profit > 0 ? `+${meta.total_profit}` : meta.total_profit;
    profitEl.style.color = meta.total_profit >= 0 ? '#39ff14' : '#ff073a'; // Green if positive, Red if negative

    // 2. Inflow
    document.getElementById('kpi-inflow').innerText = meta.net_inflow_today;

    // 3. Trend (Start vs End Level)
    const start = Number(meta.reservoir_start);
    const end = Number(meta.reservoir_end);
    const diff = end - start;
    const trendEl = document.getElementById('kpi-trend');
    const indicator = document.getElementById('trend-indicator');

    trendEl.innerText = `${diff >= 0 ? '+' : ''}${diff.toFixed(1)} MWh`;
    
    if (diff > 0) {
        indicator.className = "status-dot status-green";
    } else if (diff < 0) {
        indicator.className = "status-dot status-red";
    } else {
        indicator.className = "status-dot status-cyan";
    }
}

function renderChart(hourlyData) {
    const ctx = document.getElementById('hydroChart').getContext('2d');
    
    // Parse Arrays
    const labels = hourlyData.map(d => d.hour);
    const prices = hourlyData.map(d => d.price);
    const levels = hourlyData.map(d => d.reservoir);
    
    // Create Chart
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Electricity Price (EUR/MWh)',
                    data: prices,
                    borderColor: '#ff073a', // Red Line for Price
                    backgroundColor: 'rgba(255, 7, 58, 0.1)',
                    borderWidth: 2,
                    yAxisID: 'y-price',
                    tension: 0.4,
                    pointRadius: 0,
                    // --- NEW ANIMATION CONFIG ---
                    animations: {
                        // 1. Disable movement (stops the "falling" effect)
                        y: {
                            duration: 0 
                        },
                        // 2. Add Fade-In effect
                        opacity: {
                            duration: 1000,  // 1 second fade
                            from: 0,
                            to: 1,
                            easing: 'easeOutQuad'
                        }
                    }
                },
                {
                    label: 'Reservoir Level (MWh)',
                    data: levels,
                    borderColor: '#00ffff', // Cyan Line for Water
                    backgroundColor: 'rgba(0, 255, 255, 0.2)', // Filled Area
                    borderWidth: 2,
                    fill: true,
                    yAxisID: 'y-level',
                    tension: 0.4,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 2000, // 2000ms = 2 seconds to finish drawing
                easing: 'easeOutQuart' // Starts fast, slows down at the end
            },
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    labels: { color: '#e5e5e5', font: { family: 'Courier New' } }
                }
            },
            scales: {
                x: {
                    grid: { color: '#333' },
                    ticks: { color: '#888', font: { family: 'Courier New' } }
                },
                'y-price': {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    grid: { color: '#333' },
                    ticks: { color: '#ff073a', font: { family: 'Courier New' } },
                    title: { display: true, text: 'Price (EUR)', color: '#ff073a' }
                },
                'y-level': {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: { drawOnChartArea: false }, // Don't clutter grid
                    ticks: { color: '#00ffff', font: { family: 'Courier New' } },
                    title: { display: true, text: 'Reservoir (MWh)', color: '#00ffff' },
                    min: 0,
                    max: 550 // Slightly above 500 capacity for visual breathing room
                }
            }
        }
    });
}

// --- MODAL LOGIC ---
// --- MODAL LOGIC ---
const modal = document.getElementById("info-modal");
const btn = document.getElementById("about-btn");
const span = document.getElementsByClassName("close-btn")[0];
const modalBody = document.querySelector('.modal-body'); // Ensure this class exists in HTML

// 1. Open Modal & Load Content
btn.onclick = function() {
    modal.style.display = "block";
    loadMarkdownContent();
}

// 2. Close Logic
span.onclick = () => modal.style.display = "none";
window.onclick = (e) => { if (e.target == modal) modal.style.display = "none"; };

// 3. Fetch, Parse, and Render
function loadMarkdownContent() {
    // Prevent reloading if already loaded
    if (modalBody.getAttribute('data-loaded') === 'true') return;

    fetch('HydroDescription.md')
        .then(response => response.text())
        .then(markdown => {
            // A. Convert Markdown to HTML
            modalBody.innerHTML = marked.parse(markdown);

            // B. Render Math with KaTeX
            renderMathInElement(modalBody, {
                delimiters: [
                    {left: '$$', right: '$$', display: true}, // Block Math
                    {left: '$', right: '$', display: false}   // Inline Math
                ]
            });

            // Mark as loaded so we don't fetch again
            modalBody.setAttribute('data-loaded', 'true');
        })
        .catch(err => {
            console.error(err);
            modalBody.innerHTML = "<p style='color:red'>Error loading documentation.</p>";
        });
}

// Close (X button)
span.onclick = function() {
  modal.style.display = "none";
}

// Close (Click outside)
window.onclick = function(event) {
  if (event.target == modal) {
    modal.style.display = "none";
  }
}