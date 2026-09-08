# Výstroj na zápas
Před nasazením spusťte kit_migration.sql v SQL editoru svého projektu Supabase. Migrace přidá tři nepovinné sloupce; staré záznamy zůstanou bez výstroje. Poté nasaďte změny aplikace.

Fotbalový zápas za brankáře nabízí dres, trenky a štulpny. Florbalový zápas nabízí pouze dres. U tréninků a fotbalových zápasů v poli se výstroj neukládá. Neuvedeno zůstává prázdná hodnota.

CSV záloha obsahuje navíc dres_barva, trenky_barva a stulpny_barva se stabilními kódy black/yellow/red/blue. Import starých CSV funguje bez těchto sloupců. Kompatibilitu nových CSV s externím původním Pythonovým programem je nutné ověřit zvlášť.

Statistiky výstroje respektují sport a sezónu. Čisté konto zde vyžaduje alespoň jednu odehranou minutu a nula inkasovaných gólů. Nevyplněná výstroj se zobrazuje samostatně. Pojmenované sety a statistiky celých kombinací lze doplnit nad třemi uloženými barvami.

Ověření: node kit.test.mjs a node --check pro změněné JavaScriptové soubory. Testy používají simulovaný formulář, nepřipojují se k databázi.
