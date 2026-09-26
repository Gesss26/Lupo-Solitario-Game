/* ===================================================================
   LUPO SOLITARIO - MOTORE DI GIOCO COMPLETO
   =================================================================== */

// Configura il worker di PDF.js
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// ==================== COSTANTI ====================
const BOOKS_FOLDER = 'Libri/';
const SAVE_KEY = 'lupo_solitario_save';
const SETTINGS_KEY = 'lupo_solitario_settings';
const FONT_KEY = 'lupo_solitario_fontSize';

// ==================== STATO GLOBALE DEL GIOCO ====================
let gameState = createEmptyGameState();
let booksData = {};
let currentBookData = null;
let inCombat = false;
let enemyState = null;
let combatHistory = [];
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
            currentLocation: 'monastero_ramas',
            // Bonus temporanei
            bonusTemporanei: {
                combattività: 0,
                resistenza: 0
            }
        },
        enemy: {
            name: '',
            combattività: 0,
            resistenza: 0,
            resistenzaIniziale: 0,
            nextEnemy: null
        },
        history: [],
        inCombat: false,
        combatData: null,
        // Per il salvataggio tra libri
        completedBooks: [],
        unlockedBooks: ['01']
    };
}

// ==================== ART RAMAS ====================
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

// ==================== ELEMENTI DOM ====================
const mainMenu = document.getElementById('main-menu');
const gameScreen = document.getElementById('game-screen');
const bookList = document.getElementById('book-list');
const pageContent = document.getElementById('page-content');
const choicesArea = document.getElementById('choices-area');
const diceModal = document.getElementById('dice-modal');
const die1 = document.getElementById('die1');
const die2 = document.getElementById('die2');
const rollDiceBtn = document.getElementById('roll-dice-btn');
const diceResult = document.getElementById('dice-result');
const inventoryModal = document.getElementById('inventory-modal');
const inventoryList = document.getElementById('inventory-list');
const mapModal = document.getElementById('map-modal');
const heroMarker = document.getElementById('hero-marker');
const currentLocationName = document.getElementById('current-location-name');
const settingsModal = document.getElementById('settings-modal');
const characterCreationModal = document.getElementById('character-creation-modal');
const fontSizeSlider = document.getElementById('font-size-slider');
const fontSizeValue = document.getElementById('font-size-value');
const loadFileInput = document.getElementById('load-file-input');

// ==================== INIZIALIZZAZIONE ====================
async function init() {
    await loadAllBooks();
    loadBooksToMenu();
    setupEventListeners();
    applySettings();
    createClickZones();
    checkAutoSave();
}

// ==================== CARICAMENTO LIBRI DA JSON ====================
async function loadAllBooks() {
    // Lista dei libri disponibili (in futuro potresti generarla dinamicamente)
    const bookFiles = [
        '01-signori-tenebre.json'
    ];
    
    for (const file of bookFiles) {
        try {
            const response = await fetch(BOOKS_FOLDER + file);
            if (!response.ok) {
                console.warn(`File non trovato: ${file}`);
                continue;
            }
            const bookData = await response.json();
            booksData[bookData.id] = {
                ...bookData,
                pdf: BOOKS_FOLDER + file.replace('.json', '.pdf')
            };
        } catch (err) {
            console.error(`Errore caricando ${file}:`, err);
        }
    }
}

