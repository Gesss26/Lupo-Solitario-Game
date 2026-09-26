/* ===================================================================
   LUPO SOLITARIO - MOTORE DI GIOCO
   Versione: 6.0 - Con suoni sintetici e flash
   =================================================================== */

// ==================== COSTANTI ====================
const BOOKS_FOLDER = 'Libri/';
const COVERS_FOLDER = 'Copertina/';
const SAVE_KEY = 'lupo_solitario_save';
const FONT_KEY = 'lupo_solitario_fontSize';
const DEFAULT_FONT_SIZE = '20';
const GOOGLE_CLIENT_ID = '1061090074111-2d0ebutt2ri4tdah2qdefq7bpmra37qb.apps.googleusercontent.com';

// ==================== STATO GLOBALE ====================
let gameState = createEmptyGameState();
let booksData = {};
let currentBookData = null;
let inCombat = false;
let enemyState = null;
let pendingDiceCallback = null;

// DriveDB
let drivedb = null;
let googleToken = null;
let syncStatus = 'disconnected';

// Audio
let audioContext = null;

// ==================== CREAZIONE STATO VUOTO ====================
function createEmptyGameState() {
    return {
        currentBook: null,
        currentPage: null,
        player: {
            combattività: 0, resistenza: 0, resistenzaIniziale: 0, combattivitàIniziale: 0,
            zaino: [], armi: [], borsa: 0, artiRamas: [], oggettiSpeciali: [],
            currentLocation: 'monastero_ramas'
        },
        enemy: { name: '', combattività: 0, resistenza: 0, resistenzaIniziale: 0 },
        history: [], inCombat: false, combatData: null,
        completedBooks: [], unlockedBooks: ['01']
    };
}

// ==================== ARTI RAMAS ====================
const artiRamasDisponibili = [
    { nome: 'Mimetismo', icona: '🌿', descrizione: 'Ti permette di nasconderti e mimetizzarti con l\'ambiente.' },
    { nome: 'Caccia', icona: '🏹', descrizione: 'Ti consente di seguire tracce e riconoscere le impronte.' },
    { nome: 'Sesto Senso', icona: '👁️', descrizione: 'Ti avverte dei pericoli imminenti.' },
    { nome: 'Orientamento', icona: '🧭', descrizione: 'Ti dà sempre la percezione esatta della direzione.' },
    { nome: 'Guarigione', icona: '💊', descrizione: 'Recupera 1 RES ogni tappa senza combattimenti.' },
    { nome: 'Scherma', icona: '⚔️', descrizione: 'Scegli un\'arma; +2 COMB se la impugni.' },
    { nome: 'Psicoschermo', icona: '🛡️', descrizione: 'Protezione dagli attacchi Psicolaser.' },
    { nome: 'Psicolaser', icona: '🧠', descrizione: 'Attacca i nemici con la mente. +2 COMB.' },
    { nome: 'Affinità Animale', icona: '🐺', descrizione: 'Comunica con gli animali.' },
    { nome: 'Telecinesi', icona: '✨', descrizione: 'Muovi piccoli oggetti con la mente.' }
];

// ==================== POSIZIONI MAPPA ====================
const mapLocations = {
    'monastero_ramas': { name: 'Monastero di Ramas', top: '35%', left: '25%' },
    'holmgard': { name: 'Holmgard', top: '55%', left: '40%' },
    'toran': { name: 'Porto di Toran', top: '20%', left: '35%' },
    'foresta_freylund': { name: 'Foresta di Freylund', top: '40%', left: '30%' },
    'randong': { name: 'Randong', top: '70%', left: '35%' },
    'durenor': { name: 'Durenor', top: '65%', left: '80%' },
    'vassagonia': { name: 'Vassagonia', top: '80%', left: '70%' },
    'kaltenland': { name: 'Kaltenland', top: '10%', left: '20%' },
    'dessi': { name: 'Dessi', top: '75%', left: '60%' },
    'danarg': { name: 'Palude di Danarg', top: '70%', left: '50%' },
    'cimitero_antichi': { name: 'Cimitero degli Antichi', top: '50%', left: '45%' }
};

// ==================== RIFERIMENTI DOM ====================
let mainMenu, gameScreen, bookList, pageContent, choicesArea;
let diceModal, die1, rollDiceBtn, diceResult;
let inventoryModal, inventoryList;
let mapModal, heroMarker, currentLocationName;
let settingsModal, characterCreationModal;
let fontSizeSlider, fontSizeValue;
let loadFileInput;

// ==================== AUDIO (Web Audio API) ====================
function initAudio() {
    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (err) {
            console.warn('Audio non supportato:', err);
        }
    }
    // Riprendi il context se sospeso (richiesto da browser moderni)
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
}

// Suono sintetico del dado che rotola (6 tick)
function playDiceSound() {
    initAudio();
    if (!audioContext) return;
    
    const now = audioContext.currentTime;
    
    for (let i = 0; i < 8; i++) {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.type = 'square';
        const freq = 300 + Math.random() * 500;
        osc.frequency.setValueAtTime(freq, now + i * 0.07);
        
        gain.gain.setValueAtTime(0.12, now + i * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.06);
        
        osc.connect(gain);
        gain.connect(audioContext.destination);
        
        osc.start(now + i * 0.07);
        osc.stop(now + i * 0.07 + 0.07);
    }
}

// Suono risultato: positivo (ascendente) o negativo (discendente)
function playResultSound(isPositive) {
    initAudio();
    if (!audioContext) return;
    
    const now = audioContext.currentTime;
    
    if (isPositive) {
        // Arpeggio ascendente per vittoria
        const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
        notes.forEach((freq, i) => {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + i * 0.1);
            
            gain.gain.setValueAtTime(0.2, now + i * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.3);
            
            osc.connect(gain);
            gain.connect(audioContext.destination);
            
            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 0.3);
        });
    } else {
        // Suono discendente per sconfitta
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.4);
        
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        
        osc.connect(gain);
        gain.connect(audioContext.destination);
        
        osc.start(now);
        osc.stop(now + 0.5);
    }
}

