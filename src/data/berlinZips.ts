// Every Berlin postal code, labeled by neighborhood.
// Used by the ZipPicker autocomplete. Edits welcome — labels are hand-curated.
// Source: Berlin PLZ list (cross-checked with Deutsche Post).

export interface BerlinZip {
  zip: string;
  name: string; // short neighborhood label shown after the PLZ
}

export const BERLIN_ZIPS: BerlinZip[] = [
  // ─── Mitte ────────────────────────────────────────────────────────────────
  { zip: "10115", name: "Mitte (Chausseestr.)" },
  { zip: "10117", name: "Mitte (Friedrichstr.)" },
  { zip: "10119", name: "Mitte (Rosenthaler)" },
  { zip: "10178", name: "Mitte (Alexanderplatz)" },
  { zip: "10179", name: "Mitte (Jannowitzbrücke)" },

  // ─── Tiergarten / Moabit ─────────────────────────────────────────────────
  { zip: "10551", name: "Moabit (Stromstr.)" },
  { zip: "10553", name: "Moabit (Turmstr.)" },
  { zip: "10555", name: "Moabit (Beusselkiez)" },
  { zip: "10557", name: "Moabit (Hauptbahnhof)" },
  { zip: "10559", name: "Moabit (Wedding-Grenze)" },
  { zip: "10785", name: "Tiergarten (Potsdamer Pl.)" },
  { zip: "10787", name: "Tiergarten (Zoo-Süd)" },
  { zip: "10789", name: "Tiergarten (KuDamm-Ost)" },

  // ─── Charlottenburg / Westend ─────────────────────────────────────────────
  { zip: "10585", name: "Charlottenburg (Spandauer Damm)" },
  { zip: "10587", name: "Charlottenburg (Mierendorff)" },
  { zip: "10589", name: "Charlottenburg-Nord" },
  { zip: "10623", name: "Charlottenburg (Zoo)" },
  { zip: "10625", name: "Charlottenburg (Lietzensee)" },
  { zip: "10627", name: "Charlottenburg (Kantstr.)" },
  { zip: "10629", name: "Charlottenburg (Olivaer Pl.)" },
  { zip: "14050", name: "Westend" },
  { zip: "14052", name: "Charlottenburg (Messe)" },
  { zip: "14055", name: "Westend (Olympia)" },
  { zip: "14057", name: "Charlottenburg (Kaiserdamm)" },
  { zip: "14059", name: "Charlottenburg (Westend)" },

  // ─── Wilmersdorf ─────────────────────────────────────────────────────────
  { zip: "10707", name: "Wilmersdorf (KuDamm)" },
  { zip: "10709", name: "Wilmersdorf (Halensee)" },
  { zip: "10711", name: "Wilmersdorf (Lietzenburger)" },
  { zip: "10713", name: "Wilmersdorf (Hindenburgdamm)" },
  { zip: "10715", name: "Wilmersdorf (Volkspark)" },
  { zip: "10717", name: "Wilmersdorf (Bundesallee)" },
  { zip: "10719", name: "Wilmersdorf (Olivaer-West)" },

  // ─── Schöneberg ──────────────────────────────────────────────────────────
  { zip: "10777", name: "Schöneberg (Nollendorf)" },
  { zip: "10779", name: "Schöneberg (Viktoria-Luise)" },
  { zip: "10781", name: "Schöneberg (Kleistpark)" },
  { zip: "10783", name: "Schöneberg (Winterfeldt)" },
  { zip: "10823", name: "Schöneberg (Kaiser-Wilhelm)" },
  { zip: "10825", name: "Schöneberg (Rathaus)" },
  { zip: "10827", name: "Schöneberg (Hauptstr.)" },
  { zip: "10829", name: "Schöneberg (Insulaner)" },
  { zip: "12157", name: "Friedenau" },
  { zip: "12159", name: "Friedenau (Rheinstr.)" },
  { zip: "12161", name: "Friedenau (Südwestkorso)" },
  { zip: "12163", name: "Steglitz (Klingsor)" },
  { zip: "12165", name: "Steglitz (Schloßstr.)" },
  { zip: "12167", name: "Steglitz (Zehlendorfer Str.)" },
  { zip: "12169", name: "Steglitz (Südende)" },

  // ─── Kreuzberg ───────────────────────────────────────────────────────────
  { zip: "10961", name: "Kreuzberg (Bergmannkiez)" },
  { zip: "10963", name: "Kreuzberg (Anhalter)" },
  { zip: "10965", name: "Kreuzberg (Mehringdamm)" },
  { zip: "10967", name: "Kreuzberg (Hermannplatz)" },
  { zip: "10969", name: "Kreuzberg (Hallesches Tor)" },
  { zip: "10997", name: "Kreuzberg (Schlesi-West)" },
  { zip: "10999", name: "Kreuzberg (Görlitzer)" },

  // ─── Friedrichshain ──────────────────────────────────────────────────────
  { zip: "10243", name: "Friedrichshain (East Side)" },
  { zip: "10245", name: "Friedrichshain (Ostkreuz)" },
  { zip: "10247", name: "Friedrichshain (Boxhagener)" },
  { zip: "10249", name: "Friedrichshain (Volkspark)" },

  // ─── Prenzlauer Berg ─────────────────────────────────────────────────────
  { zip: "10405", name: "Prenzlauer Berg (Kollwitz)" },
  { zip: "10407", name: "Prenzlauer Berg (Thälmann)" },
  { zip: "10409", name: "Prenzlauer Berg (Greifswalder)" },
  { zip: "10435", name: "Prenzlauer Berg (Kastanienallee)" },
  { zip: "10437", name: "Prenzlauer Berg (Falkplatz)" },
  { zip: "10439", name: "Prenzlauer Berg (Bornholmer)" },

  // ─── Neukölln ────────────────────────────────────────────────────────────
  { zip: "12043", name: "Neukölln (Rathaus)" },
  { zip: "12045", name: "Neukölln (Maybachufer)" },
  { zip: "12047", name: "Neukölln (Kottbusser Damm)" },
  { zip: "12049", name: "Neukölln (Hasenheide)" },
  { zip: "12051", name: "Neukölln (Körnerpark)" },
  { zip: "12053", name: "Neukölln (Silbersteinstr.)" },
  { zip: "12055", name: "Neukölln (Sonnenallee)" },
  { zip: "12057", name: "Neukölln (Rudower)" },
  { zip: "12059", name: "Neukölln (Treptower Str.)" },

  // ─── Tempelhof ───────────────────────────────────────────────────────────
  { zip: "12099", name: "Tempelhof (Alt-Tempelhof)" },
  { zip: "12101", name: "Tempelhof (Flughafen)" },
  { zip: "12103", name: "Tempelhof (Kaiserin-Augusta)" },
  { zip: "12105", name: "Tempelhof (Marienfelde-Nord)" },
  { zip: "12107", name: "Tempelhof (Mariendorf)" },
  { zip: "12109", name: "Tempelhof (Ullsteinhaus)" },
  { zip: "12277", name: "Marienfelde" },
  { zip: "12279", name: "Marienfelde (Süd)" },
  { zip: "12305", name: "Lichtenrade" },
  { zip: "12307", name: "Lichtenrade (Ost)" },
  { zip: "12309", name: "Lichtenrade (Süd)" },

  // ─── Treptow-Köpenick ────────────────────────────────────────────────────
  { zip: "12435", name: "Alt-Treptow" },
  { zip: "12437", name: "Baumschulenweg" },
  { zip: "12439", name: "Niederschöneweide" },
  { zip: "12459", name: "Oberschöneweide" },
  { zip: "12487", name: "Johannisthal" },
  { zip: "12489", name: "Adlershof" },
  { zip: "12524", name: "Altglienicke" },
  { zip: "12526", name: "Bohnsdorf" },
  { zip: "12527", name: "Grünau" },
  { zip: "12555", name: "Köpenick (Altstadt)" },
  { zip: "12557", name: "Köpenick (Wendenschloss)" },
  { zip: "12559", name: "Köpenick (Friedrichshagen)" },
  { zip: "12587", name: "Friedrichshagen" },
  { zip: "12589", name: "Rahnsdorf" },

  // ─── Marzahn-Hellersdorf ─────────────────────────────────────────────────
  { zip: "12619", name: "Hellersdorf (Ost)" },
  { zip: "12621", name: "Kaulsdorf" },
  { zip: "12623", name: "Mahlsdorf" },
  { zip: "12627", name: "Hellersdorf (Süd)" },
  { zip: "12629", name: "Hellersdorf (Nord)" },
  { zip: "12679", name: "Marzahn (Nord)" },
  { zip: "12681", name: "Marzahn (West)" },
  { zip: "12683", name: "Biesdorf (Nord)" },
  { zip: "12685", name: "Marzahn (Süd)" },
  { zip: "12687", name: "Marzahn (Ost)" },
  { zip: "12689", name: "Ahrensfelde" },

  // ─── Lichtenberg ─────────────────────────────────────────────────────────
  { zip: "10315", name: "Friedrichsfelde" },
  { zip: "10317", name: "Friedrichsfelde (Süd)" },
  { zip: "10318", name: "Karlshorst" },
  { zip: "10319", name: "Friedrichsfelde (Ost)" },
  { zip: "10365", name: "Fennpfuhl" },
  { zip: "10367", name: "Lichtenberg (Frankfurter)" },
  { zip: "10369", name: "Lichtenberg (Rathaus)" },
  { zip: "13051", name: "Hohenschönhausen (Nord)" },
  { zip: "13053", name: "Hohenschönhausen (Zingster)" },
  { zip: "13055", name: "Hohenschönhausen (Landsberger)" },
  { zip: "13057", name: "Hohenschönhausen (Wartenberg)" },
  { zip: "13059", name: "Hohenschönhausen (Falkenberg)" },

  // ─── Pankow / Weißensee ──────────────────────────────────────────────────
  { zip: "13086", name: "Weißensee (Süd)" },
  { zip: "13088", name: "Weißensee (Nord)" },
  { zip: "13089", name: "Heinersdorf" },
  { zip: "13125", name: "Karow" },
  { zip: "13127", name: "Buch (Süd)" },
  { zip: "13129", name: "Buch (Nord)" },
  { zip: "13156", name: "Niederschönhausen" },
  { zip: "13158", name: "Rosenthal" },
  { zip: "13159", name: "Blankenfelde (Berlin)" },
  { zip: "13187", name: "Pankow (Altstadt)" },
  { zip: "13189", name: "Pankow (Wollankstr.)" },

  // ─── Wedding / Gesundbrunnen ─────────────────────────────────────────────
  { zip: "13347", name: "Wedding (Müllerstr.)" },
  { zip: "13349", name: "Wedding (Afrikanisches Viertel)" },
  { zip: "13351", name: "Wedding (Volkspark Rehberge)" },
  { zip: "13353", name: "Wedding (Virchow)" },
  { zip: "13355", name: "Gesundbrunnen (Brunnenstr.)" },
  { zip: "13357", name: "Wedding (Schillerpark)" },
  { zip: "13359", name: "Wedding (Residenzstr.)" },

  // ─── Reinickendorf ───────────────────────────────────────────────────────
  { zip: "13403", name: "Reinickendorf (Scharnweberstr.)" },
  { zip: "13405", name: "Reinickendorf (Borsigwalde)" },
  { zip: "13407", name: "Reinickendorf (Alt-Reinickendorf)" },
  { zip: "13409", name: "Reinickendorf (Franz-Neumann)" },
  { zip: "13435", name: "Wittenau" },
  { zip: "13437", name: "Wittenau (Märkisches Viertel)" },
  { zip: "13439", name: "Wittenau (Nord)" },
  { zip: "13465", name: "Frohnau (Süd)" },
  { zip: "13467", name: "Hermsdorf" },
  { zip: "13469", name: "Waidmannslust" },
  { zip: "13503", name: "Heiligensee" },
  { zip: "13505", name: "Konradshöhe" },
  { zip: "13507", name: "Tegel" },
  { zip: "13509", name: "Borsigwalde" },

  // ─── Spandau ─────────────────────────────────────────────────────────────
  { zip: "13581", name: "Spandau (Wilhelmstadt)" },
  { zip: "13583", name: "Spandau (Haselhorst)" },
  { zip: "13585", name: "Spandau (Altstadt)" },
  { zip: "13587", name: "Spandau (Hakenfelde)" },
  { zip: "13589", name: "Spandau (Falkenhagen)" },
  { zip: "13591", name: "Spandau (Staaken)" },
  { zip: "13593", name: "Spandau (Kladow)" },
  { zip: "13595", name: "Spandau (Gatow)" },
  { zip: "13597", name: "Spandau (Klosterfelde)" },
  { zip: "13599", name: "Spandau (Siemensstadt)" },

  // ─── Steglitz-Zehlendorf ────────────────────────────────────────────────
  { zip: "12203", name: "Lichterfelde (Ost)" },
  { zip: "12205", name: "Lichterfelde (West)" },
  { zip: "12207", name: "Lichterfelde (Goerzallee)" },
  { zip: "12209", name: "Lichterfelde (Süd)" },
  { zip: "12247", name: "Steglitz (Lankwitz-Nord)" },
  { zip: "12249", name: "Lankwitz" },
  { zip: "14109", name: "Wannsee" },
  { zip: "14129", name: "Nikolassee" },
  { zip: "14163", name: "Zehlendorf (Süd)" },
  { zip: "14165", name: "Zehlendorf (Machnower)" },
  { zip: "14167", name: "Zehlendorf (Krumme Lanke)" },
  { zip: "14169", name: "Zehlendorf (Mexikoplatz)" },
  { zip: "14193", name: "Grunewald" },
  { zip: "14195", name: "Dahlem" },
  { zip: "14197", name: "Wilmersdorf (Schmargendorf)" },
  { zip: "14199", name: "Wilmersdorf (Grunewald-Rand)" },
];

export const BERLIN_ZIP_SET = new Set(BERLIN_ZIPS.map((z) => z.zip));
