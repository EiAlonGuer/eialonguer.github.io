async function loadDashboard() {
        const response = await fetch('dashboard_data.json');
        const data = await response.json();
        console.log(data)
        // Update Text Metrics
        document.getElementById('pair-badge').textContent = data.metadata.pair;
        document.getElementById('last-updated').textContent = `Last Updated: ${data.metadata.last_updated}`;
        document.getElementById('beta-val').textContent = data.metadata.current_beta;
        document.getElementById('price-val').textContent = `$${data.metadata.current_price_a}`;
        
        const zScore = data.metadata.current_z;
        const zEl = document.getElementById('score-val');
        zEl.textContent = zScore;
        zEl.className = `stat-val ${zScore > 2 ? 'text-red' : zScore < -2 ? 'text-green' : 'text-white'}`;

        // Common Chart Options
        const commonOptions = {
                responsive: true,
                maintainAspectRatio: false,
                // INTERACTION SETTINGS UPDATED HERE
                interaction: {
                    mode: 'index',   // Shows tooltip for all datasets at this X-index
                    intersect: false // Trigger tooltip without hovering exactly over the point
                },
                plugins: { 
                    legend: { labels: { color: '#c9d1d9' } },
                    tooltip: {
                        backgroundColor: 'rgba(22, 27, 34, 0.9)',
                        titleColor: '#c9d1d9',
                        bodyColor: '#c9d1d9',
                        borderColor: '#30363d',
                        borderWidth: 1
                    }
                },
                scales: {
                    x: { 
                        grid: { color: '#30363d' }, 
                        ticks: { color: '#8b949e' } 
                    },
                    y: { 
                        grid: { color: '#30363d' }, 
                        ticks: { color: '#8b949e' } 
                    }
                }
            };

        // 1. Z-Score Chart
        new Chart(document.getElementById('zScoreChart'), {
            type: 'line',
            data: {
                labels: data.dates,
                datasets: [{
                    label: 'Z-Score',
                    data: data.z_score,
                    borderColor: '#58a6ff',
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.1
                }]
            },
            options: {
                ...commonOptions,
                plugins: {
                    annotation: {
                        annotations: {
                            line1: { type: 'line', yMin: 2, yMax: 2, borderColor: 'rgba(255, 99, 132, 0.5)', borderWidth: 2 },
                            line2: { type: 'line', yMin: -2, yMax: -2, borderColor: 'rgba(75, 192, 192, 0.5)', borderWidth: 2 }
                        }
                    }
                }
            }
        });

        // 2. Beta Chart
        new Chart(document.getElementById('betaChart'), {
            type: 'line',
            data: {
                labels: data.dates,
                datasets: [{
                    label: 'Dynamic Beta',
                    data: data.beta,
                    borderColor: '#bc8cff',
                    borderWidth: 1.5,
                    pointRadius: 0
                }]
            },
            options: commonOptions
        });

        // 3. Performance Chart
        // 3. Performance Chart (Updated for simultaneous tooltips)
            new Chart(document.getElementById('perfChart'), {
                type: 'line',
                data: {
                    labels: data.dates,
                    datasets: [
                        {
                            label: 'Strategy',
                            data: data.cum_strategy,
                            borderColor: '#2ea043',
                            borderWidth: 2,
                            pointRadius: 0,
                            pointHoverRadius: 4, // Make point visible on hover
                            tension: 0.1
                        },
                        {
                            label: 'Buy & Hold',
                            data: data.cum_buy_hold,
                            borderColor: '#8b949e',
                            borderWidth: 1,
                            borderDash: [5, 5],
                            pointRadius: 0,
                            pointHoverRadius: 4, // Make point visible on hover
                            tension: 0.1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',   // Shows both lines at this index
                        intersect: false // Triggers even if you aren't touching the line directly
                    },
                    plugins: { 
                        legend: { labels: { color: '#c9d1d9' } },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            backgroundColor: 'rgba(22, 27, 34, 0.9)', // Matches your dark theme
                            titleColor: '#c9d1d9',
                            bodyColor: '#c9d1d9',
                            borderColor: '#30363d',
                            borderWidth: 1
                        }
                    },
                    scales: {
                        x: { grid: { color: '#30363d' }, ticks: { color: '#8b949e' } },
                        y: { grid: { color: '#30363d' }, ticks: { color: '#8b949e' } }
                    }
                }
            });
    }

    loadDashboard();