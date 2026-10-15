/* Proyecto Tablero — Controlador y Lógica Garantizada
 * Las partidas se generan partiendo de una solución y mezclándose mediante swaps, 
 * asegurando que siempre sean 100% resolubles en cualquier dimensión.
 */

"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const CONFIG = {
    defaultDimension: 4,
    types: [
      { label: "Tipo 1", geometric: "circle", icon: "star" },
      { label: "Tipo 2", geometric: "square", icon: "diamond" },
      { label: "Tipo 3", geometric: "triangle", icon: "hexagon" }
    ],
    shuffleFactor: 12
  };

  class GameModel {
    constructor(dimension = CONFIG.defaultDimension) {
      this.dimension = dimension;
      this.size = "mediana";
      this.shape = "geometricas";
      this.board = [];
      this.moves = 0;
      this.finished = false;
      this.history = [];
      this.newGame();
    }

    newGame() {
      const n = this.dimension;

      // 1. Construir una solución válida: cada fila tiene un único tipo de forma cíclica.
      const solved = Array.from({ length: n }, (_, row) =>
        Array(n).fill(row % CONFIG.types.length)
      );

      this.board = solved.map(row => row.slice());
      this.moves = 0;
      this.finished = false;
      this.history = [];

      // 2. Mezclar mediante intercambios reales (swaps). 
      // Al hacer esto, la cantidad de fichas de cada tipo no cambia y la partida SIEMPRE es resoluble[cite: 248].
      const swaps = Math.max(n * n * CONFIG.shuffleFactor, 30);
      for (let i = 0; i < swaps; i += 1) {
        const first = this.randomPosition();
        let second = this.randomPosition();

        while (first.row === second.row && first.col === second.col) {
          second = this.randomPosition();
        }

        const temp = this.board[first.row][first.col];
        this.board[first.row][first.col] = this.board[second.row][second.col];
        this.board[second.row][second.col] = temp;
      }

      this.moves = 0;
      this.history = [];
      this.finished = false;

      // Evitar que una partida nueva aparezca ya resuelta por casualidad al terminar de mezclar.
      if (this.isVictory()) {
        const first = { row: 0, col: 0 };
        let second = null;

        for (let row = 0; row < n && !second; row += 1) {
          for (let col = 0; col < n; col += 1) {
            if (this.board[row][col] !== this.board[first.row][first.col]) {
              second = { row, col };
              break;
            }
          }
        }

        if (second) this.swap(first, second, false);
        this.moves = 0;
        this.history = [];
      }
    }

    randomPosition() {
      return {
        row: Math.floor(Math.random() * this.dimension),
        col: Math.floor(Math.random() * this.dimension)
      };
    }

    isValidPosition(position) {
      return Number.isInteger(position.row) &&
        Number.isInteger(position.col) &&
        position.row >= 0 &&
        position.col >= 0 &&
        position.row < this.dimension &&
        position.col < this.dimension;
    }

    swap(first, second, saveHistory = true) {
      if (!this.isValidPosition(first) || !this.isValidPosition(second)) return false;
      if (first.row === second.row && first.col === second.col) return false;
      if (this.finished) return false;

      if (saveHistory) {
        this.history.push({
          board: this.board.map(row => row.slice()),
          moves: this.moves
        });
      }

      const temp = this.board[first.row][first.col];
      this.board[first.row][first.col] = this.board[second.row][second.col];
      this.board[second.row][second.col] = temp;
      this.moves += 1;
      this.finished = this.isVictory();
      return true;
    }

    undo() {
      if (this.history.length === 0) return false;
      const previous = this.history.pop();
      this.board = previous.board;
      this.moves = previous.moves;
      this.finished = this.isVictory();
      return true;
    }

    isRowComplete(row) {
      return row.length > 0 && row.every(type => type === row[0]);
    }

    completedRows() {
      return this.board.filter(row => this.isRowComplete(row)).length;
    }

    isVictory() {
      return this.board.length > 0 &&
        this.board.every(row => this.isRowComplete(row));
    }

    setDimension(value) {
      const dimension = Number(value);
      if (!Number.isInteger(dimension) || dimension < 3 || dimension > 8) return false;
      this.dimension = dimension;
      return true;
    }

    setSize(value) {
      if (!["pequena", "mediana", "grande"].includes(value)) return false;
      this.size = value;
      return true;
    }

    setShape(value) {
      if (!["geometricas", "iconos"].includes(value)) return false;
      this.shape = value;
      return true;
    }
  }

  class GameView {
    constructor() {
      this.board = document.querySelector("[data-grid-board]");
      this.dimensionLabel = document.querySelector("[data-dimension-label]");
      this.moveLabel = document.querySelector("[data-move-label]");
      this.completedCount = document.querySelector("[data-completed-count]");
      this.totalCount = document.querySelector("[data-total-count]");
      this.progress = document.querySelector("[data-progress]");
      this.progressBar = document.querySelector("[data-progress-bar]");
      this.progressHint = document.querySelector("[data-progress-hint]");
      this.boardTitle = document.getElementById("board-title");
      this.undoButton = document.querySelector('[data-action="undo"]');
      this.helpDialog = document.querySelector('[data-modal="help"]');
      this.toast = document.querySelector("[data-toast]");
      this.pieceLegend = document.querySelector("[data-piece-legend]");
      this.toastTimer = null;
      this.selectedPosition = null;
      this.dragSource = null;
    }

    render(model) {
      const n = model.dimension;
      this.board.replaceChildren();
      this.board.style.setProperty("--grid-dim", n);
      this.board.dataset.shape = model.shape;
      this.board.dataset.size = model.size;
      this.board.setAttribute("aria-label", `Tablero de fichas de ${n} por ${n}`);
      this.dimensionLabel.textContent = `${n} × ${n}`;
      this.moveLabel.textContent = model.moves;
      this.completedCount.textContent = model.completedRows();
      this.totalCount.textContent = n;
      this.progress.setAttribute("aria-valuemax", String(n));
      this.progress.setAttribute("aria-valuenow", String(model.completedRows()));
      this.progressBar.style.width = `${(model.completedRows() / n) * 100}%`;
      this.undoButton.disabled = model.history.length === 0;

      if (model.finished) {
        this.boardTitle.textContent = "¡Partida completada!";
        this.setStatus(`¡Enhorabuena! Has completado las ${n} filas en ${model.moves} movimientos.`);
      } else {
        this.boardTitle.textContent = "Partida en curso";
      }
      
      for (let row = 0; row < n; row += 1) {
        for (let col = 0; col < n; col += 1) {
          const cell = document.createElement("button");
          cell.type = "button";
          cell.className = "cell";
          cell.dataset.row = String(row);
          cell.dataset.col = String(col);
          cell.setAttribute("aria-label", `Fila ${row + 1}, columna ${col + 1}, ${CONFIG.types[model.board[row][col]].label}`);
          cell.setAttribute("aria-pressed", "false");
          cell.disabled = model.finished;

          const piece = document.createElement("span");
          const type = model.board[row][col];
          const shape = CONFIG.types[type][model.shape === "iconos" ? "icon" : "geometric"];
          piece.className = `piece type-${type} shape-${shape} size-${model.size}`;
          piece.dataset.type = String(type);
          piece.dataset.size = model.size;
          piece.dataset.shape = shape;
          piece.draggable = !model.finished;
          piece.setAttribute("aria-hidden", "true");

          if (this.selectedPosition &&
              this.selectedPosition.row === row &&
              this.selectedPosition.col === col) {
            cell.classList.add("is-selected");
            cell.setAttribute("aria-pressed", "true");
          }

          cell.append(piece);
          this.board.append(cell);
        }
      }

      this.renderLegend(model.shape);
    }

    renderLegend(shapeSet) {
      const names = shapeSet === "iconos"
        ? ["Estrella", "Rombo", "Hexágono"]
        : ["Círculo", "Cuadrado", "Triángulo"];
      const classes = shapeSet === "iconos"
        ? ["star", "diamond", "hexagon"]
        : ["circle", "square", "triangle"];

      this.pieceLegend.replaceChildren();
      names.forEach((name, index) => {
        const item = document.createElement("li");
        const shape = document.createElement("span");
        shape.className = `legend-shape type-${index} shape-${classes[index]}`;
        shape.setAttribute("aria-hidden", "true");
        const label = document.createElement("span");
        label.textContent = `Tipo ${index + 1} · ${name}`;
        item.append(shape, label);
        this.pieceLegend.append(item);
      });
    }

    setStatus(message) {
      this.status.textContent = message;
    }

    showToast(message) {
      window.clearTimeout(this.toastTimer);
      this.toast.textContent = message;
      this.toast.hidden = false;
      this.toastTimer = window.setTimeout(() => {
        this.toast.hidden = true;
      }, 2600);
    }

    clearSelection() {
      this.selectedPosition = null;
      this.board.querySelectorAll(".cell.is-selected").forEach(cell => {
        cell.classList.remove("is-selected");
        cell.setAttribute("aria-pressed", "false");
      });
    }

    openHelp() {
      if (typeof this.helpDialog.showModal === "function") {
        this.helpDialog.showModal();
      } else {
        this.helpDialog.setAttribute("open", "");
      }
    }

    closeHelp() {
      if (typeof this.helpDialog.close === "function" && this.helpDialog.open) {
        this.helpDialog.close();
      } else {
        this.helpDialog.removeAttribute("open");
      }
    }
  }

  class GameController {
    constructor(model, view) {
      this.model = model;
      this.view = view;
      this.bindEvents();
      this.view.render(this.model);
      this.view.setStatus("Tablero mezclado y 100% resoluble. Selecciona o arrastra fichas para intercambiarlas.");
    }

    bindEvents() {
      document.querySelector('[data-action="new"]').addEventListener("click", () => {
        this.startNewGame("Nueva partida creada. ¡Organiza las filas!");
      });

      document.querySelector('[data-action="undo"]').addEventListener("click", () => {
        if (this.model.undo()) {
          this.view.clearSelection();
          this.view.render(this.model);
          this.view.setStatus("Movimiento deshecho. Puedes seguir jugando.");
          this.view.showToast("Se ha deshecho el último movimiento.");
        }
      });

      document.querySelector('[data-action="help"]').addEventListener("click", () => {
        this.view.openHelp();
      });

      document.querySelectorAll('[data-action="close-help"]').forEach(button => {
        button.addEventListener("click", () => this.view.closeHelp());
      });

      this.view.helpDialog.addEventListener("click", event => {
        if (event.target === this.view.helpDialog) this.view.closeHelp();
      });

      document.querySelector('[data-control="dimension"]').addEventListener("change", event => {
        if (this.model.setDimension(event.target.value)) {
          this.startNewGame(`Tablero cambiado a ${this.model.dimension} × ${this.model.dimension}.`);
        }
      });

      document.querySelector('[data-control="size"]').addEventListener("change", event => {
        if (this.model.setSize(event.target.value)) {
          this.startNewGame(`Tamaño de ficha cambiado a ${event.target.selectedOptions[0].text.toLowerCase()}.`);
        }
      });

      document.querySelector('[data-control="shape"]').addEventListener("change", event => {
        if (this.model.setShape(event.target.value)) {
          this.startNewGame("Se ha cambiado la forma de las fichas y creado una nueva partida.");
        }
      });

      this.view.board.addEventListener("click", event => {
        const cell = event.target.closest(".cell");
        if (!cell || this.model.finished) return;
        this.handleCellSelection(this.positionFromCell(cell));
      });

      this.view.board.addEventListener("keydown", event => {
        if (event.key === "Escape" && this.view.selectedPosition) {
          this.view.clearSelection();
          this.view.setStatus("Selección cancelada.");
        }
      });

      // Drag & Drop Nativo API
      this.view.board.addEventListener("dragstart", event => {
        const cell = event.target.closest(".cell");
        if (!cell || this.model.finished) {
          event.preventDefault();
          return;
        }

        this.view.dragSource = this.positionFromCell(cell);
        event.dataTransfer.setData("text/plain", JSON.stringify(this.view.dragSource));
        event.dataTransfer.effectAllowed = "move";
        cell.classList.add("is-dragging");
      });

      this.view.board.addEventListener("dragend", () => {
        this.view.board.querySelectorAll(".is-dragging, .drag-over").forEach(element => {
          element.classList.remove("is-dragging", "drag-over");
        });
        this.view.dragSource = null;
      });

      this.view.board.addEventListener("dragover", event => {
        const cell = event.target.closest(".cell");
        if (!cell || this.model.finished) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        cell.classList.add("drag-over");
      });

      this.view.board.addEventListener("dragleave", event => {
        const cell = event.target.closest(".cell");
        if (cell && !cell.contains(event.relatedTarget)) cell.classList.remove("drag-over");
      });

      this.view.board.addEventListener("drop", event => {
        const cell = event.target.closest(".cell");
        if (!cell || this.model.finished) return;
        event.preventDefault();
        cell.classList.remove("drag-over");

        let source = null;
        try {
          source = JSON.parse(event.dataTransfer.getData("text/plain"));
        } catch {
          source = this.view.dragSource;
        }
        if (!source) source = this.view.dragSource;
        if (!source) return;

        this.performSwap(source, this.positionFromCell(cell));
      });
    }

    positionFromCell(cell) {
      return {
        row: Number(cell.dataset.row),
        col: Number(cell.dataset.col)
      };
    }

    handleCellSelection(position) {
      if (!this.view.selectedPosition) {
        this.view.selectedPosition = position;
        this.view.render(this.model);
        this.view.setStatus(`Ficha seleccionada: fila ${position.row + 1}, columna ${position.col + 1}. Elige otra ficha para intercambiar.`);
        return;
      }

      const first = this.view.selectedPosition;
      if (first.row === position.row && first.col === position.col) {
        this.view.clearSelection();
        this.view.setStatus("Selección cancelada. Elige una ficha cuando quieras.");
        return;
      }

      this.performSwap(first, position);
    }

    performSwap(first, second) {
      if (first.row === second.row && first.col === second.col) return;

      const moved = this.model.swap(first, second);
      this.view.clearSelection();

      if (!moved) {
        this.view.render(this.model);
        return;
      }

      this.view.render(this.model);
      if (this.model.finished) {
        this.view.setStatus(`¡Enhorabuena! Has completado todas las filas en ${this.model.moves} movimientos.`);
        this.view.showToast("¡Partida completada con éxito!");
      } else {
        this.view.setStatus(`Intercambio realizado. Filas completadas: ${this.model.completedRows()} de ${this.model.dimension}.`);
        this.view.showToast("Fichas intercambiadas.");
      }
    }

    startNewGame(message) {
      this.view.clearSelection();
      this.model.newGame();
      this.view.render(this.model);
      this.view.setStatus(message);
      this.view.showToast(message);
    }
  }

  const model = new GameModel();
  const view = new GameView();
  new GameController(model, view);
});