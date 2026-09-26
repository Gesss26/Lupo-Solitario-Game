/* ===================================================================
   LUPO SOLITARIO - MOTORE DI GIOCO COMPLETO
   Versione: 2.0
   =================================================================== */

// ==================== CONFIGURAZIONE PDF.JS ====================
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// ==================== COSTANTI ====================
const BOOKS_FOLDER = 'Libri/';
const SAVE_KEY = 'lupo_solitario_save';
const FONT_KEY = 'lupo_solitario_fontSize';
const DEFAULT_FONT_SIZE = '20';

// ==================== STATO GLOBALE ====================
let gameState = createEmptyGameState();
let booksData = {};
let currentBookData = null;
let inCombat = false;
let enemyState = null;
let pendingDiceCallback = null;

// ==================== CREAZIONE STATO VUOTO ====================
function createEmptyGameState() {
    return {
        currentBook: null,
        currentPage: null,
        player: {
            combattività: 0,
            resistenza: 0,
            resistenzaIniziale: 0,
            combattivitàIniziale: 0,
            zaino: [],
            armi: [],
            borsa: 0,
            artiRamas: [],
            oggettiSpeciali: [],
            currentLocation: 'monastero_ramas'
        },
        enemy: {
            name: '',
            combattività: 0,
            resistenza: 0,
            resistenzaIniziale: 0
        },
        history: [],
        inCombat: false,
        combatData: null,
        completedBooks: [],
        unlockedBooks: ['01']
    };
}

// ==================== ARTI RAMAS ====================
const artiRamasDisponibili = [
    { nome: 'Mimetismo', descrizione: 'Nascondersi e mimetizzarsi con l\'ambiente.' },
    { nome: 'Caccia', descrizione: 'Seguire tracce e cacciare.' },
    { nome: 'Sesto Senso', descrizione: 'Percepire pericoli imminenti.' },
    { nome: 'Orientamento', descrizione: 'Conoscere sempre la direzione.' },
    { nome: 'Guarigione', descrizione: 'Recupera 1 RES per ogni tappa senza combattimento.' },
    { nome: 'Scherma', descrizione: 'Scegli un\'arma; +2 COMB se la usi.' },
    { nome: 'Psicoschermo', descrizione: 'Immunità all\'attacco Psicolaser.' },
    { nome: 'Psicolaser', descrizione: '+2 COMB in combattimento.' },
    { nome: 'Affinità Animale', descrizione: 'Comunicare con gli animali.' },
    { nome: 'Telecinesi', descrizione: 'Muovere piccoli oggetti con la mente.' }
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
    'danarg': { name: 'Palude di Danarg', top: '70%', left: '50%' }
};

// ==================== RIFERIMENTI DOM ====================
let mainMenu, gameScreen, bookList, pageContent, choicesArea;
let diceModal, die1, rollDiceBtn, diceResult;
let inventoryModal, inventoryList;
let mapModal, heroMarker, currentLocationName;
let settingsModal, characterCreationModal;
let fontSizeSlider, fontSizeValue;
let loadFileInput;

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
}

