# Sportovní deník – webová verze

Mobilní webová aplikace pro fotbalové a florbalové tréninky, zápasy, sezóny a statistiky.

## Co je hotové

- přihlášení e-mailem a heslem,
- soukromá data oddělená přes Supabase Row Level Security,
- fotbal a florbal,
- tréninky a zápasy,
- soutěžní a přátelské zápasy,
- role brankář / hráč v poli u fotbalu,
- prodloužení a nájezdy u florbalu,
- body, výsledky, minuty, inkasované góly, čistá konta a hodnocení,
- samostatné sezóny pro oba sporty,
- import původních `sportovni_denik.csv` a `sportovni_sezony.csv`,
- export zálohy zpět do stejného CSV formátu,
- responzivní rozhraní a PWA ikona pro iPhone.

## 1. Založení Supabase projektu

1. Na Supabase vytvoř nový projekt.
2. Otevři **SQL Editor**.
3. Vlož celý obsah `supabase_schema.sql` a spusť ho.
4. V **Authentication → Providers → Email** nech povolený e-mailový provider.
5. V **Project Settings → API** zkopíruj:
   - Project URL,
   - Publishable key nebo starší anon key.

## 2. Nastavení aplikace

Otevři `config.js` a nahraď dvě výchozí hodnoty:

```js
export const SUPABASE_URL = "https://TVUJ-PROJEKT.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "TVUJ_PUBLISHABLE_NEBO_ANON_KLIC";
```

Publishable/anon klíč může být ve webové aplikaci veřejný. Ochranu dat zajišťují RLS pravidla. Nikdy sem nedávej `service_role` klíč.

## 3. Spuštění na počítači

Kvůli JavaScriptovým modulům aplikaci neotvírej dvojklikem jako `file://`.

Ve složce spusť například:

```bash
python -m http.server 8000
```

Potom otevři:

```text
http://localhost:8000
```

## 4. Přenos dat

Po přihlášení otevři **Import / záloha** a vyber:

- `sportovni_denik.csv`
- `sportovni_sezony.csv`

Import používá původní UUID a přeskočí záznamy, které už v databázi existují.

## 5. GitHub Pages

Nahraj obsah této složky do nového veřejného repozitáře. V **Settings → Pages** nastav:

- Source: Deploy from a branch
- Branch: main
- Folder: /(root)

Samotný kód bude veřejný, ale data zůstanou v Supabase a RLS je zpřístupní jen přihlášenému uživateli.

## 6. iPhone

V Safari otevři adresu GitHub Pages a zvol:

**Sdílet → Přidat na plochu**

Aplikace se pak otevře samostatně jako webová aplikace.

## Důležité

- Původní CSV soubory si ponech jako zálohu.
- Pravidelně používej export CSV i z webové aplikace.
- Do repozitáře nikdy nevkládej `service_role` klíč ani heslo.
