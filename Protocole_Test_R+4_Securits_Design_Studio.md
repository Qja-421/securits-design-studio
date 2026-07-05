# Protocole de test — Cas pratique Immeuble R+4
## Securits Design Studio — SCI RÉSIDENCE MPITA

**Objectif :** valider l'application sur un projet complexe (11 tableaux) et confirmer que les 5 pièges sont détectés par le moteur NF C 15-100.

---

## Ordre de saisie recommandé (pour ne pas se disperser)

Ne saisis pas les 11 tableaux dans l'ordre du document. Fais-le dans cet ordre, qui te permet de valider un piège dès que le tableau concerné est fini, au lieu d'attendre la fin des 11 :

| # | Tableau | Pourquoi cet ordre |
|---|---------|---------------------|
| 1 | Appartement T2 (gardien, RDC) | Le plus simple — sert d'échauffement, 4 circuits seulement |
| 2 | Appartement T3 type (R+1, logement A) | Volontairement avec **Piège 1** (rangée sans différentiel) |
| 3 | Appartement T3 type (R+1, logement B) | Normal, sans piège — sert de témoin de non-régression |
| 4 | Appartement T3 x2 (R+2) | Identiques à T3 normal, copier/dupliquer si l'appli le permet |
| 5 | Appartement T4 type (R+3, logement A) | Volontairement avec **Piège 2** (disjoncteur 20A sur plaque de cuisson 6000W) |
| 6 | Appartement T4 (R+3, logement B) | Normal |
| 7 | Appartement T4 (R+4, logement A) | Volontairement avec **Piège 3** (60m en 1,5mm² sur un éclairage) — c'est le niveau le plus éloigné du TGBT, cohérent physiquement |
| 8 | Appartement T4 (R+4, logement B) | Normal |
| 9 | Services Généraux | Avec **Piège 4** (différentiel 25A en tête, aval > 25A) et **Piège 5** (vérifier non-régression mono/tri) |
| 10 | TGBT | En dernier — c'est lui qui agrège les 9 tableaux + services généraux, donc il doit être fait une fois tout le reste posé |

---

## Checklist de saisie par tableau

### Appartement T2 (gardien)
- [ ] Éclairage général — Disj. 10A / 800W / 1,5mm² / 12m
- [ ] Prises de courant — Disj. 16A / 3000W / 2,5mm² / 18m
- [ ] Cuisinière — Disj. 20A / 3500W / 2,5mm² / 8m
- [ ] Chauffe-eau — Disj. 20A / 2200W / 2,5mm² / 6m
- [ ] Vérifier puissance installée ≈ 9,5 kW, monophasé 230V

### Appartement T3 (x4 : R+1 A, R+1 B, R+2 A, R+2 B)
10 circuits identiques (éclairage salon/chambres, éclairage cuisine/SdB, prises salon, prises chambres, plaque de cuisson, four, chauffe-eau, lave-linge, clim salon, clim chambre 1) — puissance installée ≈ 23,4 kW.
- [ ] **Sur R+1 logement A uniquement** : place un disjoncteur divisionnaire sans différentiel en tête de rangée → **Piège 1**
- [ ] Les 3 autres T3 : saisie normale, sert de témoin

### Appartement T4 (x4 : R+3 A, R+3 B, R+4 A, R+4 B)
Structure T3 + éclairage chambres 3/4, prises chambres 3/4, clim chambre 2/3, lave-vaisselle — puissance installée ≈ 31,3 kW.
- [ ] **Sur R+3 logement A** : plaque de cuisson 6000W → assigner disjoncteur **20A** au lieu de 32A → **Piège 2**
- [ ] **Sur R+4 logement A** : un circuit éclairage avec 60m de câble en 1,5mm² → **Piège 3**
- [ ] Les 2 autres T4 : saisie normale

### Services Généraux
- [ ] Éclairage circulations (5 niveaux) — Disj. 16A / 1200W / 1,5mm² / 230V mono
- [ ] Éclairage extérieur + parking — Disj. 16A / 1500W / 2,5mm² / 230V mono
- [ ] Portail motorisé — Disj. 10A / 550W / 1,5mm² / 230V mono
- [ ] Ascenseur — Disj. 4P 32A / 5500W / 6mm² / 400V tri
- [ ] Pompe de surpression — Disj. 4P 20A / 3000W / 4mm² / 400V tri
- [ ] Prises techniques locaux — Disj. 16A / 1000W / 2,5mm² / 230V mono
- [ ] **Différentiel de tête volontairement sous-dimensionné à 25A** (l'aval ascenseur 32A + pompe 20A dépasse largement) → **Piège 4**
- [ ] Vérifier que l'ascenseur et la pompe restent traités en triphasé sans faire basculer tout le bilan du tableau en triphasé → **Piège 5** (non-régression PowerBalance.tsx)

### TGBT
- [ ] Créer les 11 départs (9 appartements + services généraux, + protection générale/parafoudre)
- [ ] Vérifier que le bilan de puissance agrège les 11 tableaux
- [ ] Puissance installée théorique totale attendue ≈ 241 kW
- [ ] Vérifier qu'un coefficient de foisonnement collectif (0,3–0,5, pas le 0,90 mono-logement) ramène la puissance simultanée à une fourchette réaliste ≈ 90–120 kW

---

## Validation finale — les 5 pièges doivent apparaître dans l'onglet Validation

| Piège | Emplacement | Message attendu |
|---|---|---|
| 1 | T3 R+1 logement A | Rangée sans interrupteur différentiel |
| 2 | T4 R+3 logement A, plaque cuisson | Courant autorisé insuffisant (Ib≈26A > 20A) |
| 3 | T4 R+4 logement A, éclairage | Chute de tension > 3% |
| 4 | Services Généraux, tête | Différentiel sous-dimensionné vs somme aval |
| 5 | Services Généraux, bilan | Pas de bascule artificielle en triphasé global |

## Test complémentaire de l'assistant IA
Pose cette question à l'assistant Gemini une fois le tableau Services Généraux saisi :
> « Quel calibre de différentiel pour le tableau Services Généraux avec ascenseur et pompe ? »

## Livrables à produire à la fin
- [ ] Projet complet sauvegardé (11 tableaux, fermeture/réouverture navigateur sans perte)
- [ ] PDF technique du TGBT (note de calcul + schéma + conformité)
- [ ] PDF technique d'un tableau divisionnaire (le T3 R+1 A par exemple, celui avec le piège 1)
- [ ] Capture d'écran de l'onglet Validation montrant les 5 anomalies
- [ ] Note personnelle : dysfonctionnements/lenteurs rencontrés

## Note sur le temps
Objectif < 2h pour l'ensemble. Si tu dépasses largement, note à quel tableau ça a coincé — c'est une donnée utile pour l'ergonomie, pas un échec du test.
