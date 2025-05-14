# Cahier des Charges : Simulation d'un Réseau Urbain 4G/LTE - Impact de la Gestion ECM 

## 1. Contexte et Objectifs de la Simulation

### 1.1. Contexte Général

Ce document définit les exigences pour une simulation logicielle (cible : Python) d'un réseau cellulaire 4G/LTE déployé dans une zone urbaine représentée par un cercle. La simulation vise à évaluer l'impact de différentes stratégies de gestion de la connexion radio (ECM - EPS Connection Management) sur les performances du réseau et l'expérience utilisateur (UE) sur des périodes étendues (24 heures).

### 1.2. Objectifs Spécifiques

L'objectif principal est de comparer quantitativement deux modes de fonctionnement fondamentaux :

- Mode "Avec ECM" : Les UEs utilisent les états ECM-IDLE et ECM-CONNECTED, avec des transitions basées sur l'activité et des timers d'inactivité.
- Mode "Sans ECM" : Les UEs, une fois actifs, restent en état ECM-CONNECTED (pas d'état IDLE pour économiser l'énergie ou libérer des ressources radio à court terme).

L'analyse portera sur les aspects suivants :

1. Efficacité de la Gestion des Identifiants Radio (RNTI) :

- Évaluer la capacité du mode "Avec ECM" à servir un nombre total d'UEs ( N UE ) significativement supérieur au nombre de RNTI disponibles par eNodeB ( N_eNB * 2^16 ) grâce à la libération et réutilisation des RNTI en état IDLE .
- Comparer l'utilisation des ressources RNTI entre les deux modes.

2. Consommation Énergétique des UEs :

- Quantifier et comparer la consommation énergétique simulée des UEs sur 24h dans les deux modes, en se basant sur un modèle simplifié lié à l'état ( IDLE, CONNECTED ) et à l'activité (Transmission/Réception).

3. Qualité de Service (QoS) Globale :

- Latence : Évaluer les délais d'accès au service (notamment le délai de transition IDLE -> CONNECTED en mode "Avec ECM") et les délais de transmission des paquets (influencés par I'ordonnancement et potentiellement la mise en file d'attente).
- Satisfaction (Débit/Disponibilité) : Mesurer le volume de données effectivement transmises par rapport à la demande des profils de trafic, et évaluer le taux de succès des transmissions sur 24 h .


