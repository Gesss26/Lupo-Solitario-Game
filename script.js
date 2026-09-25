/* ===================================================================
   LUPO SOLITARIO - MOTORE DI GIOCO
   =================================================================== */

// Configura il worker di PDF.js (necessario per il funzionamento)
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// ==================== STATO GLOBALE DEL GIOCO ====================
let gameState = {
    currentBook: null,
    currentPage: null,
    player: {
        combattività: 0,
        resistenza: 0,
        resistenzaIniziale: 0,
        zaino: [],
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
    combatData: null
};

// ==================== DATI DEI LIBRI ====================
// NOTA: 'pdf' è il percorso al file PDF, usato per generare la copertina.
// 'pages' contiene i dati testuali del libro.
const booksData = {
    '01': {
        title: 'I Signori delle Tenebre',
        pdf: 'Libri/01 - I Signori delle Tenebre.pdf',
        pages: {
            '1': {
                text: "Devi far presto, perché qualcosa ti dice che non è prudente indugiare presso le rovine fumanti del monastero. I Kraan, i mostri dalle nere ali, potrebbero tornare da un momento all'altro. Devi raggiungere Holmgard, la capitale di Sommerlund, e portare al Re la terribile notizia: tutti i cavalieri Ramas, salvo te, sono stati massacrati. Senza i Ramas alla testa del suo esercito, Sommerlund sarà alla mercé del suo antico nemico, i Signori delle Tenebre. Trattenendo le lacrime, dai un ultimo saluto ai tuoi compagni uccisi. Dentro di te giuri che la loro morte sarà vendicata. Volti le spalle alle rovine e scendi con circospezione il ripido sentiero. Ai piedi della collina il sentiero si biforca, ma entrambe le piste portano nel folto della foresta.",
                onEnter: () => updatePlayerLocation('monastero_ramas'),
                choices: [
                    { text: "Se scegli il sentiero di destra, vai all'85.", target: '85' },
                    { text: "Se scegli quello di sinistra, vai al 275.", target: '275' },
                    { text: "Se vuoi utilizzare l'Arte del Sesto Senso, vai al 141.", target: '141' }
                ]
            },
            '85': {
                text: "Il sentiero è largo, e conduce diritto in un folto sottobosco. Gli alberi sono molto alti e regna una quiete innaturale. Cammini per un paio di chilometri quando improvvisamente senti il battito di un paio di enormi ali proprio sopra di te. Guardando in su resti sconvolto al vedere la sagoma nera di un Kraan che si lancia all'attacco.",
                onEnter: () => updatePlayerLocation('foresta_freylund'),
                choices: [
                    { text: "Se estrai la tua Arma e ti prepari a combattere, vai al 229.", target: '229' },
                    { text: "Se eviti l'attacco fuggendo nella foresta verso sud, vai al 99.", target: '99' }
                ]
            },
            '229': {
                text: "Il Kraan è sopra di te, e la polvere alzata dalle sue ali nere ti entra negli occhi e nel naso, e ti fa mancare il respiro. Ora il mostro attacca. Devi ucciderlo assolutamente. A causa della polvere devi togliere 1 punto di Combattività.",
                combat: {
                    name: "Kraan",
                    combattività: 16,
                    resistenza: 25,
                    onWin: '267',
                    onLose: 'gameover'
                }
            },
            '267': {
                text: "Il Kraan precipita al suolo, morto. Sei ferito ma vivo. Proseguendo lungo il sentiero, arrivi a un bivio. Un cartello indica: Holmgard a nord, Toran a est.",
                onEnter: () => updatePlayerLocation('foresta_freylund'),
                choices: [
                    { text: "Vai a nord verso Holmgard", target: '100' },
                    { text: "Vai a est verso Toran", target: '200' }
                ]
            },
            'gameover': {
                text: "Sei morto. La tua avventura finisce qui. Che il tuo sacrificio non sia stato vano...",
                choices: [
                    { text: "Ricomincia l'avventura", target: 'restart' }
                ]
            },
            // ... Aggiungi qui tutte le altre pagine del libro 1
        }
    }
    // ... Aggiungi qui gli altri libri
};

// ==================== POSIZIONI SULLA MAPPA ====================
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

// ==================== ARTI RAMAS DISPONIBILI ====================
const artiRamasDisponibili = [
    'Mimetismo', 'Caccia', 'Sesto Senso', 'Orientamento', 'Guarigione',
    'Scherma', 'Psicoschermo', 'Psicolaser', 'Affinità Animale', 'Telecinesi'
];

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
function init() {
    loadBooksToMenu();
    setupEventListeners();
    applySettings();
    createClickZones();
}

// ==================== CARICAMENTO LIBRI NEL MENU (CON COPERTINE DA PDF) ====================
async function loadBooksToMenu() {
    bookList.innerHTML = '<div class="loading-books">Caricamento libreria...</div>';
    
    // Attendi che PDF.js sia caricato
    let attempts = 0;
    while (typeof pdfjsLib === 'undefined' && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 200));
        attempts++;
    }
    
    if (typeof pdfjsLib === 'undefined') {
        bookList.innerHTML = '<div class="loading-books">Errore: libreria PDF.js non caricata. Controlla la connessione.</div>';
        return;
    }

    bookList.innerHTML = '';
    
    for (const bookId of Object.keys(booksData)) {
        const book = booksData[bookId];
        const coverDiv = document.createElement('div');
        coverDiv.className = 'book-cover';
        
        // Aggiungi il numero del libro
        const numberSpan = document.createElement('span');
        numberSpan.className = 'book-number';
        numberSpan.textContent = `#${bookId}`;
        coverDiv.appendChild(numberSpan);
        
        // Crea un canvas per la copertina
        const canvas = document.createElement('canvas');
        coverDiv.appendChild(canvas);
        
        // Aggiungi il titolo
        const titleSpan = document.createElement('span');
        titleSpan.className = 'book-title';
        titleSpan.textContent = book.title;
        coverDiv.appendChild(titleSpan);
        
        // Carica la copertina dal PDF
        try {
            await loadPdfCover(book.pdf, canvas);
        } catch (err) {
            console.error(`Impossibile caricare la copertina per ${book.title}:`, err);
            canvas.style.display = 'none';
            const fallback = document.createElement('span');
            fallback.style.fontSize = '3em';
            fallback.textContent = '📖';
            coverDiv.insertBefore(fallback, titleSpan);
        }
        
        coverDiv.onclick = () => startNewGame(bookId);
        bookList.appendChild(coverDiv);
    }
}