// Flash a schermo intero
function showFlash(isPositive) {
    const existing = document.querySelector('.flash-overlay');
    if (existing) existing.remove();
    
    const overlay = document.createElement('div');
    overlay.className = 'flash-overlay ' + (isPositive ? 'active-green' : 'active-red');
    document.body.appendChild(overlay);
    
    setTimeout(() => overlay.remove(), 700);
}

// ==================== INIZIALIZZAZIONE ====================
function initDom() {
    mainMenu = document.getElementById('main-menu');
    gameScreen = document.getElementById('game-screen');
    bookList = document.getElementById('book-list');
    pageContent = document.getElementById('page-content');
    choicesArea = document.getElementById('choices-area');
    diceModal = document.getElementById('dice-modal');
    die1 = document.getElementById('die1');
    rollDiceBtn = document.getElementById('roll-dice-btn');
    diceResult = document.getElementById('dice-result');
    inventoryModal = document.getElementById('inventory-modal');
    inventoryList = document.getElementById('inventory-list');
    mapModal = document.getElementById('map-modal');
    heroMarker = document.getElementById('hero-marker');
    currentLocationName = document.getElementById('current-location-name');
    settingsModal = document.getElementById('settings-modal');
    characterCreationModal = document.getElementById('character-creation-modal');
    fontSizeSlider = document.getElementById('font-size-slider');
    fontSizeValue = document.getElementById('font-size-value');
    loadFileInput = document.getElementById('load-file-input');
}

async function init() {
    initDom();
    applySettings();
    await loadAllBooks();
    loadBooksToMenu();
    setupEventListeners();
    createClickZones();
    checkAutoSave();
    await initGoogleDrive();
}

// ==================== GOOGLE DRIVE ====================
async function initGoogleDrive() {
    const savedToken = localStorage.getItem('gdrive_token');
    const tokenExpiry = localStorage.getItem('gdrive_token_expiry');
    
    if (savedToken && tokenExpiry && Date.now() < parseInt(tokenExpiry)) {
        googleToken = savedToken;
        await setupDriveDB(savedToken);
        updateGDriveStatus('synced', 'Connesso a Google Drive');
    } else {
        updateGDriveStatus('disconnected', 'Non connesso');
    }
}

async function setupDriveDB(token) {
    try {
        if (typeof window.DriveDB === 'undefined') {
            console.warn('⚠️ DriveDB non ancora caricato');
            return;
        }
        
        drivedb = new window.DriveDB({
            dbName: 'lupo_solitario',
            tableName: 'game_state',
            accessToken: () => googleToken,
            syncDebounceMs: 2000
        });
        
        await drivedb.init();
        console.log('✅ DriveDB inizializzato');
        
        if (drivedb.onSyncChange) {
            drivedb.onSyncChange(({ status, error }) => {
                if (status === 'syncing') updateGDriveStatus('syncing', 'Sincronizzazione...');
                else if (status === 'synced') updateGDriveStatus('synced', 'Sincronizzato');
                else if (status === 'error') updateGDriveStatus('error', `Errore: ${error || 'sconosciuto'}`);
            });
        }
        
        await loadFromDrive();
    } catch (err) {
        console.error('Errore inizializzazione DriveDB:', err);
        updateGDriveStatus('error', 'Errore connessione');
    }
}

function updateGDriveStatus(status, message) {
    syncStatus = status;
    const statusEl = document.getElementById('gdrive-sync-info');
    const connectBtn = document.getElementById('gdrive-connect-btn');
    
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.className = 'gdrive-sync-info ' + status;
    }
    
    if (connectBtn) {
        if (status === 'disconnected' || status === 'error') {
            connectBtn.innerHTML = '<span class="btn-icon">☁️</span><span>Connetti a Google Drive</span>';
            connectBtn.disabled = false;
        } else {
            connectBtn.innerHTML = '<span class="btn-icon">✅</span><span>Connesso</span>';
            connectBtn.disabled = true;
        }
    }
}

async function connectGoogleDrive() {
    if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.includes('IL_TUO_CLIENT_ID')) {
        alert('⚠️ Devi configurare il Client ID di Google nel file script.js!');
        return;
    }
    
    try {
        const client = google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: 'https://www.googleapis.com/auth/drive.appdata',
            callback: async (response) => {
                if (response.error) {
                    console.error('Errore OAuth:', response.error);
                    updateGDriveStatus('error', 'Autorizzazione negata');
                    return;
                }
                
                googleToken = response.access_token;
                localStorage.setItem('gdrive_token', googleToken);
                localStorage.setItem('gdrive_token_expiry', (Date.now() + 3500 * 1000).toString());
                
                await setupDriveDB(googleToken);
                updateGDriveStatus('synced', 'Connesso a Google Drive');
            },
        });
        
        client.requestAccessToken();
    } catch (err) {
        console.error('Errore connessione Google:', err);
        updateGDriveStatus('error', 'Errore connessione');
    }
}

async function loadFromDrive() {
    if (!drivedb) return;
    try {
        const docs = drivedb.list();
        if (docs && docs.length > 0) {
            const latest = docs[0];
            gameState = { ...createEmptyGameState(), ...latest.data };
            console.log('✅ Salvataggio caricato da Google Drive');
            if (gameState.currentBook) await loadCurrentBook();
        }
    } catch (err) {
        console.warn('Nessun salvataggio remoto trovato:', err);
    }
}

async function saveToDrive() {
    if (!drivedb) return;
    try {
        await drivedb.set('main_save', gameState);
        console.log('💾 Salvataggio inviato a Google Drive');
    } catch (err) {
        console.error('Errore salvataggio Drive:', err);
    }
}