## 2. Cadre Général de la Simulation
- Type de Simulation : Simulation à événements discrets émulant le temps sur des périodes de 24 heures.
- Environnement Cible : Implémentation en Python.
- Échelle Temporelle : Simulation de T_sim = 24 * 3600 secondes (temps simulé).
- Répétitions : La simulation sera exécutée N_runs fois [Paramètre à définir, ex: 10] avec des graines aléatoires différentes pour assurer la robustesse statistique des résultats.
- Période de Stabilisation (Warm-up) : Une période initiale T_warmup [Paramètre à définir, ex: 1 heure] pourra être définie pour permettre au système d'atteindre un régime pseudo-stationnaire avant le début de la collecte des métriques.
- Hypothèses Simplificatrices Clés :
- Focalisation sur les interactions UE-eNodeB et les mécanismes protocolaires (ECM, RNTI, Scheduling).
- Le canal radio peut être considéré comme idéal ou simplifié (détails à spécifier si nécessaire, mais la complexité du canal n'est pas le focus principal). L'impact principal vient des états, des timers et de l'allocation de ressources.


# 3. Description des Composants et de Leurs Attentes 

### 3.1. Topologie du Réseau

- Zone Géographique : Un cercle de rayon R [Paramètre à définir, ex: 2.5 km$]$.
- eNodeBs (eNBs) :
- Nombre: N_eNB [Paramètre à définir].
- Placement : Positionnés aléatoirement dans le cercle selon une distribution Gaussienne 2D centrée sur le centre du cercle, avec un écart-type o_eNB [Paramètre à définir] pour contrôler la densité (plus dense au centre).
- Association UE : Les UEs s'associent à l'eNB le plus proche.
- User Equipments (UEs) :
- Nombre Total : N UE [Paramètre à définir], tel que N UE est significativement supérieur à N_eNB * $2^{\wedge} 16$.
- Placement Initial : Positionnés aléatoirement dans le cercle selon une distribution Gaussienne 2D (potentiellement avec un écart-type o UE [Paramètre à définir] différent de o_eNB ).
- Mobilité : [À Définir : Statique ou Mobile]. Si mobile, un modèle de mobilité (ex: Random Waypoint adapté au cercle) et une logique de handover basée sur la proximité devront être spécifiés.


### 3.2. Génération du Trafic sur 24h

- Profils Utilisateur: K=10 profils de trafic distincts seront définis pour représenter différents comportements d'utilisation sur une journée (ex: travailleur de bureau, utilisateur nocturne, utilisateur loT, streaming...).
- Assignation : Chaque UE se verra assigner l'un des K profils.
- Modèle par Profil : Chaque profil définira des caractéristiques de trafic sur 24h, incluant :
- Des périodes typiques d'activité (ON) et d'inactivité (OFF).
- Pendant les périodes ON, des modèles de génération de paquets (UL et DL) : fréquence/intervalle entre paquets, distribution de la taille des paquets.
- Les paramètres devront permettre une variabilité aléatoire individuelle pour chaque UE autour du modèle de son profil.
- Buffers : Des files d'attente (buffers) de taille finie [Paramètre B_size à définir] seront simulées à I'UE (UL) et à l'eNB (par UE pour le DL) pour stocker les paquets en attente de transmission.


# 3.3. Gestion des Ressources Radio (RRM) 

- Gestion des États ECM :
- Mode "Avec ECM" :
- États: ECM-IDLE, ECM-CONNECTED.
- Transitions :
- IDLE -> CONNECTED : Sur arrivée de données UL/DL (après paging réussi si DL). Délai fixe L_RRC_Setup [Paramètre]. Nécessite allocation RNTI.
- CONNECTED -> IDLE : Après expiration d'un timer d'inactivité T_inactivity_C_I [Paramètre]. Délai fixe L_RRC_Release [Paramètre]. Libère le RNTI.
- Le timer T_inactivity_C_I est réinitialisé à chaque transmission/réception de paquet en état CONNECTED.
- Mode "Sans ECM" :
- État : Les UEs actifs restent en ECM-CONNECTED. Pas de transition vers IDLE basée sur l'inactivité. Le RNTI est conservé tant que l'UE est considéré actif.
- Gestion des RNTI :
- Pool : Chaque eNB dispose d'un pool de $2^{\wedge} 16$ C-RNTI.
- Allocation/Libération : Gérée conformément aux transitions d'état décrites ci-dessus pour chaque mode.
- Ordonnancement (Scheduler) :
- Fonctionnement : Par eNB, à chaque TTI (1 ms).
- Ressources : Alloue un nombre fixe de Resource Blocks (RBs) N_RB [Paramètre] par TTI.
- Algorithmes à Supporter : Au minimum, Round Robin (RR) et Proportional Fair (PF). [Paramètre : W_PF pour la fenêtre de PF].
- Entrée : Liste des UEs en CONNECTED ayant des données à transmettre/recevoir.
- Sortie : Assignation des N_RB aux UEs pour le TTI courant.


### 3.4. Transmission et Canal (Simplifié)

- Débit par RB : Un débit fixe R_RB [Paramètre] par Resource Block alloué sera supposé, reflétant des conditions de canal bonnes et constantes.
- Transmission de Paquet : Le temps nécessaire pour transmettre un paquet dépendra de sa taille et du nombre de RBs alloués par le scheduler.


3.5. Modèle de Consommation Énergétique (Simplifié)

- Modèle Basé sur État/Activité : La puissance consommée par l'UE dépendra de son état et de son activité :
 - `P_Idle :` Puissance en état `IDLE` (Mode "Avec ECM" uniquement).
 - `P_Connected_Base :` Puissance de base en état `CONNECTED` .
 - `P_Tx_Active :` Surcoût énergétique lors de la transmission (UL).
 - `P_Rx_Active :` Surcoût énergétique lors de la réception (DL).
- Calcul : L'énergie consommée sera calculée en intégrant la puissance sur la durée de la simulation (24h).
- Paramètres : Les valeurs `P_Idle, P_Connected_Base, P_Tx_Active, P_Rx_Active` [Paramètres à définir].

### 3.6. Émulation Temporelle et Génération de Trafic Détaillée (24h)

La simulation émule une période de `T_sim = 24 * 3600` secondes. Pour capturer les variations journalières du trafic tout en modélisant les interactions fines, une approche à deux niveaux temporels est adoptée :

1. Vue Globale (Intervalles de 5 minutes) :

 - `La` journée de 24h est divisée en `N_intervals = 24 * 60 / 5 = 288` intervalles de `Δt_global = 300` secondes chacun.
 - `Pour chaque profil de trafic k` (parmi les `K=10`) et chaque intervalle `j` (`j=1...288` ), une intensité d'activité moyenne attendue `ActivityLevel_k,j` est définie. Cette valeur représente l'utilisation typique du réseau pour ce profil pendant cette période de la journée (ex: faible la nuit, haute pendant les heures de bureau pour un profil "travailleur", pics le soir pour un profil "streaming"). Elle peut influencer, par exemple, la probabilité qu'un UE de ce profil démarre une session ou le volume moyen de données qu'il est censé générer/recevoir.

2. Vue Locale (Intra-Intervalle - pilotée par événements/TTI) :

 - `La` simulation progresse avec une granularité fine (ex: `TTI` = 1ms pour le scheduling).
 - `Pour un UE i donné, de profil k, durant l'intervalle global j` :

 - `Le comportement réel` (démarrage de sessions, arrivées de paquets UL/DL) est généré de manière stochastique, en utilisant des processus définis pour le profil `k` .
 - `Les paramètres de ces processus stochastiques` (ex: taux moyen d'arrivée de paquets, taille moyenne des paquets, durée moyenne des sessions ON) sont modulés par l' `ActivityLevel_k,j` défini au niveau global.
 - Différenciation et Variabilité Intra-Intervalle :

 - `Loi` Uniforme : Pour différencier les UEs appartenant au même profil `k` durant l'intervalle `j`. Par exemple, si le profil indique qu'une session doit démarrer pendant cet intervalle, le moment exact du démarrage pour l'UE `i` pourrait être tiré d'une loi uniforme sur les 300 secondes de l'intervalle. Une légère variation (ex: `+/- 10%)` du


volume de données cible pour cet intervalle pourrait aussi être appliquée à chaque UE via un facteur tiré uniformément.

- Loi Normale : Pour introduire une variabilité dans l'échelonnement et la répartition des sollicitations pour un UE spécifique durant l'intervalle. Par exemple, les temps inter-arrivées des paquets pourraient suivre une loi de base (ex: exponentielle dont la moyenne dépend de `ActivityLevel_k,j` ), mais l'instant précis de chaque arrivée pourrait être légèrement décalé par une valeur ajoutée tirée d'une loi Normale (centrée sur 0, avec un petit écart-type) pour simuler du jitter ou une répartition moins mécanique. La durée d'une rafale de paquets pourrait également être tirée d'une loi Normale dont la moyenne dépend de l'activité globale prévue.
- Les paquets ainsi générés sont placés dans les buffers UL (à l'UE) ou DL (à l'eNB pour cet UE).

Cette approche permet de simuler des tendances journalières réalistes (via la vue globale) tout en conservant la nature stochastique et détaillée des interactions au niveau des paquets et des TTI (via la vue locale).

## 4. Scénarios de Simulation Requis

La simulation devra au minimum pouvoir exécuter et comparer les scénarios suivants :

1. Scénario A1 : Avec ECM + Scheduler RR
2. Scénario A2 : Avec ECM + Scheduler PF
3. Scénario B1 : Sans ECM + Scheduler RR
4. Scénario B2 : Sans ECM + Scheduler PF

## 5. Métriques Attendues

La simulation devra collecter et rapporter (sous forme de moyennes, écarts-types, et si pertinent, de distributions/CDF sur les `N_runs` répétitions) les métriques suivantes, pour chaque scénario :

- Métriques RNTI :
- Nombre moyen et maximal d'UEs simultanément en `connected` par eNB.
- Nombre total d'UEs uniques servis par eNB sur 24h.
- Distribution/Statistiques sur le taux d'occupation du pool RNTI par eNB au cours du temps.
- Métriques Énergétiques :
- Énergie moyenne consommée par UE sur 24h (globale et par profil de trafic).
- Distribution du temps passé en état `idle` et `connected` (pour les scénarios "Avec ECM").
- Comparaison directe de la consommation moyenne entre les scénarios A et B.
- Métriques QoS - Latence :
- Distribution de la latence de transition `idle -> connected` (Scénarios A).
- Distribution de la latence de mise en file d'attente des paquets (avant transmission par le scheduler).

-


Distribution de la latence du premier paquet pour les sessions utilisateur.
- Métriques QoS - Satisfaction/Débit :
 - Distribution du débit utile (Goodput) moyen par UE (UL et DL) sur 24h.
 - Débit agrégé total du réseau simulé.
 - Packet Delivery Ratio (PDR) global et par UE (pourcentage de paquets générés effectivement transmis, tenant compte des éventuels rejets de buffer).
 - Taux d'occupation moyen/max des buffers UL/DL.

## 6. Paramètres Détaillés de la Simulation

Cette section définit les paramètres clés nécessaires pour configurer et exécuter la simulation. Les valeurs exactes sont à déterminer mais leur définition et leur rôle sont précisés ici.

### 6.1. Paramètres Généraux de Simulation

- T_sim : Durée totale de la simulation (temps simulé).
 - Définition : Période sur laquelle les métriques sont collectées après la phase de chauffe.
 - Valeur : 24 * 3600 secondes (fixe).
 - Unité : secondes.
- T_warmup : Durée de la phase de chauffe initiale.
 - Définition : Période au début de chaque run de simulation pendant laquelle le système évolue sans collecte de métriques, afin d'atteindre un état pseudo-stationnaire.
 - Valeur : [À Définir, ex: 3600].
 - Unité : secondes.
- N_runs : Nombre de répétitions de la simulation.
 - Définition : Nombre d'exécutions indépendantes de la simulation (avec des graines aléatoires différentes) pour obtenir des résultats statistiquement significatifs.
 - Valeur : [À Définir, ex: 10].
 - Unité : sans.
- Δt_global : Durée d'un intervalle de temps global pour la modulation du trafic.
 - Définition : Unité de temps pour définir les niveaux d'activité moyens par profil.
 - Valeur : 300 secondes (5 minutes, fixe).
 - Unité : secondes.
- Δt_local / TTI : Granularité temporelle la plus fine pour les événements discrets (notamment le scheduling).
 - Définition : Transmission Time Interval, unité de base pour l'allocation des ressources par le scheduler.
 - Valeur : 0.001 secondes (1 ms, fixe).
 - Unité : secondes.

### 6.2. Paramètres de Topologie
- R : Rayon de la zone de simulation circulaire.
- Définition : Définit les limites de la zone géographique simulée.
- Valeur : [À Définir, ex: 2.5].
- Unité : km.
- N_eNB : Nombre total d'eNodeBs dans la simulation.
- Définition : Quantité de stations de base déployées.
- Valeur : [À Définir, ex: 19 ou 37].
- Unité : sans.
- Center_eNB / Center_UE : Centre de la distribution Gaussienne pour le placement.
- Définition : Point géographique (coordonnées x,y) autour duquel les eNBs et les UEs sont placés avec une densité décroissante. Typiquement le centre du cercle.
- Valeur: $(0,0)$ si le centre du cercle est à l'origine.
- Unité : km.
- $\sigma \_e N B$ : Écart-type de la distribution Gaussienne pour le placement des eNBs.
- Définition : Contrôle la concentration spatiale des eNBs autour du centre. Une petite valeur signifie une forte concentration centrale.
- Valeur : [À Définir, ex: 1.0].
- Unité : km.
- N_UE : Nombre total d'User Equipments dans la simulation.
- Définition : Nombre total d'utilisateurs simulés. Doit être > N_eNB * 2^16 .
- Valeur : [À Définir, ex: N_eNB * 70000 ].
- Unité : sans.
- $\sigma_{-} U E$ : Écart-type de la distribution Gaussienne pour le placement initial des UEs.
- Définition : Contrôle la concentration spatiale initiale des UEs. Peut être différent de $\sigma_{-} e N B$.
- Valeur : [À Définir, ex: 0.8].
- Unité : km.
- Mobility_Model : Choix du modèle de mobilité pour les UEs.
- Définition : Spécifie si les UEs sont statiques ou mobiles, et selon quel modèle (ex: 'Static', 'RandomWaypointInCircle').
- Valeur : [À Définir].
- Unité : sans.
- Paramètres de Mobilité (si Mobility_Model != 'Static') :
- v_min, v_max : Vitesses minimale et maximale des UEs (pour RWP). [Unité: $\mathrm{m} / \mathrm{s}$ ].
- Tp_max : Temps de pause maximal des UEs (pour RWP). [Unité: s].
- L_HO : Délai fixe associé à une procédure de handover. [Unité: s].


# 6.3. Paramètres de Génération de Trafic 

- K : Nombre de profils de trafic distincts.
- Valeur: 10 (fixe).


 Unité : sans.
- Profile_Distribution : Probabilité d'assignation de chaque profil aux UEs.
 - Définition : Tableau ou fonction donnant la probabilité `P(Profil=k)` pour `k=1..K`. La somme doit faire 1.
 - Valeur : [À Définir, ex: {Profil1: 0.2, Profil2: 0.15, ...}].
 - Unité : sans.
- ActivityLevel_k,j : Niveau d'activité moyen attendu pour le profil `k` durant l'intervalle `j` .
 - Définition : Matrice `K` `x` `N_intervals` définissant la tendance journalière pour chaque profil. Peut être une valeur numérique (ex: charge relative) ou un ensemble de paramètres modulant les processus locaux.
 - Valeur : [À Définir, basé sur des modèles d'usage typiques].
 - Unité : dépend de la définition exacte (ex: relatif, ou Erlangs, ou pkts/s...).
- Paramètres des Processus Locaux (par profil `k` ) :
 - Distributions pour `T_ON, T_OFF` (durées des périodes actives/inactives).
 - Distributions pour les temps inter-arrivées des paquets (UL/DL) durant `T_ON` .
 - Distributions pour la taille des paquets (UL/DL).
 - Note : Les moyennes/taux de ces distributions locales seront modulés par `ActivityLevel_k,j` .
 - Valeur : [À Définir, spécifiant les lois et leurs paramètres de base].
- `B_size` : Taille maximale des buffers de paquets (UL à l'UE, DL par UE à l'eNB).
 - Définition : Capacité de stockage en nombre de paquets ou en KBytes. Les paquets arrivant à un buffer plein sont rejetés.
 - Valeur : [À Définir, ex: 100 paquets ou 1 MByte].
 - Unité : paquets ou KBytes.

6.4. Paramètres RRM (Gestion Ressources Radio)

- `T_inactivity_C_I` : Timer d'inactivité pour la transition `CONNECTED -> IDLE` .
 - Définition : Durée maximale sans activité paquet en état `CONNECTED` avant de déclencher la transition vers `IDLE` (mode "Avec ECM").
 - Valeur : [À Définir, ex: 10 secondes].
 - Unité : secondes.
- `L_RRC_Setup` : Délai fixe pour la procédure de connexion RRC (`IDLE` -> `CONNECTED` ).
 - Définition : Temps nécessaire pour établir la connexion radio après une requête ou un paging.
 - Valeur : [À Définir, ex: 0.1 secondes].
 - Unité : secondes.
- `L_RRC_Release` : Délai fixe pour la procédure de libération RRC (`CONNECTED` -> `IDLE` ).
 - Définition : Temps nécessaire pour libérer les ressources après décision de passer en `IDLE` .
 - Valeur : [À Définir, ex: 0.05 secondes].
 - Unité : secondes.
- `Scheduler_Algo` : Algorithme d'ordonnancement utilisé par les eNodeBs.

 - `


 Définition : Choix de la logique d'allocation des RBs (ex: 'RR', 'PF').
 - Valeur : [À Définir pour chaque scénario].
 - Unité : sans.
- `N_RB` : Nombre total de Resource Blocks disponibles par eNodeB par TTI.
 - Définition : Quantité de ressources fréquence-temps à allouer à chaque TTI. Influence la capacité de la cellule.
 - Valeur : [À Définir, ex: 100 pour 20 MHz BW].
 - Unité : sans.
- `W_PF` : Taille de la fenêtre temporelle pour le calcul du débit moyen dans le scheduler Proportional Fair.
 - Définition : Nombre de TTI passés utilisés pour estimer le débit historique d'un UE (utilisé uniquement si `Scheduler_Algo` = 'PF').
 - Valeur : [À Définir, ex: 100].
 - Unité : TTI (ms).

### 6.5. Paramètres de Transmission (Canal Idéal Simplifié)

- `R_RB` : Débit de données fixe par Resource Block alloué par TTI.
 - Définition : Capacité de transmission d'un RB dans des conditions idéales.
 - Valeur : [À Définir, basé sur un MCS élevé, ex: équivalent à 64QAM code 5/6].
 - Unité : bits / TTI.

### 6.6. Paramètres de Consommation Énergétique

- `P_Idle` : Puissance consommée par l'UE en état `ECM-IDLE` .
 - Définition : Consommation de base lorsque la radio est principalement en veille (écoute paging).
 - Valeur : [À Définir, ex: 5].
 - Unité : mW.
- `P_Connected_Base` : Puissance de base consommée par l'UE en état `ECM-CONNECTED` (sans Tx/Rx active).
 - Définition : Consommation liée au maintien des circuits radio et du contexte actif.
 - Valeur : [À Définir, ex: 100].
 - Unité : mW.
- `P_Tx_Active` : Surcoût de puissance lors de la transmission (UL) en état `CONNECTED` .
 - Définition : Puissance additionnelle consommée pendant les TTI où l'UE transmet des données.
 - Valeur : [À Définir, ex: 150].
 - Unité : mW.
- `P_Rx_Active` : Surcoût de puissance lors de la réception (DL) en état `CONNECTED` .
 - Définition : Puissance additionnelle consommée pendant les TTI où l'UE reçoit des données.
 - Valeur : [À Définir, ex: 80].

 - `
- Unité : mW .