// ==================== CARICAMENTO LIBRI ====================
async function loadAllBooks() {
    const bookFiles = [
        '01-signori-tenebre.json'
    ];
    
    console.log('📚 Cerco i libri in:', BOOKS_FOLDER);
    
    for (const file of bookFiles) {
        const fullPath = BOOKS_FOLDER + file;
        try {
            const response = await fetch(fullPath);
            console.log(`📡 ${file}:`, response.status);
            
            if (!response.ok) {
                console.warn(`❌ File non trovato: ${fullPath}`);
                continue;
            }
            const bookData = await response.json();
            console.log(`✅ Libro caricato: ${bookData.titolo || bookData.id}`);
            booksData[bookData.id] = {
                ...bookData,
                pdf: BOOKS_FOLDER + file.replace('.json', '.pdf')
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
        bookList.innerHTML = `
            <div class="loading-books">
                <p>📭 Nessun libro trovato nella cartella <strong>Libri/</strong></p>
                <p style="font-size: 0.85em; margin-top: 15px;">Controlla che il file JSON esista e sia valido.</p>
            </div>
        `;
        return;
    }

    for (const bookId of Object.keys(booksData).sort()) {
        const book = booksData[bookId];
        const isUnlocked = gameState.unlockedBooks.includes(bookId);
        
        const coverDiv = document.createElement('div');
        coverDiv.className = 'book-cover';
        if (!isUnlocked) coverDiv.classList.add('locked');
        
        // Numero del libro
        const numberSpan = document.createElement('span');
        numberSpan.className = 'book-number';
        numberSpan.textContent = `#${bookId}`;
        coverDiv.appendChild(numberSpan);
        
        // Canvas per la copertina
        const canvas = document.createElement('canvas');
        coverDiv.appendChild(canvas);
        
        // Titolo
        const titleSpan = document.createElement('span');
        titleSpan.className = 'book-title';
        titleSpan.textContent = book.titolo || book.title || `Libro ${bookId}`;
        coverDiv.appendChild(titleSpan);
        
        // Icona lucchetto se bloccato
        if (!isUnlocked) {
            const lockIcon = document.createElement('span');
            lockIcon.className = 'lock-icon';
            lockIcon.textContent = '🔒';
            coverDiv.appendChild(lockIcon);
        }
        
        // Carica la copertina dal PDF
        if (book.pdf && typeof pdfjsLib !== 'undefined') {
            try {
                await loadPdfCover(book.pdf, canvas);
            } catch (err) {
                console.warn(`Copertina non disponibile per ${book.titolo}:`, err);
                canvas.style.display = 'none';
                const fallback = document.createElement('span');
                fallback.style.fontSize = '3em';
                fallback.textContent = '📖';
                coverDiv.insertBefore(fallback, titleSpan);
            }
        } else {
            canvas.style.display = 'none';
            const fallback = document.createElement('span');
            fallback.style.fontSize = '3em';
            fallback.textContent = '📖';
            coverDiv.insertBefore(fallback, titleSpan);
        }
        
        coverDiv.onclick = () => {
            if (isUnlocked) {
                startNewGame(bookId);
            } else {
                alert('🔒 Questo libro è ancora bloccato. Completa prima il libro precedente!');
            }
        };
        
        bookList.appendChild(coverDiv);
    }
}

// ==================== CARICA COPERTINA PDF ====================
async function loadPdfCover(pdfUrl, canvas) {
    const loadingTask = pdfjsLib.getDocument(pdfUrl);
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    
    const viewport = page.getViewport({ scale: 1.5 });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    const context = canvas.getContext('2d');
    await page.render({
        canvasContext: context,
        viewport: viewport
    }).promise;
}

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
    // Menu principale
    const mainMenuBtn = document.getElementById('main-menu-btn');
    if (mainMenuBtn) {
        mainMenuBtn.addEventListener('click', () => {
            if (confirm("Sei sicuro di voler tornare al menu principale? I progressi non salvati andranno persi.")) {
                autoSave();
                showScreen('main-menu');
            }
        });
    }

    // Pulsanti impostazioni
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) settingsBtn.addEventListener('click', () => settingsModal.classList.add('active'));
    
    const settingsMenuBtn = document.getElementById('settings-menu-btn');
    if (settingsMenuBtn) settingsMenuBtn.addEventListener('click', () => settingsModal.classList.add('active'));
    
    // Altri pulsanti header
    const inventoryBtn = document.getElementById('inventory-btn');
    if (inventoryBtn) inventoryBtn.addEventListener('click', showInventory);
    
    const mapBtn = document.getElementById('map-btn');
    if (mapBtn) mapBtn.addEventListener('click', showMap);
    
    const saveBtn = document.getElementById('save-btn');
    if (saveBtn) saveBtn.addEventListener('click', saveGame);
    
    const loadGameBtn = document.getElementById('load-game-btn');
    if (loadGameBtn) loadGameBtn.addEventListener('click', () => loadFileInput.click());

    // Chiudi modali
    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) modal.classList.remove('active');
        });
    });

    // Chiudi cliccando fuori
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.remove('active');
        }
    });

    // Slider dimensione font
    if (fontSizeSlider) {
        fontSizeSlider.addEventListener('input', (e) => {
            const size = e.target.value;
            document.documentElement.style.setProperty('--font-size', `${size}px`);
            document.documentElement.style.fontSize = `${size}px`;
            fontSizeValue.textContent = size;
            localStorage.setItem(FONT_KEY, size);
        });
    }

    // Pulsante dado
    if (rollDiceBtn) {
        rollDiceBtn.addEventListener('click', () => rollDice());
    }

    // Reset partita
    const resetBtn = document.getElementById('reset-game-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (confirm("⚠️ Sei sicuro di voler ricominciare da capo?\n\nPerderai tutti i progressi non salvati.")) {
                localStorage.removeItem(SAVE_KEY);
                location.reload();
            }
        });
    }

    // Carica salvataggio
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
                } catch (err) {
                    alert("❌ File di salvataggio non valido!");
                }
            };
            reader.readAsText(file);
            loadFileInput.value = '';
        });
    }

    // Creazione personaggio
    const rollCombBtn = document.getElementById('roll-comb-btn');
    if (rollCombBtn) rollCombBtn.addEventListener('click', rollForCombattività);
    
    const rollResBtn = document.getElementById('roll-res-btn');
    if (rollResBtn) rollResBtn.addEventListener('click', rollForResistenza);
    
    const confirmBtn = document.getElementById('confirm-character-btn');
    if (confirmBtn) confirmBtn.addEventListener('click', confirmCharacter);
}