// ==================== CARICAMENTO LIBRI ====================
async function loadAllBooks() {
    const bookFiles = ['01-signori-tenebre.json'];
    console.log('📚 Cerco i libri in:', BOOKS_FOLDER);
    
    for (const file of bookFiles) {
        const fullPath = BOOKS_FOLDER + file;
        try {
            const response = await fetch(fullPath);
            console.log(`📡 ${file}:`, response.status);
            if (!response.ok) { console.warn(`❌ File non trovato: ${fullPath}`); continue; }
            
            const bookData = await response.json();
            console.log(`✅ Libro caricato: ${bookData.titolo || bookData.id}`);
            
            const coverName = file.replace('.json', '.jpeg');
            booksData[bookData.id] = {
                ...bookData,
                cover: COVERS_FOLDER + coverName
            };
        } catch (err) {
            console.error(`💥 Errore caricando ${fullPath}:`, err);
        }
    }
    console.log('📚 Libri caricati totali:', Object.keys(booksData).length);
}

// ==================== MENU PRINCIPALE ====================
async function loadBooksToMenu() {
    if (!bookList) return;
    bookList.innerHTML = '';
    
    if (Object.keys(booksData).length === 0) {
        bookList.innerHTML = `<div class="loading-books"><p>📭 Nessun libro trovato</p></div>`;
        return;
    }

    for (const bookId of Object.keys(booksData).sort()) {
        const book = booksData[bookId];
        const isUnlocked = gameState.unlockedBooks.includes(bookId);
        
        const coverDiv = document.createElement('div');
        coverDiv.className = 'book-cover';
        if (!isUnlocked) coverDiv.classList.add('locked');
        
        const numberSpan = document.createElement('span');
        numberSpan.className = 'book-number';
        numberSpan.textContent = `#${bookId}`;
        coverDiv.appendChild(numberSpan);
        
        const img = document.createElement('img');
        img.src = book.cover;
        img.alt = book.titolo || `Libro ${bookId}`;
        img.onerror = function() {
            this.style.display = 'none';
            const fallback = document.createElement('div');
            fallback.className = 'fallback-cover';
            fallback.innerHTML = `<div class="fallback-icon">📖</div>`;
            coverDiv.insertBefore(fallback, titleSpan);
        };
        coverDiv.appendChild(img);
        
        const titleSpan = document.createElement('span');
        titleSpan.className = 'book-title';
        titleSpan.textContent = book.titolo || book.title || `Libro ${bookId}`;
        coverDiv.appendChild(titleSpan);
        
        if (!isUnlocked) {
            const lockIcon = document.createElement('span');
            lockIcon.className = 'lock-icon';
            lockIcon.textContent = '🔒';
            coverDiv.appendChild(lockIcon);
        }
        
        coverDiv.onclick = () => {
            if (isUnlocked) startNewGame(bookId);
            else alert('🔒 Questo libro è ancora bloccato.');
        };
        
        bookList.appendChild(coverDiv);
    }
}

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
    const gdriveBtn = document.getElementById('gdrive-connect-btn');
    if (gdriveBtn) gdriveBtn.addEventListener('click', connectGoogleDrive);
    
    const mainMenuBtn = document.getElementById('main-menu-btn');
    if (mainMenuBtn) mainMenuBtn.addEventListener('click', () => {
        if (confirm("Tornare al menu? I progressi non salvati andranno persi.")) {
            autoSave();
            showScreen('main-menu');
        }
    });

    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) settingsBtn.addEventListener('click', () => settingsModal.classList.add('active'));
    
    const settingsMenuBtn = document.getElementById('settings-menu-btn');
    if (settingsMenuBtn) settingsMenuBtn.addEventListener('click', () => settingsModal.classList.add('active'));
    
    const inventoryBtn = document.getElementById('inventory-btn');
    if (inventoryBtn) inventoryBtn.addEventListener('click', showInventory);
    
    const mapBtn = document.getElementById('map-btn');
    if (mapBtn) mapBtn.addEventListener('click', showMap);
    
    const saveBtn = document.getElementById('save-btn');
    if (saveBtn) saveBtn.addEventListener('click', async () => {
        saveGame();
        if (drivedb && googleToken) await saveToDrive();
    });
    
    const loadGameBtn = document.getElementById('load-game-btn');
    if (loadGameBtn) loadGameBtn.addEventListener('click', () => loadFileInput.click());

    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) modal.classList.remove('active');
        });
    });

    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) e.target.classList.remove('active');
    });

    if (fontSizeSlider) {
        fontSizeSlider.addEventListener('input', (e) => {
            const size = e.target.value;
            document.documentElement.style.setProperty('--font-size', `${size}px`);
            document.documentElement.style.fontSize = `${size}px`;
            fontSizeValue.textContent = size;
            localStorage.setItem(FONT_KEY, size);
        });
    }

    if (rollDiceBtn) rollDiceBtn.addEventListener('click', () => rollDice());

    const resetBtn = document.getElementById('reset-game-btn');
    if (resetBtn) resetBtn.addEventListener('click', () => {
        if (confirm("⚠️ Ricominciare da capo? Perderai tutti i progressi.")) {
            localStorage.removeItem(SAVE_KEY);
            location.reload();
        }
    });

    if (loadFileInput) {
        loadFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const loadedState = JSON.parse(ev.target.result);
                    gameState = { ...createEmptyGameState(), ...loadedState };
                    loadCurrentBook().then(() => {
                        showScreen('game-screen');
                        renderPage(gameState.currentPage);
                        updateHeader();
                    });
                } catch (err) { alert("❌ File non valido!"); }
            };
            reader.readAsText(file);
            loadFileInput.value = '';
        });
    }

    const rollCombBtn = document.getElementById('roll-comb-btn');
    if (rollCombBtn) rollCombBtn.addEventListener('click', rollForCombattività);
    
    const rollResBtn = document.getElementById('roll-res-btn');
    if (rollResBtn) rollResBtn.addEventListener('click', rollForResistenza);
    
    const goToRamasBtn = document.getElementById('go-to-ramas-btn');
    if (goToRamasBtn) goToRamasBtn.addEventListener('click', goToRamasStep);
    
    const backToStatsBtn = document.getElementById('back-to-stats-btn');
    if (backToStatsBtn) backToStatsBtn.addEventListener('click', goToStatsStep);
    
    const confirmBtn = document.getElementById('confirm-character-btn');
    if (confirmBtn) confirmBtn.addEventListener('click', confirmCharacter);
}

