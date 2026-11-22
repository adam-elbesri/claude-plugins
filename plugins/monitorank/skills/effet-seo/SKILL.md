---
name: effet-seo
description: This skill should be used when the user wants to log an SEO change or measure its impact on Google rankings, e.g. "j'ai changé le title de la page d'accueil", "note que j'ai publié une nouvelle page", "est-ce que ma modification a marché", "effet de mes changements SEO", "avant / après", "quel impact a eu ma refonte", "did my SEO change work", or asks to review the SEO change journal for depannage-traceur-lyon.fr.
---

# Mesurer l'effet des choix SEO

Deux usages : **noter** une modification SEO dans le journal local, et **mesurer** son effet sur les positions Monitorank. Site par défaut : **depannage-traceur-lyon.fr**.

## A. Noter une modification

Dès que l'utilisatrice décrit un changement fait (ou prévu à une date précise) sur son site :

1. Extraire : date de mise en ligne (demander si absente — c'est indispensable), page concernée, type (title/meta, contenu, maillage interne, nouvelle page, technique, netlinking, fiche Google Business, autre), description courte, mots-clés visés.
2. Appeler `seo_journal_add`. Confirmer en une ligne et indiquer quand une première mesure aura du sens (en général 2 semaines après la mise en ligne).

## B. Mesurer l'effet d'une modification

1. Retrouver l'entrée avec `seo_journal_list` (ou la créer si elle n'y est pas).
2. Calculer les périodes avec `seo_periods_around` (`days` 14 par défaut ; 28 pour une refonte, du netlinking ou une nouvelle page, qui agissent plus lentement). Si `after_days_available` < 7, dire qu'il est trop tôt et donner une date de revue.
3. Appeler `monitorank_site_positions` sur la période **avant** puis **après**.
4. Pour les mots-clés visés, appeler `monitorank_keyword_history` sur toute la fenêtre (début de « avant » → fin de « après ») pour voir la courbe et le comportement des concurrents suivis.
5. Appeler `monitorank_google_updates` et vérifier si une mise à jour Google tombe dans la fenêtre.
6. Vérifier dans `seo_journal_list` les **autres modifications** dans la même fenêtre : elles brouillent l'attribution.

Suivre la méthode détaillée de `references/methode-avant-apres.md` pour interpréter.

## Format de la réponse

1. **Verdict** en une phrase avec un niveau de confiance : *effet positif probable*, *effet négatif probable*, *pas d'effet visible*, ou *impossible à attribuer* (et pourquoi).
2. **Tableau** : mot-clé · position moyenne avant · position moyenne après · écart · URL positionnée (signaler si elle a changé).
3. **Mots-clés visés vs. le reste du site** : si tout le site a bougé pareil, l'effet vient probablement d'ailleurs.
4. **Facteurs de confusion** : update Google, autres changements, concurrents qui bougent aussi.
5. **Suite** : garder, ajuster, ou revoir à une date donnée.

Pour un bilan de toutes les modifications du journal, faire une ligne par modification (date · changement · verdict · confiance) puis les enseignements : quels types de changements fonctionnent sur ce site.

## Garde-fous

- Ne jamais conclure à partir de quelques jours ou d'un écart de 1–2 places : c'est dans le bruit normal.
- Ne pas présenter une corrélation comme une preuve ; parler de « probable ».
- Le journal est local à l'ordinateur de l'utilisatrice (dossier `~/.monitorank-mcp`).
