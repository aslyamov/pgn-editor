let games = []; 
let currentGameIndex = -1;
let board = null;
let gameLogic = new Chess();
let originalFileName = "edited_games.pgn";
let sortableInstance = null;

$(document).ready(function() {
    board = Chessboard('board', {
        position: 'start',
        draggable: true,
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png',
        onDrop: handleMove
    });
    
    Split(['#sidebar-wrapper', '#editor-area'], {
        sizes: [25, 75], 
        minSize: 200,
        gutterSize: 8,
        onDragEnd: function() { board.resize(); }
    });

    Split(['#board-col', '#controls-col'], {
        sizes: [50, 50],
        minSize: 300,
        gutterSize: 8,
        onDragEnd: function() { board.resize(); }
    });

    $('#fileInput').on('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        originalFileName = file.name;
        const reader = new FileReader();
        reader.onload = function(e) {
            parsePGNFile(e.target.result);
        };
        reader.readAsText(file);
    });

    $(window).resize(board.resize);
    initSortable();
});

function initSortable() {
    const el = document.getElementById('sidebar');
    sortableInstance = Sortable.create(el, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        onEnd: function (evt) {
            if ($('#searchInput').val().trim() !== '') {
                renderSidebar(); 
                return;
            }
            const item = games.splice(evt.oldIndex, 1)[0];
            games.splice(evt.newIndex, 0, item);

            renderSidebar(false); 
            
            if (currentGameIndex === evt.oldIndex) {
                currentGameIndex = evt.newIndex;
            } else if (currentGameIndex > evt.oldIndex && currentGameIndex <= evt.newIndex) {
                currentGameIndex--;
            } else if (currentGameIndex < evt.oldIndex && currentGameIndex >= evt.newIndex) {
                currentGameIndex++;
            }
            loadGame(currentGameIndex);
            $('#statusText').text(`| Порядок изменен. Всего: ${games.length}`);
        }
    });
}

