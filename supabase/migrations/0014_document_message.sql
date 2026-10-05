-- D112 — le message de motivation court devient un type de document.
--
-- Beaucoup de plateformes ne demandent pas une lettre mais un champ de texte
-- plafonné. Un message n'est pas une lettre raccourcie : ni formule d'appel,
-- ni formule de politesse, ni signature. C'est donc un document à part, et
-- non une variante stockée dans un coin du JSON de la lettre.
--
-- Il porte DEUX longueurs dans sa `selection` — une courte pour les champs
-- serrés, une moyenne pour les formulaires normaux — afin qu'aucune limite de
-- site n'oblige à régénérer, et donc à repayer.
--
-- `alter type ... add value` ne peut pas s'exécuter dans une transaction avec
-- d'autres instructions sur certaines versions de PostgreSQL : cette migration
-- ne contient donc que cette ligne.

alter type type_document add value if not exists 'message';