// Funzione per caricare la prima pagina di un PDF come copertina
async function loadPdfCover(pdfUrl, canvas) {
    const loadingTask = pdfjsLib.getDocument(pdfUrl);
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1); // Prendi la prima pagina
    
    // Imposta una scala ragionevole per la risoluzione
    const viewport = page.getViewport({ scale: 1.5 });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    const context = canvas.getContext('2d');
    const renderContext = {
        canvasContext: context,
        viewport: viewport
    };
    
    await page.render(renderContext).promise;
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
        localStorage.setItem('fontSize', size);
    });

    rollDiceBtn.addEventListener('click', () => rollDice());

    loadFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const loadedState = JSON.parse(e.target.result);
                gameState = loadedState;
                showScreen('game-screen');
                renderPage(gameState.currentPage);
                updateHeader();
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

// ==================== CREAZIONE ZONE DI CLICK ====================
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
    gameState = {
        currentBook: bookId,
        currentPage: '1',
        player: {
            combattività: 0,
            resistenza: 0,
            resistenzaIniziale: 0,
            zaino: [],
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
        combatData: null
    };
    showCharacterCreation();
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
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = arte;
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
        label.appendChild(document.createTextNode(arte));
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
    gameState.player.borsa = Math.floor(Math.random() * 10) + 10;
    
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
    const book = booksData[gameState.currentBook];
    const page = book.pages[pageId];

    if (!page) {
        pageContent.innerHTML = `<p>Pagina ${pageId} non trovata. Il libro non è ancora completo.</p>`;
        choicesArea.innerHTML = `<button class="choice-btn" onclick="renderPage('1')">Torna all'inizio</button>`;
        return;
    }

    gameState.currentPage = pageId;
    if (page.onEnter) page.onEnter();
    updateHeader();

    let contentHTML = `<p>${page.text}</p>`;
    if (page.image) contentHTML += `<img src="${page.image}" alt="Illustrazione">`;
    pageContent.innerHTML = contentHTML;

    if (page.combat) {
        startCombat(page.combat);
    } else {
        choicesArea.innerHTML = '';
        if (page.choices) {
            page.choices.forEach(choice => {
                const btn = document.createElement('button');
                btn.className = 'choice-btn';
                btn.textContent = choice.text;
                btn.onclick = () => {
                    gameState.history.push(gameState.currentPage);
                    if (choice.target === 'restart') startNewGame(gameState.currentBook);
                    else renderPage(choice.target);
                };
                choicesArea.appendChild(btn);
            });
        }
    }
    document.getElementById('content-area').scrollTop = 0;
}

// ==================== GESTIONE COMBATTIMENTO ====================
function startCombat(combatData) {
    gameState.inCombat = true;
    gameState.combatData = combatData;
    
    gameState.enemy = {
        name: combatData.name,
        combattività: combatData.combattività,
        resistenza: combatData.resistenza,
        resistenzaIniziale: combatData.resistenza
    };
    
    updateHeader();

    choicesArea.innerHTML = `
        <button id="attack-btn" class="choice-btn combat-btn">⚔️ Attacca!</button>
        <button id="flee-btn" class="choice-btn">🏃 Fuggi (se possibile)</button>
    `;

    document.getElementById('attack-btn').onclick = () => performAttack();
    document.getElementById('flee-btn').onclick = () => attemptFlee();
}

