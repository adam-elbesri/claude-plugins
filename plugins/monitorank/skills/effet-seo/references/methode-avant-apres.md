# Méthode avant / après pour juger une modification SEO

## Délais typiques avant effet

| Type de modification | Premier effet visible | Fenêtre de mesure conseillée |
|---|---|---|
| Title / meta description | 3–10 jours (après recrawl) | 14 jours avant / 14 jours après |
| Contenu enrichi d'une page existante | 1–3 semaines | 14 / 28 |
| Maillage interne | 1–3 semaines | 14 / 28 |
| Nouvelle page | 2–6 semaines | 28 / 28 (comparer à « absent ») |
| Technique (vitesse, indexation, redirections) | variable, parfois immédiat | 14 / 28 |
| Netlinking | 3–8 semaines | 28 / 28+ |
| Fiche Google Business Profile | quelques jours, surtout le pack local | 14 / 14, regarder `type_7` |

Exclure 2–3 jours de transition après la mise en ligne (`gap` de `seo_periods_around`).

## Lecture des écarts

- Comparer des **positions moyennes** sur la période, pas un jour isolé : les positions oscillent de ±1–3 places au quotidien.
- Écart significatif : ≥ 3 places en moyenne, ou entrée/sortie du top 3 / top 10, et tendance stable sur la courbe `monitorank_keyword_history` (pas un pic isolé).
- **Groupe témoin** : comparer les mots-clés visés au reste des mots-clés du site. Si les deux bougent dans le même sens et la même ampleur, l'effet est global (update Google, saisonnalité, problème technique), pas dû à la modification.
- **Concurrents** : si les concurrents suivis chutent ou montent sur le même mot-clé au même moment, c'est le SERP qui a changé.
- **URL positionnée** : si l'URL qui se classe change après la modification, vérifier la cannibalisation (deux pages du site sur la même intention).
- **Type de résultat** : pour une activité locale (dépannage à Lyon), distinguer résultat naturel (`type_1`) et pack local (`type_7`) ; une fiche Google Business agit surtout sur le second.

## Niveaux de confiance

- **Élevée** : écart net sur les mots-clés visés, groupe témoin stable, pas d'update Google ni d'autre modification dans la fenêtre.
- **Moyenne** : écart net mais un facteur de confusion mineur (petit update, autre modification sur une autre page).
- **Faible / impossible à attribuer** : update Google majeur dans la fenêtre, plusieurs modifications simultanées sur les mêmes pages, ou moins de 7 jours de recul.