function parsePGNFile(content) {
    games = [];
    // Регулярка для сплита. Работает хорошо для стандартных PGN
    const rawGames = content.split(/(?=\[Event ")/g);
    
    rawGames.forEach(chunk => {
        if (chunk.trim().length < 5) return;
        
        const headers = {};
        // Этот парсер забирает ВСЕ теги, включая Event, Site, Date, Round, Result, SetUp и т.д.
        const headerRegex = /\[([A-Za-z0-9]+)\s+"([^"]+)"\]/g;
        let match;
        while ((match = headerRegex.exec(chunk)) !== null) {
            headers[match[1]] = match[2];
        }

        const movesIndex = chunk.lastIndexOf('"]');
        let moves = "";
        if (movesIndex !== -1) {
            moves = chunk.substring(movesIndex + 2).trim();
        }

        games.push({
            headers: headers,
            moves: moves,
            modified: false,
            displayIndex: games.length + 1
        });
    });

    $('#statusText').text(`| Загружено: ${games.length} поз.`);
    renderSidebar();
    if (games.length > 0) loadGame(0);
}

function renderSidebar() {
    const filter = $('#searchInput').val().toLowerCase();
    const $sidebar = $('#sidebar');
    
    if (sortableInstance) {
        sortableInstance.option("disabled", filter !== "");
    }
    
    let htmlBuffer = [];
    
    games.forEach((game, index) => {
        const white = (game.headers['White'] || '?').toLowerCase();
        const black = (game.headers['Black'] || '?').toLowerCase();
        const event = (game.headers['Event'] || '').toLowerCase();
        const fen = (game.headers['FEN'] || '').toLowerCase();
        
        if (filter && !white.includes(filter) && !black.includes(filter) && !event.includes(filter) && !fen.includes(filter)) {
            return; 
        }

        const title = `${game.headers['White']} vs ${game.headers['Black']}`;
        const activeClass = (index === currentGameIndex) ? 'active' : '';
        const modClass = (game.modified) ? 'modified' : '';

        htmlBuffer.push(`
            <div class="game-item ${activeClass} ${modClass}" onclick="loadGame(${index})" data-id="${index}">
                <div class="game-header">
                    <span class="game-idx">#${index + 1}</span>
                    <span style="flex:1; margin-left:5px;">${title}</span>
                </div>
                <div class="game-fen">${game.headers['FEN'] || 'Start Position'}</div>
            </div>
        `);
    });

    if (htmlBuffer.length === 0) {
        $sidebar.html('<div style="padding:20px; text-align:center; color:#999">Ничего не найдено</div>');
    } else {
        $sidebar.html(htmlBuffer.join(''));
    }
}

function loadGame(index) {
    if (index < 0 || index >= games.length) return;

    $(`#sidebar .game-item`).removeClass('active');
    $(`#sidebar .game-item[onclick="loadGame(${index})"]`).addClass('active');

    currentGameIndex = index;
    const game = games[index];
    
    // Заполняем поля (если тега нет, ставим пустую строку)
    $('#tagEvent').val(game.headers['Event'] || '');
    $('#tagSite').val(game.headers['Site'] || '');
    $('#tagRound').val(game.headers['Round'] || '');
    $('#tagWhite').val(game.headers['White'] || '');
    $('#tagBlack').val(game.headers['Black'] || '');
    $('#tagResult').val(game.headers['Result'] || '*');
    
    // Конвертация даты для input type="date" (PGN: YYYY.MM.DD -> HTML: YYYY-MM-DD)
    const pgnDate = game.headers['Date'] || '';
    $('#tagDate').val(pgnDate.replace(/\./g, '-'));

    $('#rawMoves').val(game.moves || '');

    const fen = game.headers['FEN'] || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    $('#tagFEN').val(fen);
    
    if (!gameLogic.load(fen)) {
            board.position(fen);
    } else {
        board.position(gameLogic.fen());
    }
    
    updateTurnUI(fen);
}

function updateTurnUI(fen) {
    const turn = fen.split(' ')[1] || 'w';
    $('.turn-option').removeClass('selected');
    $(`#turn-${turn}`).addClass('selected');
    $(`input[name="turn"][value="${turn}"]`).prop('checked', true);
}

function updateTurn(color) {
    if (currentGameIndex === -1) return;
    let currentFen = $('#tagFEN').val();
    let parts = currentFen.split(' ');
    if (parts.length >= 2) {
        parts[1] = color; 
        let newFen = parts.join(' ');
        $('#tagFEN').val(newFen);
        manualFenUpdate();
    }
}

function manualFenUpdate() {
    const newFen = $('#tagFEN').val();
    games[currentGameIndex].headers['FEN'] = newFen;
    games[currentGameIndex].headers['SetUp'] = '1';
    
    markAsModified();
    
    gameLogic.load(newFen);
    board.position(newFen, false);
    updateTurnUI(newFen);
    
    $(`.game-item[onclick="loadGame(${currentGameIndex})"] .game-fen`).text(newFen);
}

function updateCurrentGameData() {
    if (currentGameIndex === -1) return;
    const game = games[currentGameIndex];
    
    game.headers['Event'] = $('#tagEvent').val();
    game.headers['Site'] = $('#tagSite').val();
    game.headers['Round'] = $('#tagRound').val();
    game.headers['White'] = $('#tagWhite').val();
    game.headers['Black'] = $('#tagBlack').val();
    game.headers['Result'] = $('#tagResult').val();
    
    // Обратная конвертация даты (HTML: YYYY-MM-DD -> PGN: YYYY.MM.DD)
    const htmlDate = $('#tagDate').val();
    game.headers['Date'] = htmlDate.replace(/-/g, '.');

    game.moves = $('#rawMoves').val();
    
    markAsModified();
    
    $(`.game-item[onclick="loadGame(${currentGameIndex})"] span:nth-child(2)`).text(`${game.headers['White']} vs ${game.headers['Black']}`);
}

function markAsModified() {
    games[currentGameIndex].modified = true;
    $(`.game-item[onclick="loadGame(${currentGameIndex})"]`).addClass('modified');
    
    const modCount = games.filter(g => g.modified).length;
    $('#statusText').text(`| Всего: ${games.length} | Изменено: ${modCount}`);
}

function handleMove(source, target) {
    const move = gameLogic.move({ from: source, to: target, promotion: 'q' });
    if (move === null) return 'snapback';

    const newFen = gameLogic.fen();
    $('#tagFEN').val(newFen);
    manualFenUpdate();
}

function flipBoard() {
    board.flip();
}

function downloadPGN() {
    let output = "";
    games.forEach(game => {
        if (!game.headers['Event']) game.headers['Event'] = "Edited Position";
        
        // Приоритетный порядок тегов
        const order = ['Event', 'Site', 'Date', 'Round', 'White', 'Black', 'Result', 'FEN', 'SetUp'];
        const usedKeys = new Set();

        order.forEach(key => {
            if (game.headers[key]) {
                output += `[${key} "${game.headers[key]}"]\n`;
                usedKeys.add(key);
            }
        });

        // Дописываем все остальные теги, которых нет в списке выше (например, ECO или что-то кастомное)
        for (const [key, value] of Object.entries(game.headers)) {
            if (!usedKeys.has(key)) {
                output += `[${key} "${value}"]\n`;
            }
        }
        
        output += '\n' + (game.moves || '*') + '\n\n';
    });

    const blob = new Blob([output], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "Edited_" + originalFileName;
    a.click();
    window.URL.revokeObjectURL(url);
}