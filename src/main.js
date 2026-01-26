// --- 1. IMPORTS ---
import './style.css'; 
import { auth } from './firebase.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";

// --- 2. AUTHENTICATION LOGIC ---
const authSection = document.getElementById('authSection');
const dashboardSection = document.getElementById('dashboardSection');
const emailInput = document.getElementById('emailInput');
const passInput = document.getElementById('passwordInput');
const authError = document.getElementById('authError');
const btnLogin = document.getElementById('btnLogin');
const btnRegister = document.getElementById('btnRegister');

function setAuthLoading(isLoading) {
    const btns = [btnLogin, btnRegister];
    btns.forEach(btn => {
        if (isLoading) {
            btn.disabled = true;
            btn.style.opacity = "0.5";
            btn.innerText = "PROCESSING...";
        } else {
            btn.disabled = false;
            btn.style.opacity = "1";
            btnLogin.innerText = "AUTHENTICATE";
            btnRegister.innerText = "NEW ID";
        }
    });
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        authSection.classList.add('hidden');
        dashboardSection.classList.remove('hidden');
        setTimeout(() => {
            dashboardSection.classList.remove('opacity-0');
        }, 100);
        enterDashboard();
    } else {
        authSection.classList.remove('hidden');
        dashboardSection.classList.add('hidden');
        dashboardSection.classList.add('opacity-0');
    }
});

btnLogin.addEventListener('click', async () => {
    setAuthLoading(true);
    try {
        await signInWithEmailAndPassword(auth, emailInput.value, passInput.value);
        authError.classList.add('hidden');
    } catch (error) {
        authError.innerText = "Access Denied: " + error.message;
        authError.classList.remove('hidden');
    } finally {
        setAuthLoading(false);
    }
});

btnRegister.addEventListener('click', async () => {
    const email = emailInput.value;
    const password = passInput.value;
    if (!email.includes('@')) {
        authError.innerText = "Error: Use a valid email format.";
        authError.classList.remove('hidden');
        return;
    }
    setAuthLoading(true);
    try {
        await createUserWithEmailAndPassword(auth, email, password);
        authError.classList.add('hidden');
    } catch (error) {
        authError.innerText = "Registration Failed: " + error.message;
        authError.classList.remove('hidden');
    } finally {
        setAuthLoading(false);
    }
});

document.getElementById('btnLogout').addEventListener('click', () => {
    signOut(auth);
});

// --- 3. DASHBOARD LOGIC ---
let API_URL = ""; 
let globalData = [];      
let uniqueDevices = [];   
let currentDevice = null; 
let fetchInterval = null;

function enterDashboard() {
    const inputUrl = document.getElementById('ngrokUrl').value;
    if(!inputUrl) return; 
    
    API_URL = inputUrl.replace(/\/$/, ""); 
    startLiveClock();
    
    if (fetchInterval) clearInterval(fetchInterval);
    fetchData();
    fetchInterval = setInterval(fetchData, 2000); 

    const select = document.getElementById('deviceSelect');
    select.addEventListener('change', handleDeviceChange);
}

function getCorrectedDateTime(dateString) {
    if (!dateString) return "--/-- --:--";
    let safeDate = dateString.replace(" ", "T"); 
    const dateObj = new Date(safeDate);
    if (isNaN(dateObj.getTime())) return "Invalid Time";
    const fixedTime = dateObj.getTime() - (5.5 * 60 * 60 * 1000); 
    return new Date(fixedTime).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' 
    });
}

function getCorrectedDateObject(dateString) {
    let safeDate = dateString.replace(" ", "T");
    const dateObj = new Date(safeDate);
    if (isNaN(dateObj.getTime())) return new Date(); 
    const fixedTime = dateObj.getTime() - (5.5 * 60 * 60 * 1000);
    return new Date(fixedTime);
}

function startLiveClock() {
    function update() {
        const now = new Date();
        const datePart = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' });
        const timePart = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
        const clockEl = document.getElementById('liveClock');
        if(clockEl) clockEl.innerHTML = `<span class="text-cyan-500/80">${datePart}</span> • ${timePart}`;
    }
    update(); 
    setInterval(update, 1000); 
}

async function fetchData() {
    try {
        const response = await fetch(`${API_URL}/api/history`, {
            headers: { "ngrok-skip-browser-warning": "true", "Content-Type": "application/json" }
        });
        if (!response.ok) throw new Error("Offline");
        globalData = await response.json();
        
        if(globalData.length > 0) {
            updateDeviceList(globalData);
            refreshView();
            document.getElementById('diagnosticPanel').style.borderLeftColor = "#00f2ff";
        }
    } catch (error) {
        const diagText = document.getElementById('diagStatus');
        if(diagText) {
            diagText.innerText = "CONNECTION FAILURE";
            diagText.style.color = "#ff2a2a";
            document.getElementById('diagnosticPanel').style.borderLeftColor = "#ff2a2a";
        }
    }
}

function updateDeviceList(data) {
    const foundDevices = [...new Set(data.map(item => item.valve_id))];
    if (JSON.stringify(foundDevices.sort()) !== JSON.stringify(uniqueDevices.sort())) {
        uniqueDevices = foundDevices;
        const select = document.getElementById('deviceSelect');
        const savedSelection = select.value;
        select.innerHTML = uniqueDevices.map(id => `<option value="${id}">${id}</option>`).join('');
        if (savedSelection && uniqueDevices.includes(savedSelection)) {
            select.value = savedSelection;
        } else if (uniqueDevices.length > 0) {
            select.value = uniqueDevices[0];
            currentDevice = uniqueDevices[0];
        }
    }
}

function handleDeviceChange() {
    currentDevice = document.getElementById('deviceSelect').value;
    refreshView();
}