// ==================== ZONE CLICK ====================
function createClickZones() {
    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;
    
    contentArea.querySelectorAll('.click-zone').forEach(z => z.remove());
    
    const prevZone = document.createElement('div');
    prevZone.id = 'prev-page-zone';
    prevZone.className = 'click-zone';
    prevZone.onclick = () => navigateHistory(-1);
    
    const nextZone = document.createElement('div');
    nextZone.id = 'next-page-zone';
    nextZone.className = 'click-zone';
    nextZone.onclick = () => navigateHistory(1);

    contentArea.appendChild(prevZone);
    contentArea.appendChild(nextZone);
}

// ==================== AVVIO NUOVA PARTITA ====================
function startNewGame(bookId) {
    console.log('🎮 Avvio nuova partita:', bookId);
    gameState = createEmptyGameState();
    gameState.currentBook = bookId;
    gameState.currentPage = '1';
    gameState.player.borsa = Math.floor(Math.random() * 10) + 10;
    
    currentBookData = booksData[bookId];
    if (!currentBookData) { alert('❌ Libro non trovato!'); return; }
    
    showCharacterCreation();
}

// ==================== CREAZIONE PERSONAGGIO ====================
function showCharacterCreation() {
    const combResult = document.getElementById('comb-result');
    const resResult = document.getElementById('res-result');
    const confirmBtn = document.getElementById('confirm-character-btn');
    const goToRamasBtn = document.getElementById('go-to-ramas-btn');
    
    if (combResult) combResult.textContent = 'Risultato: -';
    if (resResult) resResult.textContent = 'Risultato: -';
    if (confirmBtn) confirmBtn.disabled = true;
    if (goToRamasBtn) goToRamasBtn.disabled = true;
    
    const stepStats = document.getElementById('creation-step-stats');
    const stepRamas = document.getElementById('creation-step-ramas');
    if (stepStats) stepStats.style.display = 'flex';
    if (stepRamas) stepRamas.style.display = 'none';
    
    generateRamasGrid();
    characterCreationModal.classList.add('active');
}

function generateRamasGrid() {
    const grid = document.getElementById('ramas-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    artiRamasDisponibili.forEach((arte) => {
        const card = document.createElement('div');
        card.className = 'rama-card';
        card.dataset.arte = arte.nome;
        card.innerHTML = `
            <span class="rama-card-icon">${arte.icona}</span>
            <span class="rama-card-name">${arte.nome}</span>
            <span class="rama-card-check">✓</span>
        `;
        card.onclick = () => handleRamaClick(card, arte);
        grid.appendChild(card);
    });
}

function handleRamaClick(card, arte) {
    showRamaDescription(arte);
    const isSelected = card.classList.contains('selected');
    const selectedCount = document.querySelectorAll('.rama-card.selected').length;
    
    if (isSelected) {
        card.classList.remove('selected');
    } else {
        if (selectedCount >= 5) {
            card.style.borderColor = '#c9302c';
            setTimeout(() => { card.style.borderColor = ''; }, 500);
            return;
        }
        card.classList.add('selected');
    }
    
    document.querySelectorAll('.rama-card').forEach(c => c.classList.remove('focused'));
    card.classList.add('focused');
    
    updateRamasCounter();
    updateConfirmButton();
}

function showRamaDescription(arte) {
    const descBox = document.getElementById('ramas-description');
    if (!descBox) return;
    descBox.innerHTML = `
        <div class="description-icon">${arte.icona}</div>
        <h3 class="description-title">${arte.nome}</h3>
        <p class="description-text">${arte.descrizione}</p>
    `;
}

function updateRamasCounter() {
    const counter = document.getElementById('ramas-counter');
    if (!counter) return;
    const selectedCount = document.querySelectorAll('.rama-card.selected').length;
    counter.textContent = `Selezionate: ${selectedCount} / 5`;
    counter.style.color = selectedCount === 5 ? '#5cb85c' : 'var(--accent-color)';
}

function updateConfirmButton() {
    const confirmBtn = document.getElementById('confirm-character-btn');
    if (!confirmBtn) return;
    const selectedCount = document.querySelectorAll('.rama-card.selected').length;
    confirmBtn.disabled = selectedCount !== 5;
}

function goToRamasStep() {
    const stepStats = document.getElementById('creation-step-stats');
    const stepRamas = document.getElementById('creation-step-ramas');
    if (stepStats) stepStats.style.display = 'none';
    if (stepRamas) stepRamas.style.display = 'flex';
}

function goToStatsStep() {
    const stepStats = document.getElementById('creation-step-stats');
    const stepRamas = document.getElementById('creation-step-ramas');
    if (stepStats) stepStats.style.display = 'flex';
    if (stepRamas) stepRamas.style.display = 'none';
}

function rollForCombattività() {
    const roll = Math.floor(Math.random() * 10);
    const combattività = roll + 10;
    gameState.player.combattività = combattività;
    gameState.player.combattivitàIniziale = combattività;
    
    const resultEl = document.getElementById('comb-result');
    if (resultEl) resultEl.textContent = `Risultato: ${combattività} (${roll} + 10)`;
    checkCharacterReady();
}

