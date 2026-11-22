---
name: suivi-positions
description: This skill should be used when the user asks to see Google rankings from Monitorank, e.g. "mes positions", "où en est depannage-traceur-lyon.fr sur Google", "rapport de positions", "quels mots-clés ont bougé", "évolution de mes positions cette semaine / ce mois", "suis-je dans le top 3 sur traceur GPS Lyon", "check my rankings", or wants a Monitorank ranking report for a site.
---

# Suivi des positions Google (Monitorank)

Produire un état clair et actionnable des positions Google d'un site à partir des outils MCP `monitorank_*`. Site par défaut de l'utilisatrice : **depannage-traceur-lyon.fr** (utiliser `default_site` renvoyé par `monitorank_status` s'il diffère).

## Étapes

1. **Vérifier la connexion** : appeler `monitorank_status`.
   - Si `api_key_configured` est faux : demander la clé API (Monitorank > menu **API**), puis appeler `monitorank_set_api_key` avec `default_site: "depannage-traceur-lyon.fr"`. Ne jamais répéter la clé dans la réponse.
2. **Fixer la période** demandée (défaut : 30 derniers jours, `last_30`). Pour une évolution, prévoir aussi la période précédente de même longueur (ex. `last_30` vs les 30 jours d'avant, en dates `AAAA-MM-JJ..AAAA-MM-JJ`).
3. **Récupérer les positions** : `monitorank_site_positions` (avec `url` ou rien pour le site par défaut). Si l'utilisatrice parle d'un groupe de mots-clés, trouver l'`id_group` avec `monitorank_list_projects` puis `monitorank_list_groups`.
4. **Contexte** : appeler `monitorank_google_updates` et repérer les mises à jour Google tombées dans la période. Appeler `seo_journal_list` pour le site et la période, afin de relier les mouvements aux modifications SEO notées.
5. **Pour un mot-clé précis** (« pourquoi j'ai perdu sur X ? ») : trouver son `id_query` via `monitorank_list_keywords`, puis `monitorank_keyword_history` pour la courbe jour par jour et la position des concurrents suivis sur ce mot-clé.

## Lire les données

- Le format exact de `data` n'est pas documenté par Monitorank : inspecter la première réponse pour identifier les champs (mot-clé, position, évolution, URL positionnée, `type_rank`…) avant d'analyser. Ne pas inventer de champs.
- `type_rank` indique le type de résultat (`type_1` naturel, `type_7` pack local, `type_8` position zéro, `type_17`–`type_20` AI Overview…). Pour un dépanneur local à Lyon, le **pack local (Google Maps)** compte autant que les résultats naturels : le signaler séparément.
- Position absente = hors du top suivi (50 ou 100), pas « position 0 ».
- Repérer les **changements d'URL positionnée** sur un même mot-clé (cannibalisation entre deux pages du site).

## Format du rapport

Rédiger en français, concis :

1. **En bref** : 2–3 phrases (tendance générale, nombre de mots-clés en top 3 / top 10, ce qui mérite attention).
2. **Tableau des mots-clés** : mot-clé · position actuelle · évolution sur la période · URL positionnée. Trier par importance (volume si disponible, sinon position).
3. **Hausses et baisses notables** (≥ 3 places ou entrée/sortie du top 10).
4. **Contexte** : updates Google et modifications du journal tombées dans la période.
5. **Pistes** : 1 à 3 actions concrètes (ex. mot-clé en position 4–10 = page à renforcer en priorité).

Pour plus de 15 mots-clés ou un suivi à garder, proposer un tableau ou un tableau de bord plutôt qu'une longue réponse.

## Garde-fous

- Le plugin est en lecture seule : pour ajouter des mots-clés ou des concurrents, renvoyer vers l'interface Monitorank.
- `monitorank_ai_overview` coûte 1 unité par mot-clé : ne l'appeler que sur demande explicite ou après accord.
- Limite de 300 appels par minute : éviter les boucles d'appels `monitorank_keyword_history` sur des dizaines de mots-clés ; préférer `monitorank_site_positions`.
