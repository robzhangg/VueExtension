(function() {
    'use strict';

    const seenShowtimes = new Set(); // avoid double-processing the duplicate fetch firing
    let panel = null;

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
    }

    async function fetchSeats(cinemaId, sessionId) {
        try {
            const res = await fetch(`https://www.myvue.com/api/microservice/booking/Session/${cinemaId}/${sessionId}/seats`);
            if (!res.ok) return null;
            const data = await res.json();
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

    async function handleShowtimesResponse(url, json) {
        const cinemaMatch = url.match(/cinemas\/(\d+)\/films/);
        if (!cinemaMatch) return;
        const cinemaId = cinemaMatch[1];

        const film = json.result?.[0];
        if (!film) return;

        ensurePanel();
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