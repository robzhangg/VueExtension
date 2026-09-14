(function() {
    'use strict';

    const seenShowtimes = new Set(); 
    let panel = null;
    let chartBox = null;
    const seatCharts = {};

    function ensureChartBox() {
        if (chartBox) return chartBox;
        chartBox = document.createElement('div');
        chartBox.style.cssText = `
            position: fixed; top: 80px; right: 350px;
            background: #eaeaea; padding: 10px; border-radius: 8px;
            z-index: 999999; display: none;
            box-shadow: inset 0 0 0 2px #404040;
        `;
        document.body.appendChild(chartBox);
        return chartBox;
    }

    function ensurePanel() {
        if (panel) return panel;
        panel = document.createElement('div');
        panel.style.cssText = `
            position: fixed; top: 80px; right: 20px; width: 320px;
            background: #111; color: #fff; font-family: sans-serif;
            font-size: 13px; padding: 12px; border-radius: 8px;
            z-index: 999999; max-height: 80vh; overflow-y: auto;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        `;
        panel.innerHTML = '<strong>SEAT CHECKER</strong><div id="vsc-body"></div>';
        document.body.appendChild(panel);
        return panel;
    }

    function renderRow(session, occupancyPct) {
        let row = document.getElementById(`vsc-row-${session.sessionId}`);
        if (!row) {
            row = document.createElement('div');
            row.style.cssText = 'padding:6px 0; border-top:1px solid #333;';
            row.id = `vsc-row-${session.sessionId}`;
            document.getElementById('vsc-body').appendChild(row);
            
        }
        row.textContent = formatLabel(session, occupancyPct);
        row.addEventListener('mouseenter', () => {
                const chart = seatCharts[session.sessionId]
                if (!chart) return;
                const box = ensureChartBox();
                box.innerHTML = '';
                box.appendChild(chart);
                box.style.display = 'block';
            });
        row.addEventListener('mouseleave', () =>{
            chartBox.style.display = 'none';
        });
    }

    async function fetchSeats(cinemaId, sessionId) {
        try {
            const res = await fetch(`https://www.myvue.com/api/microservice/booking/Session/${cinemaId}/${sessionId}/seats`);
            if (!res.ok) return null;
            const data = await res.json();
            console.log(sessionId)
            const chart = buildSeatChart(data.result.seatRows, data.result.areaCategories);
            seatCharts[sessionId] = chart;
            return Math.round((data.result.sessionOccupancy || 0) * 100);
        } catch (e) {
            console.warn('[VueSeatChecker] seat fetch failed', sessionId, e);
            return 'error';
        }
    }
    function formatLabel(session, occupancyPct) {
        const time = new Date(session.startTime).toLocaleString([], {
            weekday: 'short', day: 'numeric', month: 'short',
            hour: '2-digit', minute: '2-digit'
        });
        const label = occupancyPct === null ? 'checking...' :
        occupancyPct < 20 ? `Quiet - ${100-occupancyPct}% available` :
        occupancyPct < 60 ? `Moderate - ${100-occupancyPct}% available` :
        `Busy - ${100-occupancyPct}% available`;
        return `${time} (${session.screenName}): ${label}`;
    }
    function buildSeatChart(seatRows, areaCategories) {
        const chartLegend = buildAreaLookup(areaCategories);


        const chartDiv = document.createElement('div');
        chartDiv.style.cssText = 'align-items: center; display: flex; flex-direction: column'
        const screen = document.createElement('div');
        screen.style.cssText = `
        width: 100%;
        background: transparent;
        text-align: center;
        color: #000000;
        font-weight: 600;
        `;        
        screen.textContent = "SCREEN";
        chartDiv.appendChild(screen);

        const legend = buildLegend(areaCategories);

        chartDiv.appendChild(legend);


        for (const row of seatRows) {
            const rowDiv = buildRowElement(row, chartLegend);
            chartDiv.appendChild(rowDiv);
        }
        return chartDiv;
    }

    function buildAreaLookup(areaCategories) {
        const lookup = {}
        for (const category of areaCategories) {
            lookup[category.areaCategoryCode] = {
                color: category.areaColor,
                name: category.areaName
            }
        }
        return lookup
    }

    function buildLegend(areaCategories) {
        const legend = document.createElement('div');
        legend.style.cssText = 'display: flex; color: #000000; font-size: 70%';

        const item = document.createElement('div');
        item.style.cssText = 'display: flex; align-items: center; gap: 4px; margin-right: 10px;';

        const swatch = document.createElement('div');
        swatch.style.cssText = `width:14px; height:14px; border: 2px solid #3a96d1; background: transparent;`;
        
        const label = document.createElement('span');
        label.textContent = 'DISABLED';

        item.appendChild(swatch);
        item.appendChild(label);
        legend.appendChild(item);



        for (const category of areaCategories) {
            const item = document.createElement('div');
            item.style.cssText = 'display: flex; align-items: center; gap: 4px; margin-right: 10px;';

            const swatch = document.createElement('div');
            swatch.style.cssText = `width:14px; height:14px; border: 2px solid ${category.areaColor}; background: transparent;`;
            
            const label = document.createElement('span');
            label.textContent = category.areaName.toUpperCase();

            item.appendChild(swatch);
            item.appendChild(label);
            legend.appendChild(item);
        }
        return legend;
    }


    function buildRowElement(row, areaLookup) {
        const rowDiv = document.createElement('div');
        rowDiv.style.cssText = 'display: flex;';
            for (const seat of row.columns) {
    
                const seatDiv = document.createElement('div');
                if (seat === null){
                    seatDiv.style.cssText = `width:14px; height:14px; background: transparent;`;  
                }
                else
                {
                    const area = areaLookup[seat.areaCategoryCode]
                    const color = area.color

                    if (seat.seatStatus == 1){
                        seatDiv.style.cssText = `width:14px; height:14px;border: 2px solid ${color}; background: color-mix(in srgb, ${color} 75%, white 25%);`;                }
                    else if (seat.seatStatus == 0 || seat.seatStatus == 7){
                        seatDiv.style.cssText = `width:14px; height:14px; border: 2px solid ${color}; background: transparent;`;  
                    }
                    else if (seat.seatStatus === 3) {
                        seatDiv.style.cssText = `width:14px; height:14px; border: 2px solid #3a96d1; background: transparent;`;  
                    } else {
                        seatDiv.style.cssText = `width:14px; height:14px; border: 2px solid #000000; background: transparent;`;  
                    }
                }
                rowDiv.appendChild(seatDiv);
        }
        return rowDiv;
    }

    async function handleShowtimesResponse(url, json) {
        const cinemaMatch = url.match(/cinemas\/(\d+)\/films/);
        if (!cinemaMatch) return;
        const cinemaId = cinemaMatch[1];

        const film = json.result?.[0];
        if (!film) return;

        ensurePanel();
        ensureChartBox();
        for (const group of film.showingGroups || []) {
            for (const session of group.sessions || []) {
                if (seenShowtimes.has(session.sessionId)) continue;
                seenShowtimes.add(session.sessionId);

               renderRow(session, null); // placeholder row
               fetchSeats(cinemaId, session.sessionId).then(pct => {
                   renderRow(session, pct);
                });
            }
        }
    }

    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const response = await originalFetch.apply(this, args);
        let url = '';

        if (typeof args[0] === 'string') {
            url = args[0];
        } else if (args[0] && args[0].url) {
            url = args[0].url;
        }        
        if (url.includes('/api/microservice/showings/cinemas/') && url.includes('films?filmId=')) {
            response.clone().json().then(json => handleShowtimesResponse(url, json)).catch(() => {});
        }
        return response;
    };
})();