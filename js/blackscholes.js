// --- 1. Math Helper Functions (The Quant Engine) ---

// Standard Normal PDF
function pdf(x) {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

// Standard Normal CDF (Abramowitz and Stegun approximation)
function cdf(x) {
    var sign = (x >= 0) ? 1 : -1;
    x = Math.abs(x);

    var a1 =  0.254829592;
    var a2 = -0.284496736;
    var a3 =  1.421413741;
    var a4 = -1.453152027;
    var a5 =  1.061405429;
    var p  =  0.3275911;

    var t = 1.0 / (1.0 + p * x);
    var y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
}

// Black-Scholes Calculator Class
class BlackScholes {
    constructor(S, K, r, T, sigma) {
        this.S = S;
        this.K = K;
        this.r = r;
        this.T = T;
        this.sigma = sigma;
        this.calculateD1D2();
    }

    calculateD1D2() {
        this.d1 = (Math.log(this.S / this.K) + (this.r + 0.5 * Math.pow(this.sigma, 2)) * this.T) / (this.sigma * Math.sqrt(this.T));
        this.d2 = this.d1 - this.sigma * Math.sqrt(this.T);
    }

    // Pricing
    callPrice() {
        return this.S * cdf(this.d1) - this.K * Math.exp(-this.r * this.T) * cdf(this.d2);
    }

    putPrice() {
        return this.K * Math.exp(-this.r * this.T) * cdf(-this.d2) - this.S * cdf(-this.d1);
    }

    // Greeks
    deltaCall() { return cdf(this.d1); }
    deltaPut() { return cdf(this.d1) - 1; }
    
    gamma() {
        return pdf(this.d1) / (this.S * this.sigma * Math.sqrt(this.T));
    }

    vega() {
        return this.S * pdf(this.d1) * Math.sqrt(this.T) / 100; // Scaled for % change
    }

    thetaCall() {
        let t1 = -(this.S * pdf(this.d1) * this.sigma) / (2 * Math.sqrt(this.T));
        let t2 = -this.r * this.K * Math.exp(-this.r * this.T) * cdf(this.d2);
        return (t1 + t2) / 365; // Daily theta
    }

    rhoCall() {
        return (this.K * this.T * Math.exp(-this.r * this.T) * cdf(this.d2)) / 100; // Scaled for % change
    }
}

// --- 2. Application State & Interaction ---

const inputs = {
    S: document.getElementById('input-S'),
    K: document.getElementById('input-K'),
    sigma: document.getElementById('input-sigma'),
    r: document.getElementById('input-r'),
    T: document.getElementById('input-T')
};

const displays = {
    S: document.getElementById('val-S'),
    K: document.getElementById('val-K'),
    sigma: document.getElementById('val-sigma'),
    r: document.getElementById('val-r'),
    T: document.getElementById('val-T')
};

const metrics = {
    call: document.getElementById('disp-call'),
    put: document.getElementById('disp-put'),
    delta: document.getElementById('disp-delta'),
    gamma: document.getElementById('disp-gamma'),
    theta: document.getElementById('disp-theta'),
    vega: document.getElementById('disp-vega'),
    rho: document.getElementById('disp-rho')
};

function updateAll() {
    // 1. Get Values
    const S = parseFloat(inputs.S.value);
    const K = parseFloat(inputs.K.value);
    const sigma = parseFloat(inputs.sigma.value);
    const r = parseFloat(inputs.r.value);
    const T = parseFloat(inputs.T.value);

    // 2. Update Display Text
    displays.S.innerText = S;
    displays.K.innerText = K;
    displays.sigma.innerText = sigma.toFixed(2);
    displays.r.innerText = r.toFixed(3);
    displays.T.innerText = T.toFixed(2);

    // 3. Calculate Point Metrics
    const bs = new BlackScholes(S, K, r, T, sigma);
    
    metrics.call.innerText = bs.callPrice().toFixed(2);
    metrics.put.innerText = bs.putPrice().toFixed(2);
    metrics.delta.innerText = bs.deltaCall().toFixed(4);
    metrics.gamma.innerText = bs.gamma().toFixed(4);
    metrics.theta.innerText = bs.thetaCall().toFixed(4);
    metrics.vega.innerText = bs.vega().toFixed(4);
    metrics.rho.innerText = bs.rhoCall().toFixed(4);

    // 4. Update 3D Surface Plot
    updateChart(S, K, r, T, sigma);
}

// --- 3. Plotly Visualization Logic ---

function generateSurfaceData(currentS, K, r, currentT, sigma) {
    // X-Axis: Stock Price +/- 50%
    const rangePct = 0.50;
    const minS = currentS * (1 - rangePct);
    const maxS = currentS * (1 + rangePct);
    const stepsS = 30;
    const stepSizeS = (maxS - minS) / stepsS;

    // Y-Axis: Time (0.01 to current T * 1.5)
    const maxT = Math.max(currentT * 1.5, 1.0);
    const stepsT = 30;
    const stepSizeT = maxT / stepsT;

    let x_data = []; // Stock Prices
    let y_data = []; // Time
    let z_data = []; // Gamma

    for (let i = 0; i <= stepsT; i++) {
        let t_val = 0.01 + i * stepSizeT; // Avoid t=0
        let row_z = [];
        
        y_data.push(t_val); 

        for (let j = 0; j <= stepsS; j++) {
            let s_val = minS + j * stepSizeS;
            
            // Only populate X array on the first pass (since grid is rectangular)
            if (i === 0) x_data.push(s_val);

            // Calculate Gamma for this coordinate
            let bs_temp = new BlackScholes(s_val, K, r, t_val, sigma);
            row_z.push(bs_temp.gamma());
        }
        z_data.push(row_z);
    }

    return { x: x_data, y: y_data, z: z_data };
}

function initChart() {
    const data = { z: [[0]] }; // Dummy init
    const layout = {
        title: '', // Remove title to save space (or keep it if you want)
        autosize: true, // IMPORTANT: Tells Plotly to fill the div
        paper_bgcolor: '#1c212e',
        font: { color: '#e2e8f0' },
        uirevision: true,
        // ZERO MARGINS: This removes the whitespace around the chart
        margin: { l: 0, r: 0, b: 0, t: 0 }, 
        scene: {
            xaxis: { title: 'Stock Price ($)', color: '#e2e8f0' },
            yaxis: { title: 'Time (Yrs)', color: '#e2e8f0' },
            zaxis: { 
                title: 'Gamma', 
                color: '#e2e8f0',
                gridcolor: '#475569',
                zerolinecolor: '#e2e8f0',
                showbackground: false,
                backgroundcolor: '#0f111a'
            },
            // CAMERA: Zoom in slightly (smaller z = closer)
            camera: {
                eye: { x: 1.34, y: 1.34, z: 1 },
                center: { x: 0, y: 0, z: -0.2 } 
            },
            // ASPECT RATIO: Keeps the box looking like a box, not a pancake
            aspectmode: 'cube' 
        }
    };
    const config = { responsive: true, displayModeBar: false };
    Plotly.newPlot('plot-container', [data], layout, config);
}

function updateChart(S, K, r, T, sigma) {
    const surfaceData = generateSurfaceData(S, K, r, T, sigma);
    
    // Note: Plotly Surface expects z as 2D array, x and y as 1D arrays
    const trace = {
        type: 'surface',
        x: surfaceData.x,
        y: surfaceData.y,
        z: surfaceData.z,
        colorscale: 'Dense',
        showscale: false,
        contours: {
            x: { show: true, color: '#FFFFFF' },
            y: { show: true, color: '#FFFFFF' },
            z: { show: true, usecolormap: true, project: { z: true } }
        }
    };

    const layout = {
        // Keep margins zero on update
        paper_bgcolor: '#1c212e',
        font: { color: '#e2e8f0' },
        margin: { l: 0, r: 0, b: 0, t: 0 },
        autosize: true,
        uirevision: true,
        scene: {
            xaxis: { title: 'Stock Price ($)', gridcolor: '#444' },
            yaxis: { title: 'Time to Mat (Yrs)', gridcolor: '#444' },
            zaxis: { 
                title: 'Gamma', 
                color: '#e2e8f0',
                gridcolor: '#475569',
                zerolinecolor: '#e2e8f0',
                showbackground: false,
                backgroundcolor: '#0f111a'
            },
            aspectmode: 'cube',
            camera: {
                eye: { x: 1.34, y: 1.34, z: 1 },
                center: { x: 0, y: 0, z: -0.2 } 
            }
        }
    };
 
    Plotly.react('plot-container', [trace], layout);
}

// --- 4. Initialization ---

// Add listeners
Object.values(inputs).forEach(input => {
    input.addEventListener('input', updateAll);
});

// Initial render
document.addEventListener("DOMContentLoaded", () => {
    initChart();
    updateAll();
});

// 5. Handle Window Resize
window.addEventListener('resize', function() {
    Plotly.Plots.resize('plot-container');
});

// --- 6. Modal Interaction Logic ---

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

    fetch('BSDescription.md')
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