function refreshView() {
    if (!currentDevice || globalData.length === 0) return;
    const deviceHistory = globalData.filter(d => d.valve_id === currentDevice);
    if (deviceHistory.length > 0) {
        deviceHistory.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        updateDashboard(deviceHistory);
    }
}

function updateDashboard(historyData) {
    const latest = historyData[0];
    const turns = latest.turns ?? latest.valve_turns ?? 0; 
    
    // 1. UPDATE VISIBLE CARDS
    document.getElementById('valveTurns').innerText = turns;
    document.getElementById('lastSync').innerText = getCorrectedDateTime(latest.created_at);

    // 2. RUN LOGIC & STATS (Pressure removed from here)
    runDiagnostics(turns, latest.valve_status); 
    processDailyStats(historyData);

    // 3. REFRESH EVENT LOG (Removed Pressure column)
    document.getElementById('logTableBody').innerHTML = historyData.slice(0, 15).map(row => {
        let statusColor = "text-tech-success";
        const statusStr = row.valve_status || "Unknown";
        if (statusStr.includes("HIGH") || statusStr.includes("LEAK")) statusColor = "text-red-500";

        return `<tr class="hover:bg-cyan-500/10 border-b border-white/5">
            <td class="p-3 text-slate-500 font-mono">${getCorrectedDateTime(row.created_at)}</td>
            <td class="p-3 text-white">ID:${row.valve_id.slice(-5)}</td>
            <td class="p-3 text-right ${statusColor} font-bold uppercase">${statusStr}</td>
            <td class="p-3 text-right text-amber-400 font-mono">${row.turns ?? 0} TRN</td>
        </tr>`;
    }).join('');
}

function runDiagnostics(turns, dbStatus) {
    const diagText = document.getElementById('diagStatus');
    const diagPanel = document.getElementById('diagnosticPanel');
    const diagSub = document.getElementById('diagSubStatus');

    let displayStatus = dbStatus || "IDLE";
    let color = "#00f2ff"; 

    if (turns > 0) {
        displayStatus = dbStatus || "FLOW DETECTED";
        color = "#10b981"; // Success Green
        diagSub.classList.add('hidden');
    } else {
        diagSub.classList.add('hidden');
    }

    diagText.innerText = displayStatus;
    diagText.style.color = color;
    diagText.style.textShadow = `0 0 10px ${color}55`;
    diagPanel.style.borderLeftColor = color;
}

function processDailyStats(logs) {
    const grouped = {};
    logs.forEach(log => {
        const dateKey = getCorrectedDateObject(log.created_at).toISOString().split('T')[0];
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(log);
    });

    const todayKey = new Date().toISOString().split('T')[0];
    updateComplianceCard(grouped[todayKey] || []);

    const sortedDates = Object.keys(grouped).sort().reverse(); 
    let tableHtml = "";
    sortedDates.slice(0, 5).forEach(date => {
        const dayLogs = grouped[date];
        dayLogs.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
        const stats = calculateDayMetrics(dayLogs);
        
        let scoreColor = "text-red-500";
        if(stats.score >= 80) scoreColor = "text-tech-success";
        else if(stats.score >= 50) scoreColor = "text-tech-warn";

        tableHtml += `<tr class="hover:bg-cyan-500/10 transition-colors border-b border-white/5">
            <td class="p-3 text-white font-bold">${date}</td>
            <td class="p-3 text-right text-slate-400">${stats.startTime}</td>
            <td class="p-3 text-right text-white">${stats.durationStr}</td>
            <td class="p-3 text-center font-bold ${scoreColor}">${stats.score}%</td>
        </tr>`;
    });
    document.getElementById('dailyStatsBody').innerHTML = tableHtml;
}

function calculateDayMetrics(dayLogs) {
    let activeLogs = dayLogs.filter(l => (l.turns || l.valve_turns || 0) > 0);
    if(activeLogs.length === 0) return { startTime: "--:--", durationStr: "0m", score: 0 };

    const startObj = getCorrectedDateObject(activeLogs[0].created_at);
    const startTimeStr = startObj.toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit', hour12: true});
    
    const durationMs = new Date(activeLogs[activeLogs.length - 1].created_at) - new Date(activeLogs[0].created_at);
    const durationMin = Math.max(Math.floor(durationMs / 60000), 1);
    
    // Scoring logic based on time of day (example schedule: 4 AM)
    const hour = startObj.getHours();
    let timeScore = (hour === 4) ? 50 : 10;
    let durationScore = Math.min((durationMin / 120) * 50, 50); 

    return { 
        startTime: startTimeStr, 
        durationStr: `${Math.floor(durationMin/60)}h ${durationMin%60}m`, 
        score: Math.floor(timeScore + durationScore) 
    };
}

function updateComplianceCard(todayLogs) {
    const metrics = calculateDayMetrics(todayLogs);
    document.getElementById('complianceScore').innerText = metrics.score + "%";
    document.getElementById('startTimeDisplay').innerText = metrics.startTime;
    document.getElementById('durationDisplay').innerText = metrics.durationStr;

    const ring = document.getElementById('complianceRing');
    let color = "#ef4444"; 
    let statusText = "NON-COMPLIANT";
    
    if (metrics.score >= 80) { color = "#10b981"; statusText = "SCHEDULE ADHERED"; }
    else if (metrics.score >= 50) { color = "#fbbf24"; statusText = "PARTIAL ADHERENCE"; }

    ring.style.setProperty('--score-color', color);
    ring.style.setProperty('--score-deg', `${(metrics.score / 100) * 360}deg`);
    document.getElementById('scheduleStatus').innerText = statusText;
}
