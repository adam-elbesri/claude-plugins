# Plugin Monitorank

Suivre les positions Google de **depannage-traceur-lyon.fr** (ou d'un autre site) depuis Claude, via l'API Monitorank, et mesurer l'effet de chaque modification SEO.

## Ce que fait le plugin

- **Connecteur Monitorank (lecture seule)** : projets, sites, positions par période, historique jour par jour d'un mot-clé, statistiques, groupes, filtres, AI Overviews, mises à jour Google, ressources du compte. Aucune création ni suppression possible depuis Claude.
- **Journal SEO local** : chaque modification (title, contenu, maillage, nouvelle page…) est notée avec sa date, pour comparer les positions avant/après.
- **Compétences** :
  - `suivi-positions` : « montre-moi mes positions du mois », « quels mots-clés ont bougé ? »
  - `effet-seo` : « j'ai changé le title de la page d'accueil le 3 novembre », « est-ce que ça a marché ? »

## Installation

1. Installer le plugin (bouton dans la conversation).
2. Node.js 18 ou plus récent doit être installé sur l'ordinateur (`node --version`).
3. Récupérer la clé API dans Monitorank, menu **API**.
4. Dans une conversation, dire : « Configure Monitorank avec ma clé : … ». Claude l'enregistre dans `~/.monitorank-mcp/config.json` (fichier privé, lisible uniquement par votre compte).
   - Alternative : définir la variable d'environnement `MONITORANK_API_KEY`.

## Données locales

| Fichier | Contenu |
|---|---|
| `~/.monitorank-mcp/config.json` | clé API, site par défaut |
| `~/.monitorank-mcp/journal.json` | journal des modifications SEO (par défaut, en local) |
| `<projet>/.monitorank/journal.json` | journal versionné avec le dépôt (voir ci-dessous) |

La clé API n'est **jamais** écrite dans le projet.

## Journal dans le dépôt (Claude Code cloud)

Les sessions cloud sont éphémères : un journal dans `~` serait perdu. Le journal est donc écrit dans
`<projet>/.monitorank/journal.json` (à committer) quand :

- on tourne dans Claude Code cloud (`CLAUDE_CODE_REMOTE=true`), ou
- ce fichier existe déjà dans le projet, ou
- `MONITORANK_JOURNAL_IN_PROJECT=1`.

`MONITORANK_JOURNAL_FILE=<chemin>` force un emplacement précis. `monitorank_status` indique le fichier utilisé.

En cloud, définir `MONITORANK_API_KEY` dans les variables d'environnement de l'environnement cloud.

## Limites

- API Monitorank : 300 appels par minute maximum ; `aio/get` coûte 1 unité par mot-clé.
- Les méthodes d'écriture (créer des mots-clés, sites, audits) ne sont volontairement pas exposées : les faire dans l'interface Monitorank.
