-- =====================================================================
--  Dashboard Builder - MySQL schema
--  Compatible with MySQL 8.0+ (uses JSON columns and CHECK constraints)
-- =====================================================================

CREATE DATABASE IF NOT EXISTS dashboard_builder
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE dashboard_builder;

-- ---------------------------------------------------------------------
-- users: account owners of dashboards
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  name          VARCHAR(50)   NOT NULL,
  email         VARCHAR(254)  NOT NULL,
  password_hash VARCHAR(100)  NOT NULL,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- dashboards: one canvas per row. `version` enables optimistic locking
-- so two tabs cannot silently overwrite each other's layout.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dashboards (
  id               INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  user_id          INT UNSIGNED      NOT NULL,
  name             VARCHAR(100)      NOT NULL,
  description      VARCHAR(500)      NOT NULL DEFAULT '',
  canvas_width     SMALLINT UNSIGNED NOT NULL DEFAULT 1200,
  background_color CHAR(7)           NOT NULL DEFAULT '#f4f6fb',
  version          INT UNSIGNED      NOT NULL DEFAULT 1,
  sort_order       INT               NOT NULL DEFAULT 0, -- user-defined position in "My dashboards"
  created_at       TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_dashboards_user (user_id, updated_at),
  KEY idx_dashboards_user_order (user_id, sort_order),
  CONSTRAINT fk_dashboards_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT chk_dashboards_width CHECK (canvas_width BETWEEN 800 AND 2400)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- sections: movable / resizable containers placed on the dashboard canvas
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sections (
  id               INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  dashboard_id     INT UNSIGNED      NOT NULL,
  title            VARCHAR(100)      NOT NULL DEFAULT '',
  pos_x            INT               NOT NULL DEFAULT 0,
  pos_y            INT               NOT NULL DEFAULT 0,
  width            INT               NOT NULL,
  height           INT               NOT NULL,
  z_index          INT               NOT NULL DEFAULT 1,
  background_color CHAR(7)           NOT NULL DEFAULT '#ffffff',
  created_at       TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sections_dashboard (dashboard_id),
  CONSTRAINT fk_sections_dashboard FOREIGN KEY (dashboard_id) REFERENCES dashboards (id) ON DELETE CASCADE,
  CONSTRAINT chk_sections_geometry CHECK (pos_x >= 0 AND pos_y >= 0 AND width > 0 AND height > 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- elements: draggable / resizable widgets inside a section.
-- Position is relative to the parent section. `content` holds the
-- type-specific configuration (rich-text HTML, image ref, chart config).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS elements (
  id          INT UNSIGNED                   NOT NULL AUTO_INCREMENT,
  section_id  INT UNSIGNED                   NOT NULL,
  type        ENUM('text', 'image', 'chart') NOT NULL,
  pos_x       INT                            NOT NULL DEFAULT 0,
  pos_y       INT                            NOT NULL DEFAULT 0,
  width       INT                            NOT NULL,
  height      INT                            NOT NULL,
  z_index     INT                            NOT NULL DEFAULT 1,
  content     JSON                           NOT NULL,
  created_at  TIMESTAMP                      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_elements_section (section_id),
  CONSTRAINT fk_elements_section FOREIGN KEY (section_id) REFERENCES sections (id) ON DELETE CASCADE,
  CONSTRAINT chk_elements_geometry CHECK (pos_x >= 0 AND pos_y >= 0 AND width > 0 AND height > 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- uploads: images uploaded by users (files live in /uploads on disk).
-- Used to authorize image access and image references in layouts.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS uploads (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  user_id       INT UNSIGNED  NOT NULL,
  stored_name   VARCHAR(64)   NOT NULL,
  original_name VARCHAR(255)  NOT NULL,
  mime_type     VARCHAR(50)   NOT NULL,
  size_bytes    INT UNSIGNED  NOT NULL,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_uploads_stored_name (stored_name),
  KEY idx_uploads_user (user_id),
  CONSTRAINT fk_uploads_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;
