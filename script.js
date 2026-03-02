(function() {
    // State
    let userHandle = '';
    let playersValidated = false;
    let currentRoom = null;
    let isHost = false;
    let ws = null;
    let reconnectAttempts = 0;
    let roomData = null;
    
    // Battle state
    let player1Handle = '';
    let player2Handle = '';
    let player1Score = 0;
    let player2Score = 0;
    let player1Rank = '';
    let player2Rank = '';
    let player1RankColor = '';
    let player2RankColor = '';
    let battleActive = false;
    let timerInterval = null;
    let apiCheckInterval = null;
    let totalDurationSec = 600;
    let timeLeftSec = 600;
    let checkIntervalSec = 3;
    let currentProblem = null;
    let problemLocked = false;
    let breakActive = false;
    let breakSecondsLeft = 0;
    let breakStartTime = null;
    let usedProblemIds = new Set();
    let currentProblemIndex = 0;
    let blitzNumber = 1;
    let notificationPermission = false;
    let battleStartTime = null;
    let battleDuration = 600;
    
    // Track solved problems
    let p1SolvedProblems = new Set();
    let p2SolvedProblems = new Set();
    
    // Problems configuration
    let problems = [
        { points: 500, rating: 1200 }
    ];
    let problemResults = {
        p1: [],
        p2: []
    };

    // DOM elements
    const userHandleInput = document.getElementById('userHandleInput');
    const setHandleBtn = document.getElementById('setHandleBtn');
    const loggedInfo = document.getElementById('loggedInfo');
    const createRoomBtn = document.getElementById('createRoomBtn');
    const roomNameInput = document.getElementById('roomNameInput');
    const createDuration = document.getElementById('createDuration');
    const createInterval = document.getElementById('createInterval');
    const createProblemsList = document.getElementById('createProblemsList');
    const createAddProblemBtn = document.getElementById('createAddProblemBtn');
    const joinRoomBtn = document.getElementById('joinRoomBtn');
    const joinRoomIdInput = document.getElementById('joinRoomIdInput');
    const joinRoomPasswordInput = document.getElementById('joinRoomPasswordInput');
    const activeBlitzList = document.getElementById('activeBlitzList');
    const roomControls = document.getElementById('roomControls');
    const activeBlitzSection = document.getElementById('activeBlitzSection');
    const roomInfoBar = document.getElementById('roomInfoBar');
    const currentRoomName = document.getElementById('currentRoomName');
    const currentRoomId = document.getElementById('currentRoomId');
    const roomPlayers = document.getElementById('roomPlayers');
    const leaveRoomBtn = document.getElementById('leaveRoomBtn');
    const configDashboard = document.getElementById('configDashboard');
    const displayDuration = document.getElementById('displayDuration');
    const displayInterval = document.getElementById('displayInterval');
    const displayProblems = document.getElementById('displayProblems');
    const problemsDisplaySection = document.getElementById('problemsDisplaySection');
    const problemsDisplayBody = document.getElementById('problemsDisplayBody');
    const matchStatusBar = document.getElementById('matchStatusBar');
    const leaderboard = document.getElementById('leaderboard');
    const arenaPanel = document.getElementById('arenaPanel');
    const startBattleBtn = document.getElementById('startBattleBtn');
    const cancelGameBtn = document.getElementById('cancelGameBtn');
    
    // Battle DOM elements
    const p1HandleSpan = document.getElementById('p1Handle');
    const p2HandleSpan = document.getElementById('p2Handle');
    const p1RankSpan = document.getElementById('p1Rank');
    const p2RankSpan = document.getElementById('p2Rank');
    const p1ScoreSpan = document.getElementById('p1Score');
    const p2ScoreSpan = document.getElementById('p2Score');
    const p1Row = document.getElementById('player1Row');
    const p2Row = document.getElementById('player2Row');
    const probNameSpan = document.getElementById('probName');
    const probPointsSpan = document.getElementById('probPoints');
    const probRatingSpan = document.getElementById('probRating');
    const problemUrl = document.getElementById('problemUrl');
    const lockStatusDiv = document.getElementById('lockStatus');
    const breakTimerDiv = document.getElementById('breakTimer');
    const matchTimer = document.getElementById('matchTimer');
    const matchStatusText = document.getElementById('matchStatusText');
    const breakIndicator = document.getElementById('breakIndicator');
    const leaderboardHeader = document.getElementById('leaderboardHeader');
    const leaderboardBody = document.getElementById('leaderboardBody');
    
    // Modals
    const passwordModal = document.getElementById('passwordModal');
    const passwordInput = document.getElementById('passwordInput');
    const confirmCancel = document.getElementById('confirmCancel');
    const cancelPassword = document.getElementById('cancelPassword');
    const roomPasswordModal = document.getElementById('roomPasswordModal');
    const createdRoomId = document.getElementById('createdRoomId');
    const createdRoomPassword = document.getElementById('createdRoomPassword');
    const closeRoomPasswordModal = document.getElementById('closeRoomPasswordModal');
    const celebrationModal = document.getElementById('celebrationModal');
    const winnerHandleSpan = document.getElementById('winnerHandle');
    const closeCelebrationBtn = document.getElementById('closeCelebration');
    const notificationCenter = document.getElementById('notificationCenter');

    const CANCEL_PASSWORD = 'PUC103815';
    const API_BASE_URL = window.location.origin;
    const WS_URL = window.location.origin.replace('http', 'ws');

    // Rating options
    const ratingOptions = [800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600];

    // Load saved state
    function loadSavedState() {
        const saved = localStorage.getItem('blitzRoomState');
        if (saved) {
            try {
                const state = JSON.parse(saved);
                userHandle = state.userHandle || '';
                playersValidated = !!userHandle;
                currentRoom = state.currentRoom || null;
                isHost = state.isHost || false;
                roomData = state.roomData || null;
                
                if (userHandle) {
                    userHandleInput.value = userHandle;
                    userHandleInput.disabled = true;
                    setHandleBtn.disabled = true;
                    loggedInfo.innerHTML = `👤 ${userHandle}`;
                }
                
                if (currentRoom && roomData) {
                    setTimeout(() => {
                        reconnectToRoom();
                    }, 1000);
                }
            } catch (e) {
                console.error('Error loading state:', e);
            }
        }
        
        renderCreateProblems();
    }

    // Save state
    function saveState() {
        const state = {
            userHandle,
            currentRoom,
            isHost,
            roomData
        };
        localStorage.setItem('blitzRoomState', JSON.stringify(state));
    }

    // Clear saved state
    function clearSavedState() {
        localStorage.removeItem('blitzRoomState');
    }

    // Reconnect to room
    function reconnectToRoom() {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            connectWebSocket();
        } else {
            ws.send(JSON.stringify({
                type: 'REJOIN_ROOM',
                roomId: currentRoom,
                handle: userHandle
            }));
        }
    }

    // WebSocket connection
    function connectWebSocket() {
        ws = new WebSocket(WS_URL);
        
        ws.onopen = () => {
            console.log('WebSocket connected');
            reconnectAttempts = 0;
            
            if (currentRoom) {
                ws.send(JSON.stringify({
                    type: 'REJOIN_ROOM',
                    roomId: currentRoom,
                    handle: userHandle
                }));
            } else {
                ws.send(JSON.stringify({ type: 'GET_ACTIVE_ROOMS' }));
            }
        };
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        };
        
        ws.onclose = () => {
            console.log('WebSocket disconnected');
            if (reconnectAttempts < 5) {
                setTimeout(() => {
                    reconnectAttempts++;
                    connectWebSocket();
                }, 2000);
            }
        };
        
        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }

    function handleWebSocketMessage(data) {
        switch(data.type) {
            case 'ROOM_CREATED':
                currentRoom = data.roomId;
                isHost = true;
                roomData = {
                    id: data.roomId,
                    name: data.roomName,
                    duration: data.duration,
                    interval: data.interval,
                    problems: data.problems
                };
                showRoomPassword(data.roomId, data.password, data.roomName);
                joinRoomUI(data.roomId, data.roomName, [userHandle], data.duration, data.interval, data.problems);
                saveState();
                break;
                
            case 'ROOM_JOINED':
                currentRoom = data.roomId;
                isHost = data.isHost;
                roomData = {
                    id: data.roomId,
                    name: data.roomName,
                    duration: data.duration,
                    interval: data.interval,
                    problems: data.problems
                };
                joinRoomUI(data.roomId, data.roomName, data.players, data.duration, data.interval, data.problems);
                saveState();
                break;
                
            case 'REJOIN_SUCCESS':
                currentRoom = data.roomId;
                isHost = data.isHost;
                roomData = data.roomData;
                joinRoomUI(data.roomId, data.roomData.name, data.players, data.roomData.duration, data.roomData.interval, data.roomData.problems);
                
                if (data.battleState) {
                    restoreBattleState(data.battleState);
                }
                saveState();
                break;
                
            case 'JOIN_ERROR':
                alert('Error joining room: ' + data.message);
                currentRoom = null;
                isHost = false;
                roomData = null;
                clearSavedState();
                break;
                
            case 'PLAYER_LEFT':
                showDesktopNotification('👋 Player Left', `${data.handle} left the room`);
                updateRoomPlayers(data.players);
                break;
                
            case 'PLAYER_RECONNECTED':
                showDesktopNotification('🔄 Player Reconnected', `${data.handle} reconnected`);
                updateRoomPlayers(data.players);
                break;
                
            case 'ACTIVE_ROOMS':
                displayActiveRooms(data.rooms);
                break;
                
            case 'BATTLE_STARTED':
                startBattleFromHost(data.battleState);
                break;
        }
    }

    function restoreBattleState(state) {
        player1Handle = state.player1Handle;
        player2Handle = state.player2Handle;
        player1Score = state.player1Score;
        player2Score = state.player2Score;
        battleActive = state.battleActive;
        timeLeftSec = state.timeLeftSec;
        battleStartTime = state.battleStartTime;
        battleDuration = state.battleDuration;
        currentProblemIndex = state.currentProblemIndex;
        currentProblem = state.currentProblem;
        problemLocked = state.problemLocked;
        breakActive = state.breakActive;
        breakSecondsLeft = state.breakSecondsLeft;
        breakStartTime = state.breakStartTime;
        problems = state.problems;
        problemResults = state.problemResults;
        
        showBattleUI();
        updatePlayerUI();
        updateTimerDisplay();
        
        if (currentProblem) {
            probNameSpan.textContent = currentProblem.name;
            probPointsSpan.textContent = problems[currentProblemIndex - 1]?.points || 500;
            probRatingSpan.textContent = `Rating: ${currentProblem.rating}`;
            problemUrl.href = currentProblem.url;
            problemUrl.style.pointerEvents = 'auto';
            problemUrl.style.opacity = '1';
            
            lockStatusDiv.textContent = problemLocked ? 
                `🔒 LOCKED · solved` : 
                `🔓 Problem ${currentProblemIndex}/${problems.length} · waiting for AC`;
        }
        
        if (breakActive) {
            breakTimerDiv.style.display = 'block';
            breakTimerDiv.textContent = `⏳ break ${breakSecondsLeft}s`;
            breakIndicator.style.display = 'inline-block';
            breakIndicator.textContent = `Break ${breakSecondsLeft}s`;
        }
        
        startBattleTimer();
        if (apiCheckInterval) clearInterval(apiCheckInterval);
        apiCheckInterval = setInterval(checkSubmissions, checkIntervalSec * 1000);
    }

    // Render problems in create room form
    function renderCreateProblems() {
        let html = '';
        problems.forEach((prob, idx) => {
            let ratingOptionsHtml = '';
            ratingOptions.forEach(rating => {
                const selected = rating === prob.rating ? 'selected' : '';
                ratingOptionsHtml += `<option value="${rating}" ${selected}>${rating}</option>`;
            });
            
            html += `
                <div class="create-problem-item" data-index="${idx}">
                    <input type="number" class="problem-points-create" value="${prob.points}" min="1" max="2000" step="1" placeholder="Points">
                    <select class="problem-rating-create">
                        ${ratingOptionsHtml}
                    </select>
                    <button class="remove-create-problem" ${problems.length <= 1 ? 'disabled' : ''}>✕</button>
                </div>
            `;
        });
        createProblemsList.innerHTML = html;
        
        document.querySelectorAll('.problem-points-create').forEach(input => {
            input.addEventListener('change', (e) => {
                const idx = e.target.closest('.create-problem-item').dataset.index;
                problems[idx].points = Math.max(1, parseInt(e.target.value) || 1);
            });
        });
        
        document.querySelectorAll('.problem-rating-create').forEach(select => {
            select.addEventListener('change', (e) => {
                const idx = e.target.closest('.create-problem-item').dataset.index;
                problems[idx].rating = parseInt(e.target.value);
            });
        });
        
        document.querySelectorAll('.remove-create-problem').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (problems.length <= 1) return;
                const idx = e.target.closest('.create-problem-item').dataset.index;
                problems.splice(idx, 1);
                renderCreateProblems();
            });
        });
    }

    // Add problem in create form
    createAddProblemBtn.addEventListener('click', () => {
        problems.push({ points: 500, rating: 1200 });
        renderCreateProblems();
    });

    function showRoomPassword(roomId, password, roomName) {
        createdRoomId.textContent = roomId;
        createdRoomPassword.textContent = password;
        roomPasswordModal.style.display = 'flex';
    }

    function joinRoomUI(roomId, roomName, players, duration, interval, roomProblems) {
        roomControls.style.display = 'none';
        activeBlitzSection.style.display = 'none';
        
        roomInfoBar.style.display = 'flex';
        currentRoomName.textContent = roomName;
        currentRoomId.textContent = roomId;
        
        displayDuration.value = `${duration} min`;
        displayInterval.value = `${interval} sec`;
        displayProblems.value = `${roomProblems.length} problems`;
        
        problems = roomProblems;
        renderProblemsDisplay();
        
        updateRoomPlayers(players);
        
        if (players.length === 2) {
            configDashboard.style.display = 'flex';
            problemsDisplaySection.style.display = 'block';
            
            player1Handle = players[0];
            player2Handle = players[1];
            p1HandleSpan.textContent = player1Handle;
            p2HandleSpan.textContent = player2Handle;
            p1HandleSpan.href = `https://codeforces.com/profile/${player1Handle}`;
            p2HandleSpan.href = `https://codeforces.com/profile/${player2Handle}`;
            
            if (isHost) {
                startBattleBtn.textContent = '▶ START BATTLE';
                startBattleBtn.disabled = false;
            } else {
                startBattleBtn.textContent = '⏳ WAITING FOR HOST';
                startBattleBtn.disabled = true;
            }
            
            fetchUserRanks();
        } else {
            configDashboard.style.display = 'none';
            problemsDisplaySection.style.display = 'none';
        }
    }

    function renderProblemsDisplay() {
        let html = '';
        problems.forEach((prob, idx) => {
            html += `
                <tr>
                    <td>Problem ${idx + 1}</td>
                    <td>${prob.points}</td>
                    <td>${prob.rating}</td>
                </tr>
            `;
        });
        problemsDisplayBody.innerHTML = html;
    }

    function updateRoomPlayers(players) {
        roomPlayers.textContent = `👥 ${players.length}/2 players`;
    }

    function displayActiveRooms(rooms) {
        if (rooms.length === 0) {
            activeBlitzList.innerHTML = '<div class="loading">No active rooms</div>';
            return;
        }
        
        let html = '';
        rooms.forEach(room => {
            html += `
                <div class="blitz-room-card">
                    <div class="blitz-room-info">
                        <h4>${room.name}</h4>
                        <p>ID: ${room.id} | 👥 ${room.players}/2 players</p>
                        <p>⏱️ ${room.duration} min | 🔄 ${room.interval}s | 📋 ${room.problems} problems</p>
                    </div>
                    <button class="join-this-room-btn" onclick="window.joinRoom('${room.id}')">Join</button>
                </div>
            `;
        });
        activeBlitzList.innerHTML = html;
    }

    window.joinRoom = function(roomId) {
        if (!userHandle) {
            alert('Please set your handle first');
            return;
        }
        joinRoomIdInput.value = roomId;
        joinRoomPasswordInput.focus();
    };

    // Set handle
    setHandleBtn.addEventListener('click', async () => {
        const handle = userHandleInput.value.trim();
        if (!handle) {
            alert('Please enter a handle');
            return;
        }
        
        const isValid = await validateHandle(handle);
        if (!isValid) {
            alert('Invalid Codeforces handle');
            return;
        }
        
        userHandle = handle;
        playersValidated = true;
        loggedInfo.innerHTML = `👤 ${handle}`;
        userHandleInput.disabled = true;
        setHandleBtn.disabled = true;
        saveState();
    });

    // Create room
    createRoomBtn.addEventListener('click', () => {
        if (!userHandle) {
            alert('Please set your handle first');
            return;
        }
        
        const roomName = roomNameInput.value.trim() || `${userHandle}'s Room`;
        const duration = parseInt(createDuration.value) || 10;
        const interval = parseInt(createInterval.value) || 3;
        
        ws.send(JSON.stringify({
            type: 'CREATE_ROOM',
            handle: userHandle,
            roomName: roomName,
            duration: duration,
            interval: interval,
            problems: problems
        }));
    });

    // Join room
    joinRoomBtn.addEventListener('click', () => {
        if (!userHandle) {
            alert('Please set your handle first');
            return;
        }
        
        const roomId = joinRoomIdInput.value.trim().toUpperCase();
        const password = joinRoomPasswordInput.value.trim();
        
        if (!roomId || !password) {
            alert('Please enter room ID and password');
            return;
        }
        
        ws.send(JSON.stringify({
            type: 'JOIN_ROOM',
            roomId: roomId,
            password: password,
            handle: userHandle
        }));
    });

    // Leave room
    leaveRoomBtn.addEventListener('click', () => {
        if (currentRoom && ws) {
            ws.send(JSON.stringify({
                type: 'LEAVE_ROOM',
                roomId: currentRoom,
                handle: userHandle
            }));
        }
        leaveRoom();
    });

    function leaveRoom() {
        currentRoom = null;
        isHost = false;
        roomData = null;
        clearSavedState();
        
        roomControls.style.display = 'flex';
        activeBlitzSection.style.display = 'block';
        
        roomInfoBar.style.display = 'none';
        configDashboard.style.display = 'none';
        problemsDisplaySection.style.display = 'none';
        matchStatusBar.style.display = 'none';
        leaderboard.style.display = 'none';
        arenaPanel.style.display = 'none';
        
        if (battleActive) {
            stopBattle();
        }
        
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'GET_ACTIVE_ROOMS' }));
        }
    }

    function showBattleUI() {
        configDashboard.style.display = 'none';
        problemsDisplaySection.style.display = 'none';
        matchStatusBar.style.display = 'flex';
        leaderboard.style.display = 'block';
        arenaPanel.style.display = 'flex';
    }

    closeRoomPasswordModal.addEventListener('click', () => {
        roomPasswordModal.style.display = 'none';
    });

    async function validateHandle(handle) {
        try {
            const response = await fetch(`https://codeforces.com/api/user.info?handles=${handle}`);
            const data = await response.json();
            return data.status === 'OK';
        } catch {
            return false;
        }
    }

    async function fetchUserRanks() {
        try {
            const response = await fetch(`https://codeforces.com/api/user.info?handles=${player1Handle};${player2Handle}`);
            const data = await response.json();
            
            if (data.status === 'OK') {
                const users = data.result;
                
                const p1Rating = users[0].rating || 0;
                const p1RankInfo = getRankFromRating(p1Rating);
                player1Rank = p1RankInfo.name;
                player1RankColor = p1RankInfo.color;
                
                const p2Rating = users[1].rating || 0;
                const p2RankInfo = getRankFromRating(p2Rating);
                player2Rank = p2RankInfo.name;
                player2RankColor = p2RankInfo.color;
                
                updatePlayerUI();
            }
        } catch (error) {
            console.error('Error fetching ranks:', error);
        }
    }

    function getRankFromRating(rating) {
        if (rating < 1200) return { name: 'Newbie', color: 'rank-newbie' };
        if (rating < 1400) return { name: 'Pupil', color: 'rank-pupil' };
        if (rating < 1600) return { name: 'Specialist', color: 'rank-specialist' };
        if (rating < 1900) return { name: 'Expert', color: 'rank-expert' };
        if (rating < 2100) return { name: 'Candidate Master', color: 'rank-cm' };
        if (rating < 2300) return { name: 'Master', color: 'rank-master' };
        if (rating < 2400) return { name: 'International Master', color: 'rank-im' };
        if (rating < 3000) return { name: 'Grandmaster', color: 'rank-gm' };
        return { name: 'Legendary Grandmaster', color: 'rank-lgm' };
    }

    function updatePlayerUI() {
        p1HandleSpan.textContent = player1Handle;
        p1HandleSpan.href = `https://codeforces.com/profile/${player1Handle}`;
        p1HandleSpan.className = `player-handle ${player1RankColor}`;
        p1RankSpan.textContent = player1Rank;
        p1RankSpan.className = `player-rank ${player1RankColor}`;
        
        p2HandleSpan.textContent = player2Handle;
        p2HandleSpan.href = `https://codeforces.com/profile/${player2Handle}`;
        p2HandleSpan.className = `player-handle ${player2RankColor}`;
        p2RankSpan.textContent = player2Rank;
        p2RankSpan.className = `player-rank ${player2RankColor}`;
        
        p1ScoreSpan.textContent = player1Score;
        p2ScoreSpan.textContent = player2Score;
        
        renderLeaderboard();
    }

    function renderLeaderboard() {
        let headerHtml = '<tr><th>Player</th><th>Rank</th><th>Total</th>';
        problems.forEach((prob, index) => {
            headerHtml += `<th>P${index + 1}<br><small>${prob.points}pts</small></th>`;
        });
        headerHtml += '</tr>';
        leaderboardHeader.innerHTML = headerHtml;
        
        let p1Row = '<tr>';
        p1Row += `<td><span class="${player1RankColor}"><strong>${player1Handle}</strong></span></td>`;
        p1Row += `<td><span class="${player1RankColor}">${player1Rank}</span></td>`;
        p1Row += `<td><strong style="color: #ffd966;">${player1Score}</strong></td>`;
        
        problems.forEach((prob, index) => {
            const result = problemResults.p1[index];
            if (result && result.solved) {
                p1Row += `<td class="problem-cell solved">✓</td>`;
            } else if (result && result.attempts > 0) {
                p1Row += `<td class="problem-cell attempted">✗</td>`;
            } else {
                p1Row += `<td class="problem-cell">—</td>`;
            }
        });
        p1Row += '</tr>';
        
        let p2Row = '<tr>';
        p2Row += `<td><span class="${player2RankColor}"><strong>${player2Handle}</strong></span></td>`;
        p2Row += `<td><span class="${player2RankColor}">${player2Rank}</span></td>`;
        p2Row += `<td><strong style="color: #ffd966;">${player2Score}</strong></td>`;
        
        problems.forEach((prob, index) => {
            const result = problemResults.p2[index];
            if (result && result.solved) {
                p2Row += `<td class="problem-cell solved">✓</td>`;
            } else if (result && result.attempts > 0) {
                p2Row += `<td class="problem-cell attempted">✗</td>`;
            } else {
                p2Row += `<td class="problem-cell">—</td>`;
            }
        });
        p2Row += '</tr>';
        
        leaderboardBody.innerHTML = p1Row + p2Row;
    }

    function showDesktopNotification(title, message, isWinner = false) {
        const notification = document.createElement('div');
        notification.className = `desktop-notification ${isWinner ? 'winner' : ''}`;
        notification.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 5px;">${title}</div>
            <div>${message}</div>
        `;
        notification.onclick = () => notification.remove();
        notificationCenter.appendChild(notification);
        
        setTimeout(() => notification.remove(), 5000);
    }

    function formatTime(seconds) {
        const mins = Math.floor(Math.max(0, seconds) / 60);
        const secs = Math.floor(Math.max(0, seconds) % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    function updateTimerDisplay() {
        matchTimer.textContent = formatTime(timeLeftSec);
    }

    // Start battle
    startBattleBtn.addEventListener('click', async () => {
        if (!isHost) {
            alert('Only the host can start the battle');
            return;
        }
        
        ws.send(JSON.stringify({
            type: 'START_BATTLE',
            roomId: currentRoom,
            battleState: {
                player1Handle,
                player2Handle,
                problems,
                duration: parseInt(displayDuration.value),
                interval: parseInt(displayInterval.value),
                battleStartTime: Date.now()
            }
        }));
        
        startBattleLocally();
    });

    function startBattleFromHost(battleState) {
        player1Handle = battleState.player1Handle;
        player2Handle = battleState.player2Handle;
        problems = battleState.problems;
        totalDurationSec = battleState.duration * 60;
        checkIntervalSec = battleState.interval;
        battleStartTime = battleState.battleStartTime;
        
        startBattleLocally();
    }

    function startBattleLocally() {
        showBattleUI();
        
        battleDuration = totalDurationSec;
        timeLeftSec = battleDuration;
        
        player1Score = 0;
        player2Score = 0;
        currentProblemIndex = 0;
        problemResults = { p1: [], p2: [] };
        usedProblemIds.clear();
        
        battleActive = true;
        
        startBattleTimer();
        loadNextProblem();
        
        apiCheckInterval = setInterval(checkSubmissions, checkIntervalSec * 1000);
    }

    function startBattleTimer() {
        if (timerInterval) clearInterval(timerInterval);
        
        timerInterval = setInterval(() => {
            if (!battleActive) {
                clearInterval(timerInterval);
                return;
            }
            
            if (battleStartTime) {
                const now = Date.now();
                const elapsedSeconds = Math.floor((now - battleStartTime) / 1000);
                const newTimeLeft = Math.max(0, battleDuration - elapsedSeconds);
                
                if (newTimeLeft !== timeLeftSec) {
                    timeLeftSec = newTimeLeft;
                    updateTimerDisplay();
                    
                    if (timeLeftSec <= 0) {
                        stopBattle();
                    }
                }
            }
            
            if (breakActive && breakStartTime) {
                const now = Date.now();
                const elapsedSeconds = Math.floor((now - breakStartTime) / 1000);
                const newBreakLeft = Math.max(0, 60 - elapsedSeconds);
                
                if (newBreakLeft !== breakSecondsLeft) {
                    breakSecondsLeft = newBreakLeft;
                    breakTimerDiv.textContent = `⏳ break ${breakSecondsLeft}s`;
                    breakIndicator.textContent = `Break ${breakSecondsLeft}s`;
                    
                    if (breakSecondsLeft <= 0) {
                        endBreak();
                    }
                }
            }
        }, 1000);
    }

    async function fetchProblemsFromCF(targetRating) {
        try {
            const response = await fetch(`https://codeforces.com/api/problemset.problems?tags=implementation`);
            const data = await response.json();
            
            if (data.status !== 'OK') throw new Error('API error');
            
            const problems = data.result.problems;
            
            let filtered = problems.filter(p => 
                p.rating && 
                Math.abs(p.rating - targetRating) <= 100 &&
                p.contestId && 
                p.index
            );
            
            const unsolvedProblems = filtered.filter(p => {
                const probId = `${p.contestId}${p.index}`;
                return !p1SolvedProblems.has(probId) && !p2SolvedProblems.has(probId) && !usedProblemIds.has(probId);
            });
            
            if (unsolvedProblems.length === 0) {
                const widerFiltered = problems.filter(p => 
                    p.rating && 
                    p.rating >= 800 && 
                    p.rating <= 1600 &&
                    p.contestId && 
                    p.index
                );
                
                const widerUnsolved = widerFiltered.filter(p => {
                    const probId = `${p.contestId}${p.index}`;
                    return !p1SolvedProblems.has(probId) && !p2SolvedProblems.has(probId) && !usedProblemIds.has(probId);
                });
                
                if (widerUnsolved.length === 0) {
                    throw new Error('No unsolved problems found');
                }
                
                const randomIndex = Math.floor(Math.random() * widerUnsolved.length);
                const problem = widerUnsolved[randomIndex];
                const probId = `${problem.contestId}${problem.index}`;
                
                usedProblemIds.add(probId);
                
                return {
                    id: probId,
                    name: problem.name,
                    rating: problem.rating,
                    contestId: problem.contestId,
                    index: problem.index,
                    url: `https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}`
                };
            }
            
            const randomIndex = Math.floor(Math.random() * unsolvedProblems.length);
            const problem = unsolvedProblems[randomIndex];
            const probId = `${problem.contestId}${problem.index}`;
            
            usedProblemIds.add(probId);
            
            return {
                id: probId,
                name: problem.name,
                rating: problem.rating,
                contestId: problem.contestId,
                index: problem.index,
                url: `https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}`
            };
            
        } catch (error) {
            console.error('Error:', error);
            let contestId = 1000 + Math.floor(Math.random() * 1000);
            let index = 'A';
            let probId = `${contestId}${index}`;
            usedProblemIds.add(probId);
            return {
                id: probId,
                name: `Problem A (CF ${contestId})`,
                rating: targetRating,
                contestId: contestId,
                index: index,
                url: `https://codeforces.com/problemset/problem/${contestId}/A`
            };
        }
    }

    async function loadNextProblem() {
        if (!battleActive || currentProblemIndex >= problems.length) {
            stopBattle();
            return;
        }

        p1Row.classList.remove('solved');
        p2Row.classList.remove('solved');
        
        const problemRating = problems[currentProblemIndex]?.rating || 1200;
        const prob = await fetchProblemsFromCF(problemRating);
        currentProblem = prob;
        currentProblemIndex++;
        
        const problemPoints = problems[currentProblemIndex - 1]?.points || 500;
        
        probNameSpan.textContent = prob.name;
        probPointsSpan.textContent = problemPoints;
        probRatingSpan.textContent = `Rating: ${prob.rating}`;
        
        problemUrl.href = prob.url;
        problemUrl.style.pointerEvents = 'auto';
        problemUrl.style.opacity = '1';
        
        lockStatusDiv.textContent = `🔓 Problem ${currentProblemIndex}/${problems.length} · waiting for AC`;
        lockStatusDiv.className = 'problem-lock-status';
        
        problemLocked = false;
    }

    async function checkSubmissions() {
        if (!battleActive || breakActive || problemLocked || !currentProblem || currentProblemIndex > problems.length) return;

        try {
            const [p1Response, p2Response] = await Promise.all([
                fetch(`https://codeforces.com/api/user.status?handle=${player1Handle}&from=1&count=20`),
                fetch(`https://codeforces.com/api/user.status?handle=${player2Handle}&from=1&count=20`)
            ]);

            const p1Data = await p1Response.json();
            const p2Data = await p2Response.json();

            if (!problemResults.p1[currentProblemIndex - 1]) {
                problemResults.p1[currentProblemIndex - 1] = { attempts: 0, solved: false };
            }
            if (!problemResults.p2[currentProblemIndex - 1]) {
                problemResults.p2[currentProblemIndex - 1] = { attempts: 0, solved: false };
            }

            const p1Seen = new Set();
            const p2Seen = new Set();

            if (p1Data.status === 'OK') {
                for (let sub of p1Data.result) {
                    if (sub.problem && 
                        sub.problem.contestId === currentProblem.contestId && 
                        sub.problem.index === currentProblem.index) {
                        
                        const subId = sub.id;
                        if (!p1Seen.has(subId)) {
                            p1Seen.add(subId);
                            
                            if (!problemResults.p1[currentProblemIndex - 1].solved) {
                                problemResults.p1[currentProblemIndex - 1].attempts++;
                            }
                            
                            if (sub.verdict === 'OK' && !problemLocked) {
                                handleSolve('p1');
                                break;
                            }
                        }
                    }
                }
            }

            if (p2Data.status === 'OK' && !problemLocked) {
                for (let sub of p2Data.result) {
                    if (sub.problem && 
                        sub.problem.contestId === currentProblem.contestId && 
                        sub.problem.index === currentProblem.index) {
                        
                        const subId = sub.id;
                        if (!p2Seen.has(subId)) {
                            p2Seen.add(subId);
                            
                            if (!problemResults.p2[currentProblemIndex - 1].solved) {
                                problemResults.p2[currentProblemIndex - 1].attempts++;
                            }
                            
                            if (sub.verdict === 'OK' && !problemLocked) {
                                handleSolve('p2');
                                break;
                            }
                        }
                    }
                }
            }

            updatePlayerUI();
            
        } catch (error) {
            console.error('Error checking submissions:', error);
        }
    }

    function handleSolve(player) {
        if (problemLocked || !battleActive) return;
        
        problemLocked = true;
        const problemPoints = problems[currentProblemIndex - 1]?.points || 500;
        
        if (player === 'p1') {
            player1Score += problemPoints;
            problemResults.p1[currentProblemIndex - 1].solved = true;
            p1Row.classList.add('solved');
            if (currentProblem) {
                p1SolvedProblems.add(currentProblem.id);
            }
            showDesktopNotification('✅ Problem Solved!', `${player1Handle} solved Problem ${currentProblemIndex}!`);
        } else {
            player2Score += problemPoints;
            problemResults.p2[currentProblemIndex - 1].solved = true;
            p2Row.classList.add('solved');
            if (currentProblem) {
                p2SolvedProblems.add(currentProblem.id);
            }
            showDesktopNotification('✅ Problem Solved!', `${player2Handle} solved Problem ${currentProblemIndex}!`);
        }
        
        lockStatusDiv.textContent = `🔒 LOCKED · solved by ${player === 'p1' ? player1Handle : player2Handle}`;
        lockStatusDiv.classList.add('solved-flash');
        
        updatePlayerUI();
        
        if (currentProblemIndex >= problems.length) {
            stopBattle();
        } else {
            startBreak();
        }
    }

    function startBreak() {
        breakActive = true;
        breakSecondsLeft = 60;
        breakStartTime = Date.now();
        breakTimerDiv.style.display = 'block';
        breakTimerDiv.textContent = `⏳ break ${breakSecondsLeft}s`;
        breakIndicator.style.display = 'inline-block';
        breakIndicator.textContent = `Break ${breakSecondsLeft}s`;

        if (apiCheckInterval) {
            clearInterval(apiCheckInterval);
            apiCheckInterval = null;
        }
    }

    function endBreak() {
        breakActive = false;
        breakStartTime = null;
        breakTimerDiv.style.display = 'none';
        breakIndicator.style.display = 'none';
        
        if (battleActive && currentProblemIndex < problems.length) {
            loadNextProblem().then(() => {
                apiCheckInterval = setInterval(checkSubmissions, checkIntervalSec * 1000);
            });
        }
    }

    async function stopBattle() {
        battleActive = false;
        
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        
        if (apiCheckInterval) {
            clearInterval(apiCheckInterval);
            apiCheckInterval = null;
        }
        
        breakActive = false;
        breakTimerDiv.style.display = 'none';
        breakIndicator.style.display = 'none';
        battleStartTime = null;
        breakStartTime = null;
        
        let winner = '';
        if (player1Score > player2Score) {
            winner = player1Handle;
        } else if (player2Score > player1Score) {
            winner = player2Handle;
        } else {
            winner = 'tie';
        }
        
        if (winner !== 'tie') {
            winnerHandleSpan.textContent = winner;
            celebrationModal.style.display = 'flex';
            
            for (let i = 0; i < 50; i++) {
                const confetti = document.createElement('div');
                confetti.className = 'confetti';
                confetti.style.left = Math.random() * 100 + '%';
                confetti.style.animationDelay = Math.random() * 2 + 's';
                confetti.style.background = ['gold', '#ff6b6b', '#4d9eff', '#ffd966'][Math.floor(Math.random() * 4)];
                celebrationModal.appendChild(confetti);
                setTimeout(() => confetti.remove(), 3000);
            }
        }
    }

    cancelGameBtn.addEventListener('click', () => {
        if (!battleActive) {
            alert('No active game to cancel');
            return;
        }
        passwordModal.style.display = 'flex';
        passwordInput.value = '';
        passwordInput.focus();
    });

    confirmCancel.addEventListener('click', () => {
        if (passwordInput.value === CANCEL_PASSWORD) {
            passwordModal.style.display = 'none';
            stopBattle();
            showDesktopNotification('⛔ Game Cancelled', 'Game cancelled by administrator', true);
        } else {
            alert('Incorrect password!');
            passwordInput.value = '';
        }
    });

    cancelPassword.addEventListener('click', () => {
        passwordModal.style.display = 'none';
    });

    closeCelebrationBtn.addEventListener('click', () => {
        celebrationModal.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
        if (e.target === passwordModal) {
            passwordModal.style.display = 'none';
        }
        if (e.target === roomPasswordModal) {
            roomPasswordModal.style.display = 'none';
        }
    });

    function init() {
        loadSavedState();
        connectWebSocket();
    }

    init();
})();