function rollForResistenza() {
    const roll = Math.floor(Math.random() * 10);
    const resistenza = roll + 20;
    gameState.player.resistenza = resistenza;
    gameState.player.resistenzaIniziale = resistenza;
    
    const resultEl = document.getElementById('res-result');
    if (resultEl) resultEl.textContent = `Risultato: ${resistenza} (${roll} + 20)`;
    checkCharacterReady();
}

function checkCharacterReady() {
    const hasComb = gameState.player.combattività > 0;
    const hasRes = gameState.player.resistenza > 0;
    const goToRamasBtn = document.getElementById('go-to-ramas-btn');
    if (goToRamasBtn) goToRamasBtn.disabled = !(hasComb && hasRes);
}

function confirmCharacter() {
    const selectedCards = document.querySelectorAll('.rama-card.selected');
    gameState.player.artiRamas = Array.from(selectedCards).map(card => card.dataset.arte);
    
    if (gameState.player.artiRamas.length !== 5) {
        alert('⚠️ Devi selezionare esattamente 5 Arti Ramas!');
        return;
    }
    
    gameState.player.armi = ['Ascia'];
    gameState.player.zaino = ['Pasto'];
    gameState.player.oggettiSpeciali = ['Mappa di Sommerlund'];
    
    characterCreationModal.classList.remove('active');
    showScreen('game-screen');
    renderPage('1');
    
    if (drivedb && googleToken) saveToDrive();
}

// ==================== MOSTRA SCHERMATA ====================
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById(screenId);
    if (screen) screen.classList.add('active');
}

// ==================== RENDERIZZAZIONE PAGINA ====================
function renderPage(pageId) {
    if (!currentBookData || !currentBookData.pagine) {
        pageContent.innerHTML = '<p>❌ Errore: libro non caricato.</p>';
        return;
    }

    const page = currentBookData.pagine[pageId];
    if (!page) {
        pageContent.innerHTML = `<p>📄 Pagina ${pageId} non trovata.</p>`;
        choicesArea.innerHTML = `<button class="choice-btn" onclick="renderPage('1')">Torna all'inizio</button>`;
        return;
    }

    if (gameState.currentPage !== pageId && gameState.currentPage) {
        gameState.history.push(gameState.currentPage);
    }
    gameState.currentPage = pageId;

    if (page.onEnter) applyOnEnterEffects(page.onEnter);
    if (page.gameOver) { renderGameOver(); return; }
    if (page.isEnding) { renderEnding(page); return; }
    if (page.location) updatePlayerLocation(page.location);

    updateHeader();

    let contentHTML = `<p>${page.testo}</p>`;
    pageContent.innerHTML = contentHTML;

    if (page.combat) { startCombat(page.combat); return; }
    if (page.dice) { renderDiceChoices(page.dice); return; }
    if (page.conditional) { renderConditionalChoices(page.conditional); return; }

    choicesArea.innerHTML = '';
    if (page.choices) {
        page.choices.forEach(choice => {
            if (choice.requisito && !gameState.player.artiRamas.includes(choice.requisito)) return;
            
            const btn = document.createElement('button');
            btn.className = 'choice-btn';
            btn.textContent = choice.text;
            btn.onclick = () => handleChoice(choice);
            choicesArea.appendChild(btn);
        });
    }
    
    document.getElementById('content-area').scrollTop = 0;
    autoSave();
    if (drivedb && googleToken) saveToDrive();
}

// ==================== GESTIONE SCELTA ====================
function handleChoice(choice) {
    if (choice.target === 'restart') startNewGame(gameState.currentBook);
    else if (choice.target === 'next_book') goToNextBook();
    else renderPage(choice.target);
}

// ==================== TIRO DADO ====================
function renderDiceChoices(diceConfig) {
    choicesArea.innerHTML = '';
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.textContent = '🎲 Lancia il dado';
    btn.onclick = () => {
        openDiceModal((roll) => {
            for (const range of Object.keys(diceConfig)) {
                const parts = range.split('-').map(Number);
                const min = parts[0];
                const max = parts.length > 1 ? parts[1] : min;
                if (roll >= min && roll <= max) { renderPage(diceConfig[range]); return; }
            }
            renderPage(diceConfig[Object.keys(diceConfig)[0]]);
        });
    };
    choicesArea.appendChild(btn);
}

// ==================== SCELTE CONDIZIONALI ====================
function renderConditionalChoices(conditional) {
    choicesArea.innerHTML = '';
    for (const key of Object.keys(conditional)) {
        if (key === 'else') continue;
        const hasIt = gameState.player.artiRamas.includes(key) || 
                      gameState.player.oggettiSpeciali.includes(key) ||
                      gameState.player.zaino.includes(key) ||
                      gameState.player.armi.includes(key);
        if (hasIt) { renderPage(conditional[key]); return; }
    }
    if (conditional.else) renderPage(conditional.else);
}

// ==================== EFFETTI ON ENTER ====================
function applyOnEnterEffects(effects) {
    if (effects.damage) {
        gameState.player.resistenza -= effects.damage;
        if (gameState.player.resistenza < 0) gameState.player.resistenza = 0;
    }
    if (effects.addCorone) {
        gameState.player.borsa += effects.addCorone;
        if (gameState.player.borsa > 50) gameState.player.borsa = 50;
    }
    if (effects.addItems) {
        effects.addItems.forEach(item => {
            if (gameState.player.zaino.length < 8) gameState.player.zaino.push(item);
        });
    }
    if (effects.loseAllItems) gameState.player.zaino = [];
    if (effects.loseAllWeapons) gameState.player.armi = [];
    if (effects.breakOneWeapon) { if (gameState.player.armi.length > 0) gameState.player.armi.pop(); }
    if (effects.permanentCombattività) gameState.player.combattività += effects.permanentCombattività;
    if (effects.consumePasto) {
        const pastoIndex = gameState.player.zaino.findIndex(item => item.toLowerCase().includes('pasto'));
        if (pastoIndex >= 0) gameState.player.zaino.splice(pastoIndex, 1);
        else if (effects.penaltySeNoPasto) {
            gameState.player.resistenza += effects.penaltySeNoPasto;
            if (gameState.player.resistenza < 0) gameState.player.resistenza = 0;
        }
    }
    if (effects.randomLoseItem) {
        if (gameState.player.zaino.length > 0) {
            const randomIndex = Math.floor(Math.random() * gameState.player.zaino.length);
            gameState.player.zaino.splice(randomIndex, 1);
        }
    }
}

