-- =============================================================================
-- Chess Analyser - Database Schema
-- Database: chess_analyser
-- =============================================================================

CREATE DATABASE IF NOT EXISTS chess_analyser;
USE chess_analyser;

-- -----------------------------------------------------------------------------
-- Table: games
-- Stores imported chess games and associated metadata (PGN, players, result)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS games (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    white_player VARCHAR(100) NULL,
    black_player VARCHAR(100) NULL,
    result VARCHAR(7) NOT NULL DEFAULT '*',
    pgn LONGTEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Table: moves
-- Stores individual half-moves (plies) for each game, linking back to games.id
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS moves (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    game_id BIGINT UNSIGNED NOT NULL,
    ply_number INT UNSIGNED NOT NULL,
    san VARCHAR(20) NOT NULL,
    fen_after VARCHAR(150) NOT NULL,
    CONSTRAINT fk_moves_game
        FOREIGN KEY (game_id)
        REFERENCES games(id)
        ON DELETE CASCADE,
    CONSTRAINT uq_game_ply
        UNIQUE (game_id, ply_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Table: game_analyses
-- Stores immutable, completed Stockfish analysis runs for saved games
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS game_analyses (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    game_id BIGINT UNSIGNED NOT NULL,
    engine_version VARCHAR(100) NOT NULL,
    search_depth TINYINT UNSIGNED NOT NULL,
    completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_game_analyses_game
        FOREIGN KEY (game_id)
        REFERENCES games(id)
        ON DELETE CASCADE,
    INDEX idx_game_analyses_latest (game_id, completed_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Table: move_analyses
-- Stores the result and engine metadata for each move in an analysis run
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS move_analyses (
    analysis_id BIGINT UNSIGNED NOT NULL,
    move_id BIGINT UNSIGNED NOT NULL,
    best_move VARCHAR(5) NOT NULL,
    best_move_san VARCHAR(20) NULL,
    evaluation_before BIGINT NOT NULL,
    evaluation_before_type ENUM('centipawns', 'mate') NOT NULL,
    evaluation_after BIGINT NOT NULL,
    evaluation_after_type ENUM('centipawns', 'mate') NOT NULL,
    centipawn_loss INT UNSIGNED NULL,
    classification ENUM(
        'best_or_acceptable',
        'inaccuracy',
        'mistake',
        'blunder'
    ) NOT NULL,
    principal_variation JSON NOT NULL,
    engine_metadata JSON NOT NULL,
    PRIMARY KEY (analysis_id, move_id),
    CONSTRAINT fk_move_analyses_analysis
        FOREIGN KEY (analysis_id)
        REFERENCES game_analyses(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_move_analyses_move
        FOREIGN KEY (move_id)
        REFERENCES moves(id)
        ON DELETE CASCADE,
    INDEX idx_move_analyses_move (move_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