function performAttack() {
    openDiceModal((diceRoll) => {
        const rapportoForza = gameState.player.combattività - gameState.enemy.combattività;
        const risultato = calcolaRisultatoCombattimento(rapportoForza, diceRoll);
        
        gameState.player.resistenza -= risultato.dannoLS;
        gameState.enemy.resistenza -= risultato.dannoN;

        if (gameState.player.resistenza < 0) gameState.player.resistenza = 0;
        if (gameState.enemy.resistenza < 0) gameState.enemy.resistenza = 0;

        updateHeader();

        if (gameState.player.resistenza <= 0) {
            gameState.inCombat = false;
            renderPage(gameState.combatData.onLose);
        } else if (gameState.enemy.resistenza <= 0) {
            gameState.inCombat = false;
            const onWin = gameState.combatData.onWin;
            gameState.enemy = { name: '', combattività: 0, resistenza: 0, resistenzaIniziale: 0 };
            updateHeader();
            renderPage(onWin);
        } else {
            const msg = document.createElement('p');
            msg.style.textAlign = 'center';
            msg.style.color = '#e74c3c';
            msg.innerHTML = `Hai inflitto <strong>${risultato.dannoN}</strong> danni! Hai subito <strong>${risultato.dannoLS}</strong> danni!`;
            choicesArea.insertBefore(msg, choicesArea.firstChild);
        }
    });
}

// NOTA: Questa è una tabella semplificata. Sostituiscila con quella vera del libro.
function calcolaRisultatoCombattimento(rapportoForza, dado) {
    let dannoLS = 0;
    let dannoN = 0;
    
    if (rapportoForza >= 0) {
        dannoLS = Math.max(0, Math.floor((10 - dado) / 3));
        dannoN = Math.max(1, Math.floor((dado + rapportoForza) / 2));
    } else {
        dannoLS = Math.max(0, Math.floor((10 - dado - rapportoForza) / 2));
        dannoN = Math.max(0, Math.floor(dado / 3));
    }
    
    return { dannoLS: Math.min(dannoLS, 6), dannoN: Math.min(dannoN, 6) };
}

function attemptFlee() {
    if (confirm("Sei sicuro di voler fuggire? Perderai tutti i punti di Resistenza persi finora in questo combattimento.")) {
        gameState.inCombat = false;
        gameState.enemy = { name: '', combattività: 0, resistenza: 0, resistenzaIniziale: 0 };
        updateHeader();
        const prevPage = gameState.history[gameState.history.length - 1] || '1';
        renderPage(prevPage);
    }
}

// ==================== AGGIORNA HEADER ====================
function updateHeader() {
    document.getElementById('ls-res').textContent = gameState.player.resistenza;
    document.getElementById('combattività').textContent = gameState.player.combattività;
    
    if (gameState.enemy.name && gameState.enemy.resistenza > 0) {
        document.getElementById('n-res').textContent = gameState.enemy.resistenza;
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
    
    rollDiceBtn.onclick = () => {
        rollDice((total) => {
            diceModal.classList.remove('active');
            if (callback) callback(total);
        });
    };
}

function rollDice(callback) {
    die1.classList.add('rolling');
    die2.classList.add('rolling');
    rollDiceBtn.disabled = true;
    diceResult.textContent = '';

    setTimeout(() => {
        const roll1 = Math.floor(Math.random() * 10);
        const roll2 = Math.floor(Math.random() * 10);
        
        die1.textContent = roll1;
        die2.textContent = roll2;
        die1.classList.remove('rolling');
        die2.classList.remove('rolling');
        
        const total = roll1 + roll2;
        diceResult.textContent = `Risultato: ${total} (${roll1} + ${roll2})`;
        rollDiceBtn.disabled = false;

        if (callback) setTimeout(() => callback(total), 1200);
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
    } else {
        console.warn(`Posizione non trovata sulla mappa: ${newLocationKey}`);
    }
}

// ==================== INVENTARIO ====================
function showInventory() {
    let html = '';
    
    html += `<h3>💰 Borsa</h3>`;
    html += `<p>${gameState.player.borsa} Corone d'Oro</p>`;
    
    html += `<h3>🎒 Zaino</h3>`;
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
    a.download = `lupo_solitario_salvataggio_${gameState.currentBook}_pag${gameState.currentPage}_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert("Partita salvata! Il file è stato scaricato.");
}

// ==================== IMPOSTAZIONI ====================
function applySettings() {
    const savedFontSize = localStorage.getItem('fontSize');
    if (savedFontSize) {
        document.documentElement.style.setProperty('--font-size', `${savedFontSize}px`);
        fontSizeSlider.value = savedFontSize;
        fontSizeValue.textContent = savedFontSize;
    }
}

// ==================== AVVIA L'APP ====================
init();