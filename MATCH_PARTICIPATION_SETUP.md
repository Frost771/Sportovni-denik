# Role a účasti na utkáních

Před nasazením této verze spusť v Supabase → SQL Editor soubor `match_participation_migration.sql`. Přidává tři nepovinné sloupce; nemění ani nemaže stávající záznamy, minuty nebo oprávnění. Poté nasaď web z této větve.

- Role na utkání: jednička, dvojka, trojka, kustod. Původní role brankář / hráč v poli zůstává samostatná.
- Tým a soutěž jsou nepovinná textová pole.
- Účast je každý evidovaný zápas, včetně lavičky a kustoda. Bilance a body popisují výsledky týmu při těchto účastech.
- Odehraný zápas vyžaduje více než 0 minut. Odchytaný start navíc vyžaduje roli brankáře. I střídající dvojka s 12 minutami má jeden odchytaný start.
- Lavička znamená 0 minut a roli jinou než kustod. Kustod má 0 minut a vykazuje se samostatně.
- Neznámé minuty ve starších datech zůstávají neznámé; nejsou automaticky převáděny na start ani lavičku.
- Čistá konta a průměr inkasovaných zahrnují jen odchytané starty. Chybějící inkasované se nepovažují za nulu. Hodnocení se průměruje jen z odehraných zápasů.
- Při 0 minutách jsou hodnocení a inkasované nepovinné; nové záznamy mají inkasované prázdné.

CSV má původní sloupce a navíc `role_na_utkani`, `tym`, `soutez` na konci. Starší CSV se importuje bez nových polí. UUID, minuty (včetně 0), poznámky a sezóny zůstávají zachované. Existující UUID import nadále přeskakuje. Původní zálohy CSV si ponech.

Ověření: `node --test individual.test.mjs kit.test.mjs match-participation.test.mjs`.

Testy používají místní vzorky a nezasahují do osobních dat v Supabase. Přihlášení, SQL migraci a uložení do živé databáze je nutné ověřit po migraci; tato prostředí nejsou součástí místních testů.