// ==================== ZONE CLICK ====================
function createClickZones() {
    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;
    
    // Rimuovi zone esistenti
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
    gameState = createEmptyGameState();
    gameState.currentBook = bookId;
    gameState.currentPage = '1';
    gameState.player.borsa = Math.floor(Math.random() * 10) + 10;
    
    currentBookData = booksData[bookId];
    showCharacterCreation();
}

// ==================== CREAZIONE PERSONAGGIO ====================
function showCharacterCreation() {
    const combResult = document.getElementById('comb-result');
    const resResult = document.getElementById('res-result');
    const confirmBtn = document.getElementById('confirm-character-btn');
    
    if (combResult) combResult.textContent = 'Risultato: -';
    if (resResult) resResult.textContent = 'Risultato: -';
    if (confirmBtn) confirmBtn.disabled = true;
    
    const ramasContainer = document.getElementById('ramas-choices');
    if (!ramasContainer) return;
    ramasContainer.innerHTML = '';
    
    artiRamasDisponibili.forEach(arte => {
        const label = document.createElement('label');
        label.className = 'rama-checkbox';
        label.title = arte.descrizione;
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = arte.nome;
        checkbox.addEventListener('change', (e) => {
            const selected = document.querySelectorAll('#ramas-choices input:checked');
            if (selected.length > 5) {
                e.target.checked = false;
                alert("⚠️ Puoi scegliere al massimo 5 Arti Ramas!");
            }
            updateRamaSelection();
            checkCharacterReady();
        });
        
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(arte.nome));
        ramasContainer.appendChild(label);
    });

    checkCharacterReady();
    characterCreationModal.classList.add('active');
}

function updateRamaSelection() {
    document.querySelectorAll('.rama-checkbox').forEach(label => {
        const checkbox = label.querySelector('input');
        if (checkbox.checked) {
            label.classList.add('selected');
        } else {
            label.classList.remove('selected');
        }
    });
}

