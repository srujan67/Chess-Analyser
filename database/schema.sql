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

