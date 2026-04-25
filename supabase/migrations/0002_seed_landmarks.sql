-- Seed data — family-friendly landmarks in 4 Berlin neighborhoods.
-- Coordinates are approximate (hand-curated); good enough for map pins.
-- Some landmarks technically fall in adjacent ZIPs but are assigned to the
-- nearest of our 4 target neighborhoods for app-level discovery.

insert into public.landmarks (name, zip, category, emoji, lat, lng) values

-- ═══ 10435 — Prenzlauer Berg ═══════════════════════════════════════════════
  ('Kollwitzplatz',                   '10435', 'playground',  '🛝', 52.5361, 13.4158),
  ('Wasserturm Prenzlauer Berg',      '10435', 'playground',  '🛝', 52.5315, 13.4154),
  ('Helmholtzplatz',                  '10435', 'playground',  '🛝', 52.5420, 13.4113),
  ('Mauerpark',                       '10435', 'park',        '🌳', 52.5413, 13.4015),
  ('Arnimplatz',                      '10435', 'playground',  '🛝', 52.5480, 13.4244),
  ('Teutoburger Platz',               '10435', 'playground',  '🛝', 52.5345, 13.4081),
  ('Ernst-Thälmann-Park',             '10435', 'park',        '🌳', 52.5454, 13.4306),
  ('Spielplatz Husemannstraße',       '10435', 'playground',  '🛝', 52.5367, 13.4148),
  ('Spielplatz Winsstraße',           '10435', 'playground',  '🛝', 52.5365, 13.4265),
  ('Kinderbibliothek Pankow',         '10435', 'library',     '📚', 52.5446, 13.4180),

-- ═══ 10997 — Kreuzberg ═════════════════════════════════════════════════════
  ('Görlitzer Park',                  '10997', 'park',        '🌳', 52.4991, 13.4401),
  ('Paul-Lincke-Ufer Spielplatz',     '10997', 'playground',  '🛝', 52.4969, 13.4267),
  ('Spielplatz Reichenberger Str.',   '10997', 'playground',  '🛝', 52.4988, 13.4360),
  ('Böcklerpark',                     '10997', 'park',        '🌳', 52.4985, 13.4139),
  ('Spielplatz Lausitzer Platz',      '10997', 'playground',  '🛝', 52.5007, 13.4356),
  ('Spielplatz Wrangelstraße',        '10997', 'playground',  '🛝', 52.4996, 13.4411),
  ('Prinzessinnengarten',             '10997', 'park',        '🌻', 52.5031, 13.4117),
  ('Viktoriapark',                    '10997', 'park',        '🌳', 52.4890, 13.3795),
  ('Spielplatz Forster Straße',       '10997', 'playground',  '🛝', 52.4979, 13.4295),
  ('Wasserspielplatz Plänterwald',    '10997', 'splash_pad',  '💦', 52.4812, 13.4708),

-- ═══ 10245 — Friedrichshain ════════════════════════════════════════════════
  ('Volkspark Friedrichshain',        '10245', 'park',        '🌳', 52.5280, 13.4321),
  ('Boxhagener Platz',                '10245', 'playground',  '🛝', 52.5125, 13.4610),
  ('Traveplatz',                      '10245', 'playground',  '🛝', 52.5105, 13.4651),
  ('Forckenbeckplatz',                '10245', 'playground',  '🛝', 52.5127, 13.4544),
  ('Spielplatz Rudolfplatz',          '10245', 'playground',  '🛝', 52.5096, 13.4621),
  ('Ostpark',                         '10245', 'park',        '🌳', 52.5188, 13.4731),
  ('Modersohnpark',                   '10245', 'park',        '🌳', 52.5094, 13.4713),
  ('Comeniusplatz',                   '10245', 'playground',  '🛝', 52.5135, 13.4530),
  ('Märchenbrunnen (im Volkspark)',   '10245', 'park',        '⛲', 52.5294, 13.4349),
  ('Indoor-Spielplatz Jacks Fun',     '10245', 'indoor_play', '🎪', 52.5045, 13.4739),

-- ═══ 10178 — Mitte ═════════════════════════════════════════════════════════
  ('Monbijoupark',                    '10178', 'park',        '🌳', 52.5225, 13.3983),
  ('James-Simon-Park',                '10178', 'park',        '🌳', 52.5204, 13.4017),
  ('Weinbergspark',                   '10178', 'park',        '🌳', 52.5315, 13.4014),
  ('Zionskirchplatz',                 '10178', 'playground',  '🛝', 52.5353, 13.4028),
  ('Köllnischer Park',                '10178', 'park',        '🌳', 52.5154, 13.4186),
  ('Spielplatz Rosa-Luxemburg-Platz', '10178', 'playground',  '🛝', 52.5280, 13.4103),
  ('Hackescher Markt Spielplatz',     '10178', 'playground',  '🛝', 52.5229, 13.4025),
  ('Spielplatz Gartenstraße',         '10178', 'playground',  '🛝', 52.5330, 13.3855),
  ('Humboldthain (Süd)',              '10178', 'park',        '🌳', 52.5459, 13.3827),
  ('Stadtbibliothek am Luisenbad',    '10178', 'library',     '📚', 52.5472, 13.3768);