function checkCharacterReady() {
    const hasComb = gameState.player.combattività > 0;
    const hasRes = gameState.player.resistenza > 0;
    const selectedRamas = document.querySelectorAll('#ramas-choices input:checked').length;
    
    // Aggiorna contatore
    const counter = document.getElementById('ramas-counter');
    if (counter) {
        counter.textContent = `Selezionate: ${selectedRamas} / 5`;
        counter.style.color = selectedRamas === 5 ? '#5cb85c' : '#d4af37';
    }
    
    const confirmBtn = document.getElementById('confirm-character-btn');
    if (confirmBtn) {
        confirmBtn.disabled = !(hasComb && hasRes && selectedRamas === 5);
    }
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

function confirmCharacter() {
    const selectedRamas = document.querySelectorAll('#ramas-choices input:checked');
    gameState.player.artiRamas = Array.from(selectedRamas).map(cb => cb.value);
    
    // Equipaggiamento iniziale
    gameState.player.armi = ['Ascia'];
    gameState.player.zaino = ['Pasto'];
    gameState.player.oggettiSpeciali = ['Mappa di Sommerlund'];
    
    characterCreationModal.classList.remove('active');
    showScreen('game-screen');
    renderPage('1');
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
        pageContent.innerHTML = '<p>❌ Errore: libro non caricato correttamente.</p>';
        return;
    }

    const page = currentBookData.pagine[pageId];

    if (!page) {
        pageContent.innerHTML = `<p>📄 Pagina ${pageId} non trovata.</p>`;
        choicesArea.innerHTML = `<button class="choice-btn" onclick="renderPage('1')">Torna all'inizio</button>`;
        return;
    }

    // Salva nella cronologia
    if (gameState.currentPage !== pageId && gameState.currentPage) {
        gameState.history.push(gameState.currentPage);
    }
    gameState.currentPage = pageId;

    // Applica effetti onEnter
    if (page.onEnter) {
        applyOnEnterEffects(page.onEnter);
    }

    // Gestione game over
    if (page.gameOver) {
        renderGameOver();
        return;
    }

    // Gestione fine libro
    if (page.isEnding) {
        renderEnding(page);
        return;
    }

    // Aggiorna location
    if (page.location) {
        updatePlayerLocation(page.location);
    }

    updateHeader();

    // Mostra testo
    let contentHTML = `<p>${page.testo}</p>`;
    pageContent.innerHTML = contentHTML;

    // Gestione combattimento
    if (page.combat) {
        startCombat(page.combat);
        return;
    }

    // Gestione tiro dado
    if (page.dice) {
        renderDiceChoices(page.dice);
        return;
    }

    // Gestione scelte condizionali
    if (page.conditional) {
        renderConditionalChoices(page.conditional);
        return;
    }

    // Gestione scelte normali
    choicesArea.innerHTML = '';
    if (page.choices) {
        page.choices.forEach(choice => {
            // Controlla requisiti
            if (choice.requisito && !gameState.player.artiRamas.includes(choice.requisito)) {
                return;
            }
            
            const btn = document.createElement('button');
            btn.className = 'choice-btn';
            btn.textContent = choice.text;
            btn.onclick = () => handleChoice(choice);
            choicesArea.appendChild(btn);
        });
    }
    
    document.getElementById('content-area').scrollTop = 0;
    autoSave();
}

// ==================== GESTIONE SCELTA ====================
function handleChoice(choice) {
    if (choice.target === 'restart') {
        startNewGame(gameState.currentBook);
    } else if (choice.target === 'next_book') {
        goToNextBook();
    } else {
        renderPage(choice.target);
    }
}

// ==================== GESTIONE TIRO DADO ====================
function renderDiceChoices(diceConfig) {
    choicesArea.innerHTML = '';
    
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.textContent = '🎲 Lancia il dado';
    btn.onclick = () => {
        openDiceModal((roll) => {
            // Trova il range corrispondente
            for (const range of Object.keys(diceConfig)) {
                const parts = range.split('-').map(Number);
                const min = parts[0];
                const max = parts.length > 1 ? parts[1] : min;
                
                if (roll >= min && roll <= max) {
                    renderPage(diceConfig[range]);
                    return;
                }
            }
            // Fallback
            const firstKey = Object.keys(diceConfig)[0];
            renderPage(diceConfig[firstKey]);
        });
    };
    choicesArea.appendChild(btn);
}

// ==================== GESTIONE SCELTE CONDIZIONALI ====================
function renderConditionalChoices(conditional) {
    choicesArea.innerHTML = '';
    
    for (const key of Object.keys(conditional)) {
        if (key === 'else') continue;
        
        const hasIt = gameState.player.artiRamas.includes(key) || 
                      gameState.player.oggettiSpeciali.includes(key) ||
                      gameState.player.zaino.includes(key) ||
                      gameState.player.armi.includes(key);
        
        if (hasIt) {
            renderPage(conditional[key]);
            return;
        }
    }
    
    if (conditional.else) {
        renderPage(conditional.else);
    }
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
            if (gameState.player.zaino.length < 8) {
                gameState.player.zaino.push(item);
            } else {
                console.warn(`Zaino pieno, oggetto ${item} non aggiunto`);
            }
        });
    }
    
    if (effects.loseAllItems) {
        gameState.player.zaino = [];
    }
    
    if (effects.loseAllWeapons) {
        gameState.player.armi = [];
    }
    
    if (effects.breakOneWeapon) {
        if (gameState.player.armi.length > 0) {
            gameState.player.armi.pop();
        }
    }
    
    if (effects.permanentCombattività) {
        gameState.player.combattività += effects.permanentCombattività;
    }
    
    if (effects.consumePasto) {
        const pastoIndex = gameState.player.zaino.findIndex(item => 
            item.toLowerCase().includes('pasto')
        );
        if (pastoIndex >= 0) {
            gameState.player.zaino.splice(pastoIndex, 1);
        } else if (effects.penaltySeNoPasto) {
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
    
    let enemyCombattività = combatData.combattività;
    
    // Applica modificatori
    if (combatData.modificatori && combatData.modificatori.combattività) {
        const annullaCon = combatData.modificatori.annullaCon;
        const annullaSe = combatData.modificatori.annullaSe;
        
        let annullato = false;
        if (annullaCon && gameState.player.artiRamas.includes(annullaCon)) annullato = true;
        if (annullaSe && annullaSe.every(item => 
            gameState.player.zaino.includes(item) || 
            gameState.player.oggettiSpeciali.includes(item))) annullato = true;
        
        if (!annullato) {
            // Il modificatore si applica alla Combattività del giocatore
            // ma per il calcolo lo teniamo tracciato separatamente
        }
    }
    
    enemyState = {
        name: combatData.name,
        combattività: enemyCombattività,
        resistenza: combatData.resistenza,
        resistenzaIniziale: combatData.resistenza,
        nextEnemy: combatData.nextEnemy,
        onWin: combatData.onWin,
        onWinChoices: combatData.onWinChoices,
        onWinAfterRounds: combatData.onWinAfterRounds,
        onFlee: combatData.onFlee,
        modificatori: combatData.modificatori,
        round: 0
    };
    
    gameState.enemy = {
        name: enemyState.name,
        combattività: enemyState.combattività,
        resistenza: enemyState.resistenza,
        resistenzaIniziale: enemyState.resistenza
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
    
    // Pulsante fuga
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
        // Calcola Combattività effettiva del giocatore con modificatori
        let playerCombattività = gameState.player.combattività;
        
        if (enemyState.modificatori && enemyState.modificatori.combattività) {
            const annullaCon = enemyState.modificatori.annullaCon;
            const annullaSe = enemyState.modificatori.annullaSe;
            
            let annullato = false;
            if (annullaCon && gameState.player.artiRamas.includes(annullaCon)) annullato = true;
            if (annullaSe && annullaSe.every(item => 
                gameState.player.zaino.includes(item) || 
                gameState.player.oggettiSpeciali.includes(item))) annullato = true;
            
            if (!annullato) {
                playerCombattività += enemyState.modificatori.combattività;
            }
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

        if (gameState.player.resistenza <= 0) {
            inCombat = false;
            renderGameOver();
            return;
        }
        
        if (enemyState.resistenza <= 0) {
            inCombat = false;
            
            // Controlla se ci sono altri nemici
            if (enemyState.nextEnemy) {
                let next;
                if (Array.isArray(enemyState.nextEnemy)) {
                    next = enemyState.nextEnemy.shift();
                } else {
                    next = enemyState.nextEnemy;
                }
                
                const remainingNext = Array.isArray(enemyState.nextEnemy) && enemyState.nextEnemy.length > 0 
                    ? enemyState.nextEnemy 
                    : (Array.isArray(enemyState.nextEnemy) ? null : null);
                
                const onWin = enemyState.onWin;
                const modificatori = enemyState.modificatori;
                
                enemyState = {
                    name: next.name,
                    combattività: next.combattività,
                    resistenza: next.resistenza,
                    resistenzaIniziale: next.resistenza,
                    nextEnemy: remainingNext,
                    onWin: onWin,
                    onWinChoices: enemyState.onWinChoices,
                    modificatori: modificatori,
                    round: 0
                };
                gameState.enemy = {
                    name: enemyState.name,
                    combattività: enemyState.combattività,
                    resistenza: enemyState.resistenza,
                    resistenzaIniziale: enemyState.resistenza
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
                } else if (onWin) {
                    renderPage(onWin);
                }
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
    // Limita il rapporto di forza
    if (rapportoForza > 11) rapportoForza = 11;
    if (rapportoForza < -11) rapportoForza = -11;
    
    let dannoLS = 0;
    let dannoN = 0;
    
    // Formula basata sulla tabella originale
    if (rapportoForza >= 0) {
        dannoLS = Math.max(0, Math.floor((10 - dado) / 3));
        dannoN = Math.max(1, Math.floor((dado + rapportoForza) / 2));
    } else {
        dannoLS = Math.max(0, Math.floor((10 - dado - rapportoForza) / 2));
        dannoN = Math.max(0, Math.floor((dado + rapportoForza) / 2));
    }
    
    // Limita i danni massimi
    dannoLS = Math.min(Math.max(dannoLS, 0), 6);
    dannoN = Math.min(Math.max(dannoN, 0), 12);
    
    return { dannoLS, dannoN };
}

function attemptFlee(fleeTarget) {
    if (confirm("⚠️ Sei sicuro di voler fuggire?\n\nPerderai tutti i punti di Resistenza persi finora in questo combattimento.")) {
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
            <p>Sei caduto in battaglia. La tua missione è fallita, ma il tuo sacrificio non sarà dimenticato.</p>
            <p><em>Che il tuo prossimo tentativo sia più fortunato...</em></p>
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

// ==================== PASSA AL PROSSIMO LIBRO ====================
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
    die1.classList.remove('rolling');
    
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

    setTimeout(() => {
        const roll = Math.floor(Math.random() * 10);
        
        die1.textContent = roll;
        die1.classList.remove('rolling');
        
        diceResult.textContent = `Risultato: ${roll}`;
        rollDiceBtn.disabled = false;

        if (callback) setTimeout(() => callback(roll), 800);
    }, 1000);
}

// ==================== NAVIGAZIONE STORIA ====================
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
    
    html += `<h3>💰 Borsa</h3>`;
    html += `<p>${gameState.player.borsa} Corone d'Oro</p>`;
    
    html += `<h3>⚔️ Armi (max 2)</h3>`;
    if (gameState.player.armi && gameState.player.armi.length > 0) {
        html += '<ul>';
        gameState.player.armi.forEach(item => {
            html += `<li>${item}</li>`;
        });
        html += '</ul>';
    } else {
        html += '<p class="inventory-empty">Nessuna arma equipaggiata.</p>';
    }
    
    html += `<h3>🎒 Zaino (max 8)</h3>`;
    if (gameState.player.zaino.length > 0) {
        html += '<ul>';
        gameState.player.zaino.forEach(item => {
            html += `<li>${item}</li>`;
        });
        html += '</ul>';
    } else {
        html += '<p class="inventory-empty">Lo zaino è vuoto.</p>';
    }
    
    html += `<h3>✨ Oggetti Speciali</h3>`;
    if (gameState.player.oggettiSpeciali.length > 0) {
        html += '<ul>';
        gameState.player.oggettiSpeciali.forEach(item => {
            html += `<li>${item}</li>`;
        });
        html += '</ul>';
    } else {
        html += '<p class="inventory-empty">Nessun oggetto speciale.</p>';
    }
    
    html += `<h3>🧘 Arti Ramas</h3>`;
    if (gameState.player.artiRamas.length > 0) {
        html += '<ul>';
        gameState.player.artiRamas.forEach(arte => {
            html += `<li>${arte}</li>`;
        });
        html += '</ul>';
    } else {
        html += '<p class="inventory-empty">Nessuna Arte Ramas appresa.</p>';
    }
    
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

// ==================== AUTO-SALVATAGGIO ====================
function autoSave() {
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(gameState));
    } catch (err) {
        console.warn('Auto-salvataggio fallito:', err);
    }
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
                    }).catch(err => {
                        alert('❌ Impossibile caricare il salvataggio.');
                    });
                };
                
                const menuActions = document.querySelector('.menu-actions');
                if (menuActions && !document.getElementById('continue-game-btn')) {
                    menuActions.insertBefore(continueBtn, menuActions.firstChild);
                }
            }
        }
    } catch (err) {
        console.warn('Errore caricando auto-salvataggio:', err);
    }
}

// ==================== IMPOSTAZIONI ====================
function applySettings() {
    const savedFontSize = localStorage.getItem(FONT_KEY) || DEFAULT_FONT_SIZE;
    document.documentElement.style.setProperty('--font-size', `${savedFontSize}px`);
    document.documentElement.style.fontSize = `${savedFontSize}px`;
    
    if (fontSizeSlider) {
        fontSizeSlider.value = savedFontSize;
    }
    if (fontSizeValue) {
        fontSizeValue.textContent = savedFontSize;
    }
}

// ==================== AVVIO ====================
init();