// ==================== COMBATTIMENTO ====================
function startCombat(combatData) {
    inCombat = true;
    enemyState = {
        name: combatData.name, combattività: combatData.combattività,
        resistenza: combatData.resistenza, resistenzaIniziale: combatData.resistenza,
        nextEnemy: combatData.nextEnemy, onWin: combatData.onWin,
        onWinChoices: combatData.onWinChoices, onFlee: combatData.onFlee,
        modificatori: combatData.modificatori, round: 0
    };
    gameState.enemy = {
        name: enemyState.name, combattività: enemyState.combattività,
        resistenza: enemyState.resistenza, resistenzaIniziale: enemyState.resistenza
    };
    updateHeader();
    renderCombatChoices(combatData);
}

function renderCombatChoices(combatData) {
    choicesArea.innerHTML = '';
    const attackBtn = document.createElement('button');
    attackBtn.id = 'attack-btn';
    attackBtn.className = 'choice-btn combat-btn';
    attackBtn.textContent = 'Attacca!';
    attackBtn.onclick = () => performAttack();
    choicesArea.appendChild(attackBtn);
    
    if (enemyState && enemyState.onFlee) {
        const fleeBtn = document.createElement('button');
        fleeBtn.id = 'flee-btn';
        fleeBtn.className = 'choice-btn';
        fleeBtn.textContent = 'Fuggi';
        fleeBtn.onclick = () => attemptFlee(enemyState.onFlee);
        choicesArea.appendChild(fleeBtn);
    }
}

function performAttack() {
    openDiceModal((diceRoll) => {
        let playerCombattività = gameState.player.combattività;
        if (enemyState.modificatori && enemyState.modificatori.combattività) {
            const annullaCon = enemyState.modificatori.annullaCon;
            const annullaSe = enemyState.modificatori.annullaSe;
            let annullato = false;
            if (annullaCon && gameState.player.artiRamas.includes(annullaCon)) annullato = true;
            if (annullaSe && annullaSe.every(item => 
                gameState.player.zaino.includes(item) || 
                gameState.player.oggettiSpeciali.includes(item))) annullato = true;
            if (!annullato) playerCombattività += enemyState.modificatori.combattività;
        }
        
        const rapportoForza = playerCombattività - enemyState.combattività;
        const risultato = calcolaRisultatoCombattimento(rapportoForza, diceRoll);
        
        gameState.player.resistenza -= risultato.dannoLS;
        enemyState.resistenza -= risultato.dannoN;
        enemyState.round++;
        gameState.enemy.resistenza = enemyState.resistenza;

        if (gameState.player.resistenza < 0) gameState.player.resistenza = 0;
        if (enemyState.resistenza < 0) enemyState.resistenza = 0;

        updateHeader();

        // 🎯 Flash verde SOLO se i danni inflitti superano quelli subiti
        const isPositive = risultato.dannoN > risultato.dannoLS;
        showFlash(isPositive);

        if (gameState.player.resistenza <= 0) { inCombat = false; renderGameOver(); return; }
        
        if (enemyState.resistenza <= 0) {
            inCombat = false;
            if (enemyState.nextEnemy) {
                let next;
                if (Array.isArray(enemyState.nextEnemy)) next = enemyState.nextEnemy.shift();
                else next = enemyState.nextEnemy;
                const remainingNext = Array.isArray(enemyState.nextEnemy) && enemyState.nextEnemy.length > 0 ? enemyState.nextEnemy : null;
                const onWin = enemyState.onWin;
                const modificatori = enemyState.modificatori;
                enemyState = {
                    name: next.name, combattività: next.combattività,
                    resistenza: next.resistenza, resistenzaIniziale: next.resistenza,
                    nextEnemy: remainingNext, onWin: onWin, modificatori: modificatori, round: 0
                };
                gameState.enemy = {
                    name: enemyState.name, combattività: enemyState.combattività,
                    resistenza: enemyState.resistenza, resistenzaIniziale: enemyState.resistenza
                };
                updateHeader();
                renderCombatChoices({ onFlee: null });
                showCombatMessage(`⚔️ Nemico sconfitto! Ora affronti: ${enemyState.name}`, 'success');
            } else {
                const onWin = enemyState.onWin;
                const onWinChoices = enemyState.onWinChoices;
                enemyState = null;
                gameState.enemy = { name: '', combattività: 0, resistenza: 0, resistenzaIniziale: 0 };
                updateHeader();
                if (onWinChoices) {
                    renderPage(onWin);
                    setTimeout(() => {
                        choicesArea.innerHTML = '';
                        onWinChoices.forEach(choice => {
                            const btn = document.createElement('button');
                            btn.className = 'choice-btn';
                            btn.textContent = choice.text;
                            btn.onclick = () => renderPage(choice.target);
                            choicesArea.appendChild(btn);
                        });
                    }, 100);
                } else if (onWin) renderPage(onWin);
            }
        } else {
            showCombatMessage(`Hai inflitto <strong>${risultato.dannoN}</strong> danni! Hai subito <strong>${risultato.dannoLS}</strong> danni!`, 'info');
        }
    });
}

function showCombatMessage(message, type) {
    const existing = choicesArea.querySelector('.combat-message');
    if (existing) existing.remove();
    const msg = document.createElement('p');
    msg.className = 'combat-message';
    msg.style.color = type === 'success' ? '#5cb85c' : '#e74c3c';
    msg.innerHTML = message;
    choicesArea.insertBefore(msg, choicesArea.firstChild);
}

