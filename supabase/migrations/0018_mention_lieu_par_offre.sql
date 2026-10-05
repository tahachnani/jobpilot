-- D122 : la mention de mobilité imprimée à côté de la localisation du CV.
--
-- Vide par défaut, et vide veut dire « déduis-la du périmètre » : rien en
-- Île-de-France, « mobile Lyon » pour une ville de mobilité déclarée, rien
-- ailleurs. Remplie, elle remplace la déduction — « installation prévue à Lyon
-- en janvier » dit plus qu'un « mobile Lyon ».
alter table offres add column if not exists mention_lieu text;

-- La localisation du profil passe de la région à la commune : les analyseurs
-- de CV cherchent une commune et un département, pas une région.
update profil
   set localisation = 'Saint-Denis (93)'
 where localisation = 'Île-de-France, France';

-- Barème version 17 : cinquième critère, le lieu, pris proportionnellement sur
-- les quatre autres.
--   cdg    missions 27 · compétences 23 · expérience 31 · secteur 9 · lieu 10
--   compta missions 27 · compétences 27 · expérience 27 · secteur 9 · lieu 10
update parametres
   set valeur = jsonb_build_object(
     'version', '17',
     'plafond_ecart_bloquant', 79,
     'neutre_experience_non_precisee', 75,
     'cdg',    jsonb_build_object('missions', 27, 'competences', 23, 'experience', 31, 'secteur', 9, 'lieu', 10),
     'compta', jsonb_build_object('missions', 27, 'competences', 27, 'experience', 27, 'secteur', 9, 'lieu', 10)
   )
 where cle = 'bareme';
