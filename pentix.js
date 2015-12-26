window.onload = function() {
  var ui = {};
  ["selectLevel", "gameScreen", "glass", "nextPiece", "score", "gameOverMessage"]
    .forEach(function(n) { ui[n] = document.getElementById(n); });

  var settings = {
    gameDelay: 100, // Game delay and level delay define time after which a piece moves one position down.    
    size: [12, 22],
    levelDelays: [37,32,27,22,17,12,8,5,3,2] // The less delay the faster a piece moves.
  };

  function generateTable(size) {
    return "<table>" + Array(size[1]+1).join("<tr>" + Array(size[0]+1).join("<td></td>") + "</tr>") + "</table>";
  }

  /** A list of pieces. Each of them is a set of vectors that represent coordinates of the blocks. */
  var pieces = (function() {
    // A list of all rotations of pieces.
    //   Each piece rotation is represented by one column in a string below. A column forms a bit matrix 5x5. Each symbol in the
    //     string describes a row in this matrix. If you subtract 48 from a symbol ASCII code, you'll get a set of bits for the row.
    //   It's possible to rotate a piece with some algorithm. But keeping all rotation for each piece gives us better control
    //     over piece turnings.
    //      | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10| 11| 12| 13| 14| 15| 16| 17| 18| 19| 20| 21| 22| 23| 24| 25| 26| 27| 28|
    var f = "4444<4<40404<<840808L84HL884L<@4<8<8H4H4<<<<0404080<080408040<0486862<2<4684442<4444682<0040008008080404>6:6>>82>842"
          + "00000404>4>448<<N8N8@8L88<L<48L4H<H<<<<<<<<<0404N824N84<N<84N8@4>4>4>4>4><>6><>6>>>><<66<<<L<><<>86<L<H4:4>228824>4>"
          + "000000000404000008080<080804080<040408080000O4O4@8N48<N448N<28N42<2<8686244<8644444486<2<><<<<<LH<L468><060628>>48>2"
          + "0000000000000000080800000000000000000000000004040<0408040804080<0000000000000000000000008000400004040808000000000000"
          + "00000000000000000000000000000000000000000000040400000000000000000000000000000000000000000000000000000000000000000000";
    var colorIndices = [1,2,2,3,2,3,5,4,7,6,1,2,5,3,5,4,6,4,7,6,3,5,1,1,6,7,4,3,5];

    for (var pieces = [], i = 0; i < 29; i++)
      pieces.push(createPiece(i));

    return pieces;
    
    /** Returns an interface { getVectors: (p,r) => vector[], getCssClass: () => string } for the piece 'n' */
    function createPiece(n) {
      var rotations = [0,1,2,3].map(function(rot) {
        for (var vectors = [], row = 0; row < 5; row++)
          for (var col = 0, s = f.charCodeAt((row*29 + n)*4 + rot) - 48; col < 5; col++)
            if (s & (1 << col)) vectors.push([col, row]);
        return vectors; // Vectors of the blocks for the piece rotation
      });
 
      return {
        /** Gets a list of vectors for all blocks in a piece relative to piecePosition. */ 
        getVectors: function(piecePosition, rotation) {
          return rotations[rotation & 3].map(function(v) { return [ v[0] + piecePosition[0], v[1] + piecePosition[1] ] });
        },
        getCssClass: function() { return "piece" + colorIndices[n] }
      };
    }
  })();

  /**
   * Draws a piece inside a table.
   * @param {HTMLTableElement} table - An HTML table where the piece will be drawn.
   * @param {Piece} piece - A pentix piece 
   * @param {Vector} position - A position of the piece
   * @param {number} rotation - A rotation of the piece
   * @param {bool} visibility - Tells if a piece should be shown or removed.
   */
  function drawPiece(table, piece, position, rotation, visibility) {
    var className = visibility ? piece.getCssClass() : "";
    piece.getVectors(position, rotation).forEach(function(s) { table.rows[s[1]].cells[s[0]].className = className });
  }

  /** Shows the screen where a player can select a game level */
  function showSelectLevelScreen() {
    ui.selectLevel.className = 'selected';
    document.onkeydown = function(e) {
      e = e || window.event;
      var level = e.keyCode - 48;
      if (level >= 0 && level < 10) {
        ui.selectLevel.className = null;
        document.onkeydown = null;
        showGameScreen(level);
      }
    }
  }

  /**
   * Shows the screen where a gamer can play the game starting from 'startLevel'.
   * After the game screen appears, the game begins.
   */
  function showGameScreen(startLevel) {
    ui.gameScreen.className = 'selected';
    startNewGame();
    return;
    
    var timeout;
    function startNewGame() {
      ui.glass.innerHTML = generateTable(settings.size);
      ui.nextPiece.innerHTML = generateTable([5,5]);
      ui.glassTable = ui.glass.querySelector("table");
      ui.nextPieceTable = ui.nextPiece.querySelector("table");
      ui.nextPiece.className = "";

      var showNext, currentLevel = startLevel, score = 0, fullLines = 0; // A game state.

      // Normally the queue has 2 pieces - the current and the next. Now we only have 1 piece, but soon we'll add the next one.
      var pieceQueue = [Math.random() * pieces.length | 0]; 
      addNewPiece();
      return;
      
      function showScore() {
        ui.score.innerHTML = [
          "Your level: ", currentLevel, "<br />",
          "Full lines: ", fullLines, "<br /><br />",
          "SCORE: ", score
        ].join('');
      }
      
      /** Tires to add a new piece and gives a player control over it. If it's impossible to add the piece, the game finishes. */
      function addNewPiece() {
        var pieceScore = 0;
        var nextHasBeenShown = showNext;
        var pieceLevel = currentLevel;
        showScore();
        pieceQueue.unshift(Math.random() * pieces.length | 0);
        pieceQueue.length = 2;
        var position = [3, 0], rotation = 0;
        drawPiece(ui.nextPieceTable, pieces[pieceQueue[1]], [0,0], 0, false); // Remove a previous piece
        drawPiece(ui.nextPieceTable, pieces[pieceQueue[0]], [0,0], 0, true);  // Show a current piece
        
        if (!checkPosition(position, rotation)) { // If there's no space for a new piece, the game is over. 
          clearTimeout();
          drawCurrentPieceInsideGlass(true);
          document.onkeydown = null;
          ui.gameOverMessage.className = 'selected';
          window.setTimeout(function() {
            ui.gameOverMessage.className = '';
            ui.gameScreen.className = '';
            showSelectLevelScreen();
          }, 3000);
          return;
        }
        
        drawCurrentPieceInsideGlass(true);
        document.onkeydown = onKeyDown;
        setTimeout(false);
        return;
        
        ////////////////////////////
        //     Inner functions    //
        ////////////////////////////
        
        function clearTimeout() { if (timeout) window.clearTimeout(timeout); }
      
        /** Clears a timeout after which a piece will try to move one row down.
         * @param {bool} afterDrop - 'true' means that the user is in haste and the timeout should be shorter.
        */
    	  function setTimeout(afterDrop) {
          clearTimeout();
          timeout = window.setTimeout(moveDown, settings.levelDelays[pieceLevel] * settings.gameDelay / (afterDrop ? ~~Math.sqrt(10-currentLevel) : 1));
        };

        /** Moves a current piece one step down. If it's impossible, it tries to removeFullLines and adds a new piece. */
        function moveDown() {
          drawCurrentPieceInsideGlass(false); // Hide a piece
          position[1]++;
          if (checkPosition(position, rotation)) {
            pieceScore++;
            drawCurrentPieceInsideGlass(true);  // Draw the piece in a new position
            setTimeout();
            return;
          }
          
          position[1]--; // The piece has dived into the floor so we move it back.
          drawCurrentPieceInsideGlass(true); // Draw the piece in a previous position
          removeFullLines();
          score = score + 26 + currentLevel * 3 - pieceScore - (nextHasBeenShown ? 5 : 0);
          addNewPiece(); // Pieces are moved down by browser events, so there won't be an infinitive loop here.
        }

        function drawCurrentPieceInsideGlass(visibility) { drawPiece(ui.glassTable, pieces[pieceQueue[1]], position, rotation, visibility); }
        
        /** Checks if the current piece can be placed to a 'position' and rotated 'rotation' times. */
        function checkPosition(position, rotation) {
          return !pieces[pieceQueue[1]].getVectors(position, rotation).filter(function(p) {
            return p[0] < 0 || p[0] >= settings.size[0] || p[1] >= settings.size[1] || ui.glassTable.rows[p[1]].cells[p[0]].className;
          }).length;
        }

        /** Drops a piece and returns 'true' if it was actually dropped. */ 
        function dropPiece() {
          for (var flew = 0, pos = position.slice(0); checkPosition(pos, rotation); pos[1]++, flew++)
            position[1] = pos[1];
          return flew > 1;
        }

        /** Removes all totally filled lines. */ 
        function removeFullLines() {
          for (var i = settings.size[1] - 1, copyTo = i; i >= 0 || copyTo >= 0; i--, copyTo--) {
            var isRowFilled = true;
            for (var j = 0; j < settings.size[0]; j++) {
              var className = i < 0 ? '' : ui.glassTable.rows[i].cells[j].className;
              isRowFilled = isRowFilled && !!className;
              if (copyTo != i)
                ui.glassTable.rows[copyTo].cells[j].className = className;
            }
            
            if (!isRowFilled)
              continue;

            fullLines++;
            currentLevel += (fullLines / 10 | 0) > currentLevel && currentLevel < 9 ? 1 : 0;
            copyTo++;
          }
        }

        function onKeyDown(ev) {
          ev = ev || window.event;
          drawCurrentPieceInsideGlass(false); // Hide a piece
          var newPosition = position.slice(0);
          var newRotation = rotation;
          switch (ev.keyCode) {
            case 49: // 1
              nextHasBeenShown = true;
              showNext = !showNext;
              ui.nextPiece.className = showNext ? " visible" : "";
              break;
            case 36:  // Home (numpad 7)
            case 37:  // Left arrow
            case 103: // Numpad 7
              newPosition[0]--;
              break;
            case 38:  // Up arrow
            case 104: // Numpad 8
              newRotation = (newRotation - 1) & 3;
              break;
            case 33:  // Page up (numpad 9)
            case 39:  // Right arrow
            case 105: // Numpad 9
              newPosition[0]++;
              break;
            case 27:  // Esc
              startNewGame();
              return;
            case 32:  // Space
            case 40:  // Down arrow
              if (dropPiece()) {
                drawCurrentPieceInsideGlass(true);
                setTimeout(true);
                return;
              } else {
                clearTimeout();
                moveDown();
                return;
              }
              break;
            case 54:  // 6
            case 102: // Numpad 6
              if (currentLevel < 9) {
                currentLevel++;
                showScore();
              }
              break;
          }
          
          if (checkPosition(newPosition, newRotation)) {
            position = newPosition;
            rotation = newRotation;
          }
          
          drawCurrentPieceInsideGlass(true); // Draw the piece in a new position
        }
      };
    };
  }

  showSelectLevelScreen()
}