// ==================== TABELLA COMBATTIMENTO ====================
function calcolaRisultatoCombattimento(rapportoForza, dado) {
    if (rapportoForza > 11) rapportoForza = 11;
    if (rapportoForza < -11) rapportoForza = -11;
    let dannoLS = 0;
    let dannoN = 0;
    if (rapportoForza >= 0) {
        dannoLS = Math.max(0, Math.floor((10 - dado) / 3));
        dannoN = Math.max(1, Math.floor((dado + rapportoForza) / 2));
    } else {
        dannoLS = Math.max(0, Math.floor((10 - dado - rapportoForza) / 2));
        dannoN = Math.max(0, Math.floor((dado + rapportoForza) / 2));
    }
    dannoLS = Math.min(Math.max(dannoLS, 0), 6);
    dannoN = Math.min(Math.max(dannoN, 0), 12);
    return { dannoLS, dannoN };
}

function attemptFlee(fleeTarget) {
    if (confirm("⚠️ Fuggire? Perderai i punti di Resistenza persi finora.")) {
        inCombat = false;
        enemyState = null;
        gameState.enemy = { name: '', combattività: 0, resistenza: 0, resistenzaIniziale: 0 };
        updateHeader();
        renderPage(fleeTarget);
    }
}

// ==================== GAME OVER ====================
function renderGameOver() {
    pageContent.innerHTML = `
        <div class="game-over">
            <h2>☠️ La tua avventura finisce qui</h2>
            <p>Sei caduto in battaglia. La tua missione è fallita.</p>
        </div>
    `;
    choicesArea.innerHTML = '';
    const restartBtn = document.createElement('button');
    restartBtn.className = 'choice-btn';
    restartBtn.textContent = 'Ricomincia l\'avventura';
    restartBtn.onclick = () => startNewGame(gameState.currentBook);
    choicesArea.appendChild(restartBtn);
    
    const menuBtn = document.createElement('button');
    menuBtn.className = 'choice-btn';
    menuBtn.textContent = 'Torna al menu principale';
    menuBtn.onclick = () => showScreen('main-menu');
    choicesArea.appendChild(menuBtn);
}

// ==================== FINE LIBRO ====================
function renderEnding(page) {
    pageContent.innerHTML = `
        <div class="book-ending">
            <h2>🎉 Hai completato il Libro ${gameState.currentBook}!</h2>
            <p>${page.testo}</p>
        </div>
    `;
    if (!gameState.completedBooks.includes(gameState.currentBook)) {
        gameState.completedBooks.push(gameState.currentBook);
    }
    if (page.nextBook && !gameState.unlockedBooks.includes(page.nextBook)) {
        gameState.unlockedBooks.push(page.nextBook);
    }
    autoSave();
    choicesArea.innerHTML = '';
    if (page.nextBook && booksData[page.nextBook]) {
        const nextBtn = document.createElement('button');
        nextBtn.className = 'choice-btn combat-btn';
        nextBtn.textContent = `Continua con il Libro ${page.nextBook}`;
        nextBtn.onclick = () => goToNextBook(page.nextBook);
        choicesArea.appendChild(nextBtn);
    }
    const menuBtn = document.createElement('button');
    menuBtn.className = 'choice-btn';
    menuBtn.textContent = 'Torna al menu principale';
    menuBtn.onclick = () => showScreen('main-menu');
    choicesArea.appendChild(menuBtn);
}

// ==================== PROSSIMO LIBRO ====================
function goToNextBook(nextBookId) {
    const playerState = { ...gameState.player };
    const unlockedBooks = [...gameState.unlockedBooks];
    const completedBooks = [...gameState.completedBooks];
    
    gameState = createEmptyGameState();
    gameState.player = playerState;
    gameState.currentBook = nextBookId || '02';
    gameState.currentPage = '1';
    gameState.unlockedBooks = unlockedBooks;
    gameState.completedBooks = completedBooks;
    if (!gameState.unlockedBooks.includes(gameState.currentBook)) {
        gameState.unlockedBooks.push(gameState.currentBook);
    }
    
    loadCurrentBook().then(() => {
        showScreen('game-screen');
        renderPage('1');
        updateHeader();
    }).catch(err => {
        alert('❌ Il prossimo libro non è ancora disponibile!');
        showScreen('main-menu');
    });
}

async function loadCurrentBook() {
    if (gameState.currentBook && booksData[gameState.currentBook]) {
        currentBookData = booksData[gameState.currentBook];
        return true;
    }
    throw new Error('Libro non trovato');
}

// ==================== AGGIORNA HEADER ====================
function updateHeader() {
    const lsRes = document.getElementById('ls-res');
    const combEl = document.getElementById('combattività');
    const nRes = document.getElementById('n-res');
    const statN = document.getElementById('stat-n');
    
    if (lsRes) lsRes.textContent = gameState.player.resistenza;
    if (combEl) combEl.textContent = gameState.player.combattività;
    
    if (enemyState && enemyState.name && enemyState.resistenza > 0) {
        if (nRes) nRes.textContent = enemyState.resistenza;
        if (statN) statN.classList.remove('hidden');
    } else {
        if (nRes) nRes.textContent = '-';
        if (statN) statN.classList.add('hidden');
    }
    
    const lsBox = document.getElementById('stat-ls');
    if (lsBox) {
        if (gameState.player.resistenza <= 5) lsBox.classList.add('warning');
        else lsBox.classList.remove('warning');
    }
}

