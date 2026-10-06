# Individuál

Před nasazením změn spusť v SQL editoru svého projektu Supabase soubor `individual_migration.sql`. Přidá sloupec `is_individual boolean not null default false`; dosavadní záznamy zůstanou neoznačené.

Potom nasaď změny aplikace a obnov stránku. Přepínač je dostupný pro tréninky i zápasy, při vytváření i úpravě. Nové šablony začínají bez označení, opakování posledního záznamu jeho označení kopíruje.

Přehled a statistiky respektují vybraný sport a sezónu. Report sezóny obsahuje stejný souhrn. Celkový čas používá délku tréninku a u zápasu odehrané minuty; chybějící čas je nula. Rozpad vychází ze sportu a typu tréninku či zápasu.

CSV export má sloupec `individual` s hodnotou true/false. Import bez tohoto sloupce nastaví false; true, 1 a ano označí aktivitu.

Kontroly: `node --test kit.test.mjs individual.test.mjs`.

