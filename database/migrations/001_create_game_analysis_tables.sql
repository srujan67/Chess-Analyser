-- Immutable Stockfish analysis runs and their per-move evaluations.
-- Safe to apply more than once.
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