// ==================== MODALE DADI ====================
function openDiceModal(callback) {
    diceModal.classList.add('active');
    diceResult.textContent = '';
    rollDiceBtn.disabled = false;
    die1.textContent = '?';
    die1.classList.remove('rolling', 'flash-positive', 'flash-negative');
    pendingDiceCallback = callback;
    
    rollDiceBtn.onclick = () => {
        rollDice((total) => {
            diceModal.classList.remove('active');
            if (pendingDiceCallback) {
                const cb = pendingDiceCallback;
                pendingDiceCallback = null;
                cb(total);
            }
        });
    };
}

function rollDice(callback) {
    die1.classList.add('rolling');
    rollDiceBtn.disabled = true;
    diceResult.textContent = '';
    
    // 🎵 Suono del dado che rotola
    playDiceSound();

    setTimeout(() => {
        const roll = Math.floor(Math.random() * 10);
        die1.textContent = roll;
        die1.classList.remove('rolling');
        diceResult.textContent = `Risultato: ${roll}`;
        rollDiceBtn.disabled = false;
        
        // Nota: il flash visivo verde/rosso viene mostrato DOPO il calcolo dei danni
        // (in performAttack o in base al risultato). Qui mostriamo solo il numero.

        if (callback) setTimeout(() => callback(roll), 1000);
    }, 1000);
}

// ==================== NAVIGAZIONE ====================
function navigateHistory(direction) {
    if (direction === -1 && gameState.history.length > 0) {
        const prevPage = gameState.history.pop();
        renderPage(prevPage);
    }
}

// ==================== MAPPA ====================
function showMap() {
    const locationKey = gameState.player.currentLocation;
    const locationData = mapLocations[locationKey];
    if (locationData && heroMarker && currentLocationName) {
        heroMarker.style.top = locationData.top;
        heroMarker.style.left = locationData.left;
        currentLocationName.textContent = `Posizione: ${locationData.name}`;
    } else if (heroMarker && currentLocationName) {
        heroMarker.style.top = '50%';
        heroMarker.style.left = '50%';
        currentLocationName.textContent = 'Posizione: Sconosciuta';
    }
    mapModal.classList.add('active');
}

function updatePlayerLocation(newLocationKey) {
    if (mapLocations[newLocationKey]) {
        gameState.player.currentLocation = newLocationKey;
    }
}

// ==================== INVENTARIO ====================
function showInventory() {
    let html = '';
    html += `<h3>💰 Borsa</h3><p>${gameState.player.borsa} Corone d'Oro</p>`;
    
    html += `<h3>⚔️ Armi (max 2)</h3>`;
    if (gameState.player.armi && gameState.player.armi.length > 0) {
        html += '<ul>';
        gameState.player.armi.forEach(item => { html += `<li>${item}</li>`; });
        html += '</ul>';
    } else html += '<p class="inventory-empty">Nessuna arma equipaggiata.</p>';
    
    html += `<h3>🎒 Zaino (max 8)</h3>`;
    if (gameState.player.zaino.length > 0) {
        html += '<ul>';
        gameState.player.zaino.forEach(item => { html += `<li>${item}</li>`; });
        html += '</ul>';
    } else html += '<p class="inventory-empty">Lo zaino è vuoto.</p>';
    
    html += `<h3>✨ Oggetti Speciali</h3>`;
    if (gameState.player.oggettiSpeciali.length > 0) {
        html += '<ul>';
        gameState.player.oggettiSpeciali.forEach(item => { html += `<li>${item}</li>`; });
        html += '</ul>';
    } else html += '<p class="inventory-empty">Nessun oggetto speciale.</p>';
    
    html += `<h3>🧘 Arti Ramas</h3>`;
    if (gameState.player.artiRamas.length > 0) {
        html += '<ul>';
        gameState.player.artiRamas.forEach(arte => { html += `<li>${arte}</li>`; });
        html += '</ul>';
    } else html += '<p class="inventory-empty">Nessuna Arte Ramas appresa.</p>';
    
    inventoryList.innerHTML = html;
    inventoryModal.classList.add('active');
}

// ==================== SALVATAGGIO ====================
function saveGame() {
    const saveData = JSON.stringify(gameState, null, 2);
    const blob = new Blob([saveData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lupo_solitario_${gameState.currentBook}_pag${gameState.currentPage}_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert("💾 Partita salvata! Il file è stato scaricato.");
}

function autoSave() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(gameState)); } 
    catch (err) { console.warn('Auto-salvataggio fallito:', err); }
}

function checkAutoSave() {
    try {
        const saved = localStorage.getItem(SAVE_KEY);
        if (saved) {
            const loaded = JSON.parse(saved);
            if (loaded.currentBook && loaded.currentPage) {
                const continueBtn = document.createElement('button');
                continueBtn.id = 'continue-game-btn';
                continueBtn.className = 'menu-btn';
                continueBtn.innerHTML = '<span class="btn-icon">▶️</span><span>Continua Partita</span>';
                continueBtn.onclick = () => {
                    gameState = { ...createEmptyGameState(), ...loaded };
                    loadCurrentBook().then(() => {
                        showScreen('game-screen');
                        renderPage(gameState.currentPage);
                        updateHeader();
                    }).catch(err => alert('❌ Impossibile caricare il salvataggio.'));
                };
                const menuActions = document.querySelector('.menu-actions');
                if (menuActions && !document.getElementById('continue-game-btn')) {
                    menuActions.insertBefore(continueBtn, menuActions.firstChild);
                }
            }
        }
    } catch (err) { console.warn('Errore caricando auto-salvataggio:', err); }
}

// ==================== IMPOSTAZIONI ====================
function applySettings() {
    const savedFontSize = localStorage.getItem(FONT_KEY) || DEFAULT_FONT_SIZE;
    document.documentElement.style.setProperty('--font-size', `${savedFontSize}px`);
    document.documentElement.style.fontSize = `${savedFontSize}px`;
    if (fontSizeSlider) fontSizeSlider.value = savedFontSize;
    if (fontSizeValue) fontSizeValue.textContent = savedFontSize;
}

// ==================== AVVIO ====================
init();