// ==================== CARICAMENTO LIBRI NEL MENU ====================
async function loadBooksToMenu() {
    bookList.innerHTML = '';
    
    if (Object.keys(booksData).length === 0) {
        bookList.innerHTML = '<div class="loading-books">Nessun libro trovato nella cartella Libri/</div>';
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
        titleSpan.textContent = book.titolo || book.title;
        coverDiv.appendChild(titleSpan);
        
        // Icona lucchetto se bloccato
        if (!isUnlocked) {
            const lockIcon = document.createElement('span');
            lockIcon.className = 'lock-icon';
            lockIcon.textContent = '🔒';
            coverDiv.appendChild(lockIcon);
        }
        
        // Carica la copertina dal PDF
        if (book.pdf) {
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
        }
        
        coverDiv.onclick = () => {
            if (isUnlocked) {
                startNewGame(bookId);
            } else {
                alert('Questo libro è ancora bloccato. Completa prima il libro precedente!');
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

// ==================== GESTIONE EVENTI ====================
function setupEventListeners() {
    document.getElementById('main-menu-btn').addEventListener('click', () => {
        if (confirm("Sei sicuro di voler tornare al menu principale? I progressi non salvati andranno persi.")) {
            showScreen('main-menu');
        }
    });

    document.getElementById('settings-btn').addEventListener('click', () => settingsModal.classList.add('active'));
    document.getElementById('settings-menu-btn').addEventListener('click', () => settingsModal.classList.add('active'));
    document.getElementById('inventory-btn').addEventListener('click', showInventory);
    document.getElementById('map-btn').addEventListener('click', showMap);
    document.getElementById('save-btn').addEventListener('click', saveGame);
    document.getElementById('load-game-btn').addEventListener('click', () => loadFileInput.click());

    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', (e) => e.target.closest('.modal').classList.remove('active'));
    });

    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) e.target.classList.remove('active');
    });

    fontSizeSlider.addEventListener('input', (e) => {
        const size = e.target.value;
        document.documentElement.style.setProperty('--font-size', `${size}px`);
        fontSizeValue.textContent = size;
        localStorage.setItem(FONT_KEY, size);
    });

    rollDiceBtn.addEventListener('click', () => rollDice());

    loadFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const loadedState = JSON.parse(e.target.result);
                gameState = { ...createEmptyGameState(), ...loadedState };
                loadCurrentBook().then(() => {
                    showScreen('game-screen');
                    renderPage(gameState.currentPage);
                    updateHeader();
                });
            } catch (err) {
                alert("File di salvataggio non valido!");
            }
        };
        reader.readAsText(file);
        loadFileInput.value = '';
    });

    document.getElementById('roll-comb-btn').addEventListener('click', rollForCombattività);
    document.getElementById('roll-res-btn').addEventListener('click', rollForResistenza);
    document.getElementById('confirm-character-btn').addEventListener('click', confirmCharacter);
}

// ==================== ZONE CLICK ====================
function createClickZones() {
    const contentArea = document.getElementById('content-area');
    
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
    gameState.player.borsa = Math.floor(Math.random() * 10) + 10; // 10-19 corone iniziali
    
    currentBookData = booksData[bookId];
    showCharacterCreation();
}

// ==================== CARICA LIBRO CORRENTE ====================
async function loadCurrentBook() {
    if (gameState.currentBook && booksData[gameState.currentBook]) {
        currentBookData = booksData[gameState.currentBook];
        return true;
    }
    return false;
}

// ==================== CREAZIONE PERSONAGGIO ====================
function showCharacterCreation() {
    document.getElementById('comb-result').textContent = 'Risultato: -';
    document.getElementById('res-result').textContent = 'Risultato: -';
    document.getElementById('confirm-character-btn').disabled = true;
    
    const ramasContainer = document.getElementById('ramas-choices');
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
                alert("Puoi scegliere al massimo 5 Arti Ramas!");
            }
            updateRamaSelection();
            checkCharacterReady();
        });
        
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(arte.nome));
        ramasContainer.appendChild(label);
    });

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
    document.getElementById('confirm-character-btn').disabled = !(hasComb && hasRes && selectedRamas === 5);
}

function rollForCombattività() {
    const roll = Math.floor(Math.random() * 10);
    const combattività = roll + 10;
    gameState.player.combattività = combattività;
    gameState.player.combattivitàIniziale = combattività;
    document.getElementById('comb-result').textContent = `Risultato: ${combattività} (${roll} + 10)`;
    checkCharacterReady();
}

function rollForResistenza() {
    const roll = Math.floor(Math.random() * 10);
    const resistenza = roll + 20;
    gameState.player.resistenza = resistenza;
    gameState.player.resistenzaIniziale = resistenza;
    document.getElementById('res-result').textContent = `Risultato: ${resistenza} (${roll} + 20)`;
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
    document.getElementById(screenId).classList.add('active');
}

// ==================== RENDERIZZAZIONE PAGINA ====================
function renderPage(pageId) {
    if (!currentBookData || !currentBookData.pagine) {
        pageContent.innerHTML = '<p>Errore: libro non caricato.</p>';
        return;
    }

    const page = currentBookData.pagine[pageId];

    if (!page) {
        pageContent.innerHTML = `<p>Pagina ${pageId} non trovata.</p>`;
        choicesArea.innerHTML = `<button class="choice-btn" onclick="renderPage('1')">Torna all'inizio</button>`;
        return;
    }

    // Salva nella cronologia
    if (gameState.currentPage !== pageId) {
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
    
    // Auto-salva
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
                const [min, max] = range.split('-').map(Number);
                const effectiveMax = isNaN(max) ? min : max;
                
                if (roll >= min && roll <= effectiveMax) {
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
        
        if (gameState.player.artiRamas.includes(key) || 
            gameState.player.oggettiSpeciali.includes(key) ||
            gameState.player.zaino.includes(key) ||
            gameState.player.armi.includes(key)) {
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
        }
    }
    
    if (effects.randomLoseItem) {
        const allItems = [...gameState.player.zaino];
        if (allItems.length > 0) {
            const randomIndex = Math.floor(Math.random() * allItems.length);
            const lostItem = allItems[randomIndex];
            const idx = gameState.player.zaino.indexOf(lostItem);
            if (idx >= 0) gameState.player.zaino.splice(idx, 1);
        }
    }
}

// ==================== GESTIONE COMBATTIMENTO ====================
function startCombat(combatData) {
    inCombat = true;
    
    // Applica modificatori
    let enemyCombattività = combatData.combattività;
    let playerCombattività = gameState.player.combattività;
    let playerResistenza = gameState.player.resistenza;
    
    // Modificatori al giocatore
    if (combatData.modificatori) {
        if (combatData.modificatori.combattività) {
            // Controlla se annullato da abilità
            const annullaCon = combatData.modificatori.annullaCon;
            const annullaSe = combatData.modificatori.annullaSe;
            
            let annullato = false;
            if (annullaCon && gameState.player.artiRamas.includes(annullaCon)) annullato = true;
            if (annullaSe && annullaSe.every(item => 
                gameState.player.zaino.includes(item) || 
                gameState.player.oggettiSpeciali.includes(item))) annullato = true;
            
            if (!annullato) {
                playerCombattività += combatData.modificatori.combattività;
            }
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
        onWinAfterRounds: combatData.onWinAfterRounds
    };
    
    gameState.enemy = { ...enemyState };
    combatHistory = [];
    
    updateHeader();
    renderCombatChoices(combatData);
}

function renderCombatChoices(combatData) {
    choicesArea.innerHTML = '';
    
    const attackBtn = document.createElement('button');
    attackBtn.id = 'attack-btn';
    attackBtn.className = 'choice-btn combat-btn';
    attackBtn.textContent = '⚔️ Attacca!';
    attackBtn.onclick = () => performAttack();
    choicesArea.appendChild(attackBtn);
    
    // Pulsante fuga se consentito
    if (combatData.onFlee) {
        const fleeBtn = document.createElement('button');
        fleeBtn.id = 'flee-btn';
        fleeBtn.className = 'choice-btn';
        fleeBtn.textContent = '🏃 Fuggi';
        fleeBtn.onclick = () => attemptFlee(combatData.onFlee);
        choicesArea.appendChild(fleeBtn);
    }
}

function performAttack() {
    openDiceModal((diceRoll) => {
        const rapportoForza = gameState.player.combattività - enemyState.combattività;
        const risultato = calcolaRisultatoCombattimento(rapportoForza, diceRoll);
        
        gameState.player.resistenza -= risultato.dannoLS;
        enemyState.resistenza -= risultato.dannoN;
        gameState.enemy.resistenza = enemyState.resistenza;

        if (gameState.player.resistenza < 0) gameState.player.resistenza = 0;
        if (enemyState.resistenza < 0) enemyState.resistenza = 0;

        updateHeader();

        if (gameState.player.resistenza <= 0) {
            inCombat = false;
            renderGameOver();
        } else if (enemyState.resistenza <= 0) {
            inCombat = false;
            
            // Controlla se ci sono altri nemici
            if (enemyState.nextEnemy) {
                if (Array.isArray(enemyState.nextEnemy)) {
                    const next = enemyState.nextEnemy.shift();
                    enemyState = { ...enemyState, ...next, nextEnemy: enemyState.nextEnemy.length > 0 ? enemyState.nextEnemy : null };
                } else {
                    enemyState = { ...enemyState, ...enemyState.nextEnemy, nextEnemy: null };
                }
                gameState.enemy = { ...enemyState };
                updateHeader();
                renderCombatChoices({ onFlee: null });
                showCombatMessage(`Hai sconfitto un nemico! Ora affronti: ${enemyState.name}`, 'success');
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
            showCombatMessage(`Hai inflitto ${risultato.dannoN} danni! Hai subito ${risultato.dannoLS} danni!`, 'info');
        }
    });
}

function showCombatMessage(message, type) {
    const existing = choicesArea.querySelector('.combat-message');
    if (existing) existing.remove();
    
    const msg = document.createElement('p');
    msg.className = 'combat-message';
    msg.style.textAlign = 'center';
    msg.style.color = type === 'success' ? '#2ecc71' : (type === 'info' ? '#e74c3c' : '#fff');
    msg.style.marginBottom = '10px';
    msg.innerHTML = message;
    choicesArea.insertBefore(msg, choicesArea.firstChild);
}

// ==================== TABELLA COMBATTIMENTO ====================
// Tabella corretta da "I Signori delle Tenebre"
function calcolaRisultatoCombattimento(rapportoForza, dado) {
    // Limita il rapporto di forza
    if (rapportoForza > 11) rapportoForza = 11;
    if (rapportoForza < -11) rapportoForza = -11;
    
    // Tabella semplificata basata sui risultati del libro
    // In una versione completa, andrebbe implementata la tabella esatta
    let dannoLS = 0;
    let dannoN = 0;
    
    // Formula approssimata che segue la logica del libro
    if (rapportoForza >= 0) {
        dannoLS = Math.max(0, Math.floor((10 - dado - rapportoForza) / 2));
        dannoN = Math.max(1, Math.floor((dado + rapportoForza) / 2));
    } else {
        dannoLS = Math.max(0, Math.floor((10 - dado - rapportoForza) / 2));
        dannoN = Math.max(0, Math.floor((dado + rapportoForza) / 2));
    }
    
    // Limita i danni massimi
    dannoLS = Math.min(Math.max(dannoLS, 0), 10);
    dannoN = Math.min(Math.max(dannoN, 0), 14);
    
    return { dannoLS, dannoN };
}

function attemptFlee(fleeTarget) {
    if (confirm("Sei sicuro di voler fuggire? Perderai tutti i punti di Resistenza persi finora in questo combattimento.")) {
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
    restartBtn.textContent = '🔄 Ricomincia l\'avventura';
    restartBtn.onclick = () => startNewGame(gameState.currentBook);
    choicesArea.appendChild(restartBtn);
    
    const menuBtn = document.createElement('button');
    menuBtn.className = 'choice-btn';
    menuBtn.textContent = '🏠 Torna al menu principale';
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
    
    // Segna il libro come completato
    if (!gameState.completedBooks.includes(gameState.currentBook)) {
        gameState.completedBooks.push(gameState.currentBook);
    }
    
    // Sblocca il prossimo libro
    if (page.nextBook && !gameState.unlockedBooks.includes(page.nextBook)) {
        gameState.unlockedBooks.push(page.nextBook);
    }
    
    // Salva automaticamente
    autoSave();
    
    choicesArea.innerHTML = '';
    
    if (page.nextBook && booksData[page.nextBook]) {
        const nextBtn = document.createElement('button');
        nextBtn.className = 'choice-btn combat-btn';
        nextBtn.textContent = `📖 Continua con il Libro ${page.nextBook}`;
        nextBtn.onclick = () => goToNextBook(page.nextBook);
        choicesArea.appendChild(nextBtn);
    }
    
    const menuBtn = document.createElement('button');
    menuBtn.className = 'choice-btn';
    menuBtn.textContent = '🏠 Torna al menu principale';
    menuBtn.onclick = () => showScreen('main-menu');
    choicesArea.appendChild(menuBtn);
}

// ==================== PASSA AL PROSSIMO LIBRO ====================
function goToNextBook(nextBookId) {
    // Mantieni le statistiche del giocatore
    const playerState = { ...gameState.player };
    
    // Reset dello stato per il nuovo libro
    gameState = createEmptyGameState();
    gameState.player = playerState;
    gameState.currentBook = nextBookId || '02';
    gameState.currentPage = '1';
    gameState.unlockedBooks = [...new Set([...gameState.unlockedBooks, nextBookId || '02'])];
    
    loadCurrentBook().then(() => {
        showScreen('game-screen');
        renderPage('1');
        updateHeader();
    });
}

// ==================== AGGIORNA HEADER ====================
function updateHeader() {
    document.getElementById('ls-res').textContent = gameState.player.resistenza;
    document.getElementById('combattività').textContent = gameState.player.combattività;
    
    if (enemyState && enemyState.name && enemyState.resistenza > 0) {
        document.getElementById('n-res').textContent = enemyState.resistenza;
        document.getElementById('stat-n').classList.remove('hidden');
    } else {
        document.getElementById('n-res').textContent = '-';
        document.getElementById('stat-n').classList.add('hidden');
    }
    
    const lsBox = document.getElementById('stat-ls');
    if (gameState.player.resistenza <= 5) lsBox.classList.add('warning');
    else lsBox.classList.remove('warning');
}

// ==================== MODALE DADI ====================
function openDiceModal(callback) {
    diceModal.classList.add('active');
    diceResult.textContent = '';
    rollDiceBtn.disabled = false;
    die1.textContent = '?';
    die2.textContent = '?';
    die1.classList.remove('rolling');
    die2.classList.remove('rolling');
    
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
    die2.classList.add('rolling');
    rollDiceBtn.disabled = true;
    diceResult.textContent = '';

    setTimeout(() => {
        // Nel librogame originale si usa un solo dado (0-9)
        // Usiamo un solo dado per rispettare le regole
        const roll = Math.floor(Math.random() * 10);
        
        die1.textContent = roll;
        die2.textContent = '—';
        die1.classList.remove('rolling');
        die2.classList.remove('rolling');
        
        diceResult.textContent = `Risultato: ${roll}`;
        rollDiceBtn.disabled = false;

        if (callback) setTimeout(() => callback(roll), 800);
    }, 1000);
}

// ==================== NAVIGAZIONE STORIA ====================
function navigateHistory(direction) {
    if (direction === -1 && gameState.history.length > 0) {
        const prevPage = gameState.history.pop();
        const currentPage = gameState.currentPage;
        gameState.currentPage = prevPage;
        renderPage(prevPage);
        gameState.currentPage = prevPage;
    }
}

// ==================== MAPPA ====================
function showMap() {
    const locationKey = gameState.player.currentLocation;
    const locationData = mapLocations[locationKey];

    if (locationData) {
        heroMarker.style.top = locationData.top;
        heroMarker.style.left = locationData.left;
        currentLocationName.textContent = `Posizione: ${locationData.name}`;
    } else {
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
    
    alert("Partita salvata! Il file è stato scaricato.");
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
                // Mostra un'opzione per continuare
                const continueBtn = document.createElement('button');
                continueBtn.id = 'continue-game-btn';
                continueBtn.className = 'menu-btn';
                continueBtn.textContent = '▶️ Continua Partita';
                continueBtn.onclick = () => {
                    gameState = { ...createEmptyGameState(), ...loaded };
                    loadCurrentBook().then(() => {
                        showScreen('game-screen');
                        renderPage(gameState.currentPage);
                        updateHeader();
                    });
                };
                
                const menuActions = document.querySelector('.menu-actions');
                if (menuActions) {
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
    const savedFontSize = localStorage.getItem(FONT_KEY);
    if (savedFontSize) {
        document.documentElement.style.setProperty('--font-size', `${savedFontSize}px`);
        fontSizeSlider.value = savedFontSize;
        fontSizeValue.textContent = savedFontSize;
    }
}

// ==================== AVVIA L'APP ====================
init();