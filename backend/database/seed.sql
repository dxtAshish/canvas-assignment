-- =====================================================================
--  Dashboard Builder - sample data
--  Demo login:  demo@example.com  /  Demo@1234
--  Idempotent: re-running will not duplicate rows (INSERT IGNORE on fixed ids).
--  The sample image file is copied to /uploads by `npm run db:setup`.
-- =====================================================================

USE dashboard_builder;

INSERT IGNORE INTO users (id, name, email, password_hash) VALUES
  (1, 'Demo User', 'demo@example.com', '$2b$12$6XN2VDqzPhly4PUJz4hcS.gSdQY300kNKfubHRTwx3T97utxPsaH2');

INSERT IGNORE INTO uploads (id, user_id, stored_name, original_name, mime_type, size_bytes) VALUES
  (1, 1, 'sample-banner-0001.png', 'sample-banner.png', 'image/png', 0);

INSERT IGNORE INTO dashboards (id, user_id, name, description, canvas_width, background_color, version, sort_order) VALUES
  (1, 1, 'Sales Overview', 'Sample dashboard with text, image and charts (static + dynamic data).', 1200, '#f4f6fb', 1, 0),
  (2, 1, 'Marketing Draft', 'An empty dashboard to start building from scratch.', 1200, '#f4f6fb', 1, 1);

INSERT IGNORE INTO sections (id, dashboard_id, title, pos_x, pos_y, width, height, z_index, background_color) VALUES
  (1, 1, 'Header',            20,  30, 1160, 200, 1, '#ffffff'),
  (2, 1, 'Monthly Revenue',   20, 260,  570, 380, 2, '#ffffff'),
  (3, 1, 'Live Web Traffic', 610, 260,  570, 380, 3, '#ffffff'),
  (4, 1, 'Notes',             20, 670, 1160, 180, 4, '#fffdf5');

INSERT IGNORE INTO elements (id, section_id, type, pos_x, pos_y, width, height, z_index, content) VALUES
  (1, 1, 'text', 20, 20, 700, 130, 1, JSON_OBJECT(
      'html', '<p><span style="font-size:32px"><b>Q3 Sales Overview</b></span></p><p><span style="font-size:16px">Revenue grew <b>18%</b> quarter over quarter. <i>All figures are dummy data.</i></span></p>',
      'backgroundColor', '#ffffff')),
  (2, 1, 'image', 760, 20, 360, 130, 2, JSON_OBJECT(
      'url', '/uploads/sample-banner-0001.png', 'alt', 'Sample banner', 'fit', 'cover')),
  (3, 2, 'chart', 20, 20, 530, 300, 1, JSON_OBJECT(
      'chartType', 'bar', 'title', 'Revenue by month (USD k)', 'source', 'manual', 'dataset', 'sales', 'points', 6,
      'refreshSeconds', 0,
      'labels', JSON_ARRAY('Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'),
      'series', JSON_ARRAY(
        JSON_OBJECT('label', '2025', 'color', '#4f46e5', 'data', JSON_ARRAY(42, 51, 47, 60, 66, 72)),
        JSON_OBJECT('label', '2024', 'color', '#a5b4fc', 'data', JSON_ARRAY(35, 40, 44, 48, 52, 55))))),
  (4, 3, 'chart', 20, 20, 530, 300, 1, JSON_OBJECT(
      'chartType', 'line', 'title', 'Visitors (generated dynamically by the API)', 'source', 'dynamic', 'dataset', 'traffic', 'points', 12,
      'refreshSeconds', 10,
      'labels', JSON_ARRAY(),
      'series', JSON_ARRAY(JSON_OBJECT('label', 'Visitors', 'color', '#0ea5e9', 'data', JSON_ARRAY())))),
  (5, 4, 'text', 20, 20, 1120, 110, 1, JSON_OBJECT(
      'html', '<p><span style="font-size:18px"><b>Next steps</b></span></p><ul><li>Expand into two new regions</li><li><i>Review pricing</i> for the enterprise tier</li></ul>',
      'backgroundColor', '#fffdf5'));
