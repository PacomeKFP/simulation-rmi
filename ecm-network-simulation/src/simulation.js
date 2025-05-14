/**
 * Simulation de réseau 4G/LTE simplifiée
 * Cette implémentation utilise des modèles statistiques pour estimer l'impact
 * de la gestion ECM sur la consommation énergétique et la performance du réseau.
 */

// Paramètres par défaut de la simulation
export function getDefaultParams() {
  return {
    // Topologie
    R: 2.5,                    // Rayon de la zone en km
    N_eNB: 19,                 // Nombre d'eNodeBs
    N_UE: 70000,               // Nombre d'UEs

    // Paramètres ECM
    T_inactivity_C_I: 10.0,    // Timer d'inactivité (s)
    L_RRC_Setup: 0.1,          // Délai d'établissement RRC (s)
    L_RRC_Release: 0.05,       // Délai de libération RRC (s)
    
    // Ressources
    N_RB: 100,                 // Resource Blocks par TTI
    B_size: 100,               // Taille du buffer en paquets
    
    // Paramètres énergétiques
    P_Idle: 5.0,               // Puissance en IDLE (mW)
    P_Connected_Base: 100.0,   // Puissance de base en CONNECTED (mW)
    P_Tx_Active: 150.0,        // Surcoût Tx (mW)
    P_Rx_Active: 80.0,         // Surcoût Rx (mW)
    
    // Scénarios à simuler
    scenarios: ['A1', 'A2', 'B1', 'B2'],
    
    // Nombre de profils utilisateurs
    K: 10,                     // Nombre de profils de trafic
    
    // Paramètres de la simulation statistique
    timeIntervals: 24,         // Nombre d'intervalles sur 24h (1 par heure)
    RNTICapacity: 65536,       // Capacité RNTI par eNodeB (2^16)
  };
}

/**
 * Fonction principale de simulation
 * 
 * @param {Object} params - Paramètres de simulation
 * @param {Function} progressCallback - Fonction de suivi de progression
 * @returns {Object} Résultats de simulation
 */
export function runSimulation(params, progressCallback) {
  progressCallback(10);
  
  // Générer les profils utilisateurs
  const userProfiles = generateUserProfiles(params.K);
  progressCallback(20);
  
  // Générer la distribution des UEs par profil
  const profileDistribution = distributeUEsByProfile(params.N_UE, userProfiles);
  progressCallback(30);
  
  // Générer les courbes de charge pour chaque profil
  const networkLoadCurves = generateNetworkLoadCurves(userProfiles, params.timeIntervals);
  progressCallback(50);
  
  // Créer la topologie du réseau pour visualisation
  const topology = createNetworkTopology(params);
  progressCallback(60);
  
  // Calculer les métriques pour chaque scénario
  const scenarios = {};
  const scenarioCount = params.scenarios.length;
  
  params.scenarios.forEach((scenarioId, index) => {
    const config = parseScenarioConfig(scenarioId);
    scenarios[scenarioId] = calculateScenarioMetrics(
      scenarioId,
      config,
      params,
      profileDistribution,
      networkLoadCurves
    );
    progressCallback(60 + 35 * (index + 1) / scenarioCount);
  });
  
  // Générer un résumé comparatif
  const summary = generateComparativeSummary(scenarios, params);
  progressCallback(99);
  
  // Finaliser les résultats
  const results = {
    topology,
    scenarios,
    summary,
    profiles: userProfiles,
    loadCurves: networkLoadCurves
  };
  
  progressCallback(100);
  return results;
}

/**
 * Génère les profils utilisateurs typiques
 * 
 * @param {Number} numProfiles - Nombre de profils à générer
 * @returns {Array} Liste des profils
 */
function generateUserProfiles(numProfiles) {
  // Définition des profils avec des caractéristiques spécifiques
  const profiles = [
    {
      id: 1,
      name: "Travailleur de bureau",
      description: "Activité principalement en journée (8h-18h)",
      sessionDuration: { avg: 5, stdDev: 2 },  // minutes
      sessionFrequency: { peak: 4, offPeak: 0.5 }, // sessions par heure
      dataVolume: { ul: 0.2, dl: 1.5 },  // MB par session
      peakHours: [9, 10, 11, 14, 15, 16, 17]
    },
    {
      id: 2,
      name: "Utilisateur nocturne",
      description: "Activité principalement en soirée et nuit",
      sessionDuration: { avg: 15, stdDev: 8 },
      sessionFrequency: { peak: 2, offPeak: 0.1 },
      dataVolume: { ul: 0.5, dl: 4 },
      peakHours: [20, 21, 22, 23, 0, 1, 2]
    },
    {
      id: 3,
      name: "Appareil IoT",
      description: "Activité constante à faible débit",
      sessionDuration: { avg: 0.2, stdDev: 0.1 },
      sessionFrequency: { peak: 6, offPeak: 5 },
      dataVolume: { ul: 0.01, dl: 0.01 },
      peakHours: [] // Pas de période de pointe
    },
    {
      id: 4,
      name: "Streaming intensif",
      description: "Utilisateur consommant beaucoup de contenu vidéo",
      sessionDuration: { avg: 45, stdDev: 20 },
      sessionFrequency: { peak: 1, offPeak: 0.1 },
      dataVolume: { ul: 0.3, dl: 12 },
      peakHours: [12, 13, 19, 20, 21, 22]
    },
    {
      id: 5,
      name: "Utilisateur réseaux sociaux",
      description: "Activité régulière sur les réseaux sociaux",
      sessionDuration: { avg: 8, stdDev: 3 },
      sessionFrequency: { peak: 5, offPeak: 2 },
      dataVolume: { ul: 0.8, dl: 2 },
      peakHours: [8, 12, 13, 17, 18, 19, 20, 21]
    },
    {
      id: 6,
      name: "Navetteur",
      description: "Pics d'utilisation pendant les déplacements",
      sessionDuration: { avg: 10, stdDev: 5 },
      sessionFrequency: { peak: 3, offPeak: 0.2 },
      dataVolume: { ul: 0.3, dl: 1.5 },
      peakHours: [7, 8, 9, 17, 18, 19]
    },
    {
      id: 7,
      name: "Utilisateur professionnel",
      description: "Usage professionnel constant",
      sessionDuration: { avg: 12, stdDev: 4 },
      sessionFrequency: { peak: 3, offPeak: 0.3 },
      dataVolume: { ul: 1, dl: 2 },
      peakHours: [9, 10, 11, 14, 15, 16]
    },
    {
      id: 8,
      name: "Gamer",
      description: "Sessions de jeu en ligne",
      sessionDuration: { avg: 60, stdDev: 30 },
      sessionFrequency: { peak: 0.5, offPeak: 0.05 },
      dataVolume: { ul: 2, dl: 3 },
      peakHours: [18, 19, 20, 21, 22, 23]
    },
    {
      id: 9,
      name: "Utilisateur sporadique",
      description: "Utilisation irrégulière et faible",
      sessionDuration: { avg: 2, stdDev: 1 },
      sessionFrequency: { peak: 1, offPeak: 0.3 },
      dataVolume: { ul: 0.1, dl: 0.3 },
      peakHours: [10, 14, 18]
    },
    {
      id: 10,
      name: "Téléchargeur intensif",
      description: "Téléchargements lourds et fréquents",
      sessionDuration: { avg: 30, stdDev: 15 },
      sessionFrequency: { peak: 1.5, offPeak: 0.2 },
      dataVolume: { ul: 1.5, dl: 15 },
      peakHours: [10, 11, 15, 16, 20, 21, 22]
    }
  ];
  
  return profiles.slice(0, numProfiles);
}

/**
 * Distribue les UEs parmi les différents profils
 * 
 * @param {Number} totalUEs - Nombre total d'UEs
 * @param {Array} profiles - Liste des profils utilisateurs
 * @returns {Object} Distribution des UEs par profil
 */
function distributeUEsByProfile(totalUEs, profiles) {
  const distribution = {};
  
  // Distribution typique (peut être ajustée)
  const profileWeights = [
    0.25,   // Travailleur de bureau
    0.15,   // Utilisateur nocturne
    0.10,   // Appareil IoT
    0.10,   // Streaming intensif
    0.15,   // Utilisateur réseaux sociaux
    0.08,   // Navetteur
    0.05,   // Utilisateur professionnel
    0.04,   // Gamer
    0.05,   // Utilisateur sporadique
    0.03    // Téléchargeur intensif
  ];
  
  // S'assurer que le nombre de poids correspond au nombre de profils
  const validWeights = profileWeights.slice(0, profiles.length);
  
  // Normaliser les poids
  const sum = validWeights.reduce((a, b) => a + b, 0);
  const normalizedWeights = validWeights.map(w => w / sum);
  
  // Distribuer les UEs
  let remainingUEs = totalUEs;
  
  profiles.forEach((profile, index) => {
    if (index < profiles.length - 1) {
      const count = Math.round(totalUEs * normalizedWeights[index]);
      distribution[profile.id] = count;
      remainingUEs -= count;
    } else {
      // Dernier profil prend le reste pour s'assurer que le total est exact
      distribution[profile.id] = remainingUEs;
    }
  });
  
  return distribution;
}

/**
 * Génère les courbes de charge du réseau pour chaque profil sur 24h
 * 
 * @param {Array} profiles - Liste des profils utilisateurs
 * @param {Number} intervals - Nombre d'intervalles (typiquement 24 pour les heures)
 * @returns {Object} Courbes de charge pour chaque profil
 */
function generateNetworkLoadCurves(profiles, intervals = 24) {
  const loadCurves = {};
  
  profiles.forEach(profile => {
    loadCurves[profile.id] = {
      hourlyActivity: Array(intervals).fill(0),
      connectionProbabilities: Array(intervals).fill(0),
      expectedSessions: Array(intervals).fill(0),
      dataVolume: Array(intervals).fill(0),
    };
    
    // Générer la courbe d'activité par heure
    for (let hour = 0; hour < intervals; hour++) {
      // Base: activité hors pic ou en pic
      const isPeakHour = profile.peakHours.includes(hour);
      const baseActivity = isPeakHour ? 0.7 : 0.2;
      
      // Ajouter une variation quotidienne (forme sinusoidale)
      const dayNightEffect = 0.1 * Math.sin((hour - 6) * Math.PI / 12);
      
      // Activité résultante entre 0 et 1
      const activity = Math.max(0, Math.min(1, baseActivity + dayNightEffect));
      loadCurves[profile.id].hourlyActivity[hour] = activity;
      
      // Probabilité de connexion
      const sessionFreq = isPeakHour ? profile.sessionFrequency.peak : profile.sessionFrequency.offPeak;
      loadCurves[profile.id].connectionProbabilities[hour] = 1 - Math.exp(-sessionFreq);
      
      // Nombre moyen de sessions attendues
      loadCurves[profile.id].expectedSessions[hour] = sessionFreq;
      
      // Volume de données attendu (MB par UE par heure)
      loadCurves[profile.id].dataVolume[hour] = sessionFreq * (profile.dataVolume.ul + profile.dataVolume.dl);
    }
  });
  
  return loadCurves;
}

/**
 * Crée une topologie simple pour la visualisation
 */
function createNetworkTopology(params) {
  const eNodeBs = [];
  const UEs = [];
  const uePerProfile = distributeUEsByProfile(Math.min(1000, params.N_UE), generateUserProfiles(params.K));
  
  // Créer les eNodeBs
  for (let i = 0; i < Math.min(params.N_eNB, 19); i++) {
    const angle = (i / params.N_eNB) * 2 * Math.PI;
    const distance = i === 0 ? 0 : params.R * 0.7;
    
    eNodeBs.push({
      id: i,
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      connectedUEs: []
    });
  }
  
  // Créer un échantillon d'UEs pour visualisation
  let ueId = 0;
  Object.entries(uePerProfile).forEach(([profileId, count]) => {
    for (let i = 0; i < count; i++) {
      // Distribution aléatoire dans un cercle
      const r = params.R * Math.sqrt(Math.random());
      const theta = Math.random() * 2 * Math.PI;
      const x = r * Math.cos(theta);
      const y = r * Math.sin(theta);
      
      // Assigner à l'eNodeB le plus proche
      let closestENB = 0;
      let minDistance = Math.sqrt(Math.pow(x - eNodeBs[0].x, 2) + Math.pow(y - eNodeBs[0].y, 2));
      
      for (let j = 1; j < eNodeBs.length; j++) {
        const distance = Math.sqrt(Math.pow(x - eNodeBs[j].x, 2) + Math.pow(y - eNodeBs[j].y, 2));
        if (distance < minDistance) {
          minDistance = distance;
          closestENB = j;
        }
      }
      
      // État initial aléatoire
      const state = Math.random() > 0.7 ? "IDLE" : "CONNECTED";
      
      // Ajouter l'UE
      UEs.push({
        id: ueId++,
        x,
        y,
        profile: parseInt(profileId),
        eNodeB: closestENB,
        state
      });
      
      // Si connecté, ajouter à la liste des UEs connectés de l'eNodeB
      if (state === "CONNECTED") {
        eNodeBs[closestENB].connectedUEs.push(ueId - 1);
      }
    }
  });
  
  // Calculer des statistiques
  const connectedUEs = UEs.filter(ue => ue.state === "CONNECTED").length;
  
  return {
    eNodeBs,
    UEs,
    stats: {
      meanConnectedUEs: connectedUEs,
      maxConnectedUEs: Math.max(...eNodeBs.map(enb => enb.connectedUEs.length)),
      totalRNTIs: params.N_eNB * params.RNTICapacity,
      rntiReuseRate: params.N_UE / (params.N_eNB * params.RNTICapacity) * 10, // Estimation du taux de réutilisation
      idleUEs: UEs.length - connectedUEs,
      connectedUEs
    }
  };
}

/**
 * Parse la configuration du scénario à partir de son ID
 */
function parseScenarioConfig(scenarioId) {
  return {
    withECM: scenarioId.startsWith('A'),
    schedulerType: scenarioId.endsWith('1') ? 'RR' : 'PF'
  };
}

/**
 * Calcule les métriques pour un scénario donné
 */
function calculateScenarioMetrics(scenarioId, config, params, profileDistribution, loadCurves) {
  const { withECM, schedulerType } = config;
  
  // Initialiser les métriques
  const metrics = {
    energy: { 
      averageConsumption: 0,
      timeInIdle: 0,
      timeInConnected: 0,
      timeInTx: 0,
      timeInRx: 0
    },
    rnti: {
      peakUsagePercent: 0,
      averageUsagePercent: 0,
      uniqueUEsServed: 0
    },
    latency: {
      avgIdleToConnected: withECM ? params.L_RRC_Setup * 1000 : 0, // ms
      avgQueueingLatency: 0,
      avgFirstPacketLatency: 0,
      hourlyFirstPacketLatency: Array(24).fill(0),
      hourlyQueueingLatency: Array(24).fill(0)
    },
    qos: {
      avgULGoodput: 0,
      avgDLGoodput: 0,
      packetDeliveryRatio: 0,
      bufferOccupancyAvg: 0,
      bufferOccupancyMax: 0
    }
  };
  
  // Nombre total d'UEs
  const totalUEs = params.N_UE;
  
  // Variables pour le calcul des métriques
  let totalEnergyConsumption = 0;
  let totalTimeInIdle = 0;
  let totalTimeInConnected = 0;
  let totalTimeInTx = 0;
  let totalTimeInRx = 0;
  let peakRNTIUsage = 0;
  let avgRNTIUsage = 0;
  let totalULBytes = 0;
  let totalDLBytes = 0;
  let totalGeneratedPackets = 0;
  let totalDeliveredPackets = 0;
  
  // Le facteur d'efficacité du scheduler
  const schedulerEfficiency = schedulerType === 'PF' ? 1.2 : 1.0;
  
  // Simuler l'activité sur 24h
  for (let hour = 0; hour < 24; hour++) {
    let hourlyActiveUEs = 0;
    let hourlyQueueingDelay = 0;
    let hourlyFirstPacketDelay = 0;
    
    // Pour chaque profil, calculer l'activité à cette heure
    Object.entries(profileDistribution).forEach(([profileId, ueCount]) => {
      const profile = parseInt(profileId);
      const profileData = loadCurves[profile];
      
      // Activité basée sur l'heure
      const hourlyActivity = profileData.hourlyActivity[hour];
      const connectionProb = profileData.connectionProbabilities[hour];
      const dataVolume = profileData.dataVolume[hour];
      
      // Estimer combien d'UEs de ce profil sont actifs à cette heure
      const activeUEsOfProfile = Math.round(ueCount * hourlyActivity);
      hourlyActiveUEs += activeUEsOfProfile;
      
      // Avec ECM, une partie des UEs actifs sera en IDLE et devra se reconnecter
      let uesInIdleState = 0;
      let uesInConnectedState = activeUEsOfProfile;
      
      if (withECM) {
        // Estimer la proportion en IDLE vs CONNECTED basé sur la fréquence des sessions
        const idleProportion = Math.exp(-params.T_inactivity_C_I * profileData.expectedSessions[hour] / 3600);
        uesInIdleState = Math.round(activeUEsOfProfile * idleProportion);
        uesInConnectedState = activeUEsOfProfile - uesInIdleState;
      }
      
      // Calculer la consommation énergétique pour ce profil à cette heure
      const hourInMs = 3600000;
      const energyIdle = (params.P_Idle * uesInIdleState * hourInMs) / 3600000; // mWh
      const energyConnectedBase = (params.P_Connected_Base * uesInConnectedState * hourInMs) / 3600000; // mWh
      
      // Estimer le temps passé en TX/RX actif
      const avgSessionDuration = 60000; // ms
      const sessionsPerHour = profileData.expectedSessions[hour] * ueCount;
      const totalSessionTime = sessionsPerHour * avgSessionDuration; // ms
      const txRatio = 0.3; // 30% du temps en TX
      const rxRatio = 0.7; // 70% du temps en RX
      
      const txTime = totalSessionTime * txRatio / 3600000; // h
      const rxTime = totalSessionTime * rxRatio / 3600000; // h
      
      const energyTx = params.P_Tx_Active * txTime; // mWh
      const energyRx = params.P_Rx_Active * rxTime; // mWh
      
      // Ajouter au total
      totalEnergyConsumption += energyIdle + energyConnectedBase + energyTx + energyRx;
      totalTimeInIdle += uesInIdleState;
      totalTimeInConnected += uesInConnectedState;
      totalTimeInTx += txTime * ueCount;
      totalTimeInRx += rxTime * ueCount;
      
      // Calcul du trafic de données
      const ulDataMB = dataVolume * ueCount * 0.3; // 30% uplink
      const dlDataMB = dataVolume * ueCount * 0.7; // 70% downlink
      
      totalULBytes += ulDataMB * 1024 * 1024; // Convertir en bytes
      totalDLBytes += dlDataMB * 1024 * 1024; // Convertir en bytes
      
      // Gestion des paquets
      const avgPacketSize = 1500; // bytes
      const generatedPacketsUL = Math.round(ulDataMB * 1024 * 1024 / avgPacketSize);
      const generatedPacketsDL = Math.round(dlDataMB * 1024 * 1024 / avgPacketSize);
      
      totalGeneratedPackets += generatedPacketsUL + generatedPacketsDL;
      
      // Facteurs impactant la livraison des paquets
      const congestionFactor = Math.min(1, params.N_RB * 100 / hourlyActiveUEs * schedulerEfficiency);
      const deliveryRatio = withECM ? 0.99 * congestionFactor : 0.95 * congestionFactor;
      
      totalDeliveredPackets += Math.round((generatedPacketsUL + generatedPacketsDL) * deliveryRatio);
      
      // Calcul des latences
      const baseQueueingDelay = 10 + (hourlyActiveUEs / (params.N_eNB * 50)) * 50; // ms
      const schedulerImpact = schedulerType === 'PF' ? 0.8 : 1.0; // PF réduit les latences de 20%
      hourlyQueueingDelay += baseQueueingDelay * schedulerImpact;
      
      // Pour la latence du premier paquet
      if (withECM) {
        hourlyFirstPacketDelay = params.L_RRC_Setup * 1000 + hourlyQueueingDelay;
      } else {
        hourlyFirstPacketDelay = hourlyQueueingDelay;
      }
    });
    
    // Usage RNTI
    const rntiUsageHourly = withECM 
      ? Math.min(100, (hourlyActiveUEs / (params.N_eNB * params.RNTICapacity)) * 100 * 0.2)
      : Math.min(100, (hourlyActiveUEs / (params.N_eNB * params.RNTICapacity)) * 100);
    
    peakRNTIUsage = Math.max(peakRNTIUsage, rntiUsageHourly);
    avgRNTIUsage += rntiUsageHourly;
    
    // Enregistrer les latences horaires
    metrics.latency.hourlyQueueingLatency[hour] = hourlyQueueingDelay;
    metrics.latency.hourlyFirstPacketLatency[hour] = hourlyFirstPacketDelay;
  }
  
  // Finaliser les métriques
  metrics.energy.averageConsumption = totalEnergyConsumption / totalUEs;
  
  // Normaliser les temps pour obtenir des pourcentages
  const totalTime = totalTimeInIdle + totalTimeInConnected;
  metrics.energy.timeInIdle = (totalTimeInIdle / totalTime) * 100;
  metrics.energy.timeInConnected = (totalTimeInConnected / totalTime) * 100;
  metrics.energy.timeInTx = (totalTimeInTx / totalTimeInConnected) * 100;
  metrics.energy.timeInRx = (totalTimeInRx / totalTimeInConnected) * 100;
  
  // Métriques RNTI
  metrics.rnti.peakUsagePercent = peakRNTIUsage;
  metrics.rnti.averageUsagePercent = avgRNTIUsage / 24;
  metrics.rnti.uniqueUEsServed = withECM ? totalUEs : Math.min(totalUEs, params.N_eNB * params.RNTICapacity);
  
  // Métriques de latence
  metrics.latency.avgQueueingLatency = metrics.latency.hourlyQueueingLatency.reduce((a, b) => a + b, 0) / 24;
  metrics.latency.avgFirstPacketLatency = metrics.latency.hourlyFirstPacketLatency.reduce((a, b) => a + b, 0) / 24;
  
  // Métriques QoS
  const simulationTimeSeconds = 24 * 3600;
  metrics.qos.avgULGoodput = (totalULBytes * 8) / (totalUEs * simulationTimeSeconds) / 1000000; // Mbps par UE
  metrics.qos.avgDLGoodput = (totalDLBytes * 8) / (totalUEs * simulationTimeSeconds) / 1000000; // Mbps par UE
  metrics.qos.packetDeliveryRatio = totalDeliveredPackets / totalGeneratedPackets;
  
  // Buffer occupancy - estimation
  const bufferLoad = withECM ? 0.4 : 0.7; // ECM réduit l'occupation des buffers
  metrics.qos.bufferOccupancyAvg = bufferLoad * params.B_size * 0.3;
  metrics.qos.bufferOccupancyMax = bufferLoad * params.B_size * 0.9;
  
  return { metrics };
}

/**
 * Génère un résumé comparatif des scénarios
 */
function generateComparativeSummary(scenarios, params) {
  const scenarioIds = Object.keys(scenarios);
  
  // Séparer les scénarios avec et sans ECM
  const ecmScenarios = scenarioIds.filter(id => id.startsWith('A'));
  const noEcmScenarios = scenarioIds.filter(id => id.startsWith('B'));
  
  // Comparaison énergétique
  let energyComparison = "";
  if (ecmScenarios.length > 0 && noEcmScenarios.length > 0) {
    const avgEcmEnergy = ecmScenarios.reduce(
      (sum, id) => sum + scenarios[id].metrics.energy.averageConsumption, 0
    ) / ecmScenarios.length;
    
    const avgNoEcmEnergy = noEcmScenarios.reduce(
      (sum, id) => sum + scenarios[id].metrics.energy.averageConsumption, 0
    ) / noEcmScenarios.length;
    
    const energyDiffPercent = ((avgNoEcmEnergy - avgEcmEnergy) / avgNoEcmEnergy) * 100;
    
    energyComparison = `La gestion ECM permet une économie d'énergie de ${energyDiffPercent.toFixed(1)}% par rapport au mode sans ECM.`;
  }
  
  // Comparaison RNTI
  let rntiComparison = "";
  if (ecmScenarios.length > 0 && noEcmScenarios.length > 0) {
    const avgEcmRntiUsage = ecmScenarios.reduce(
      (sum, id) => sum + scenarios[id].metrics.rnti.averageUsagePercent, 0
    ) / ecmScenarios.length;
    
    const avgNoEcmRntiUsage = noEcmScenarios.reduce(
      (sum, id) => sum + scenarios[id].metrics.rnti.averageUsagePercent, 0
    ) / noEcmScenarios.length;
    
    rntiComparison = `Utilisation moyenne des RNTIs : ${avgEcmRntiUsage.toFixed(1)}% avec ECM vs ${avgNoEcmRntiUsage.toFixed(1)}% sans ECM. `;
    
    // Capacité à servir plus d'UEs que de RNTIs disponibles
    if (params.N_UE > params.N_eNB * params.RNTICapacity) {
      rntiComparison += `La gestion ECM permet de servir ${params.N_UE} UEs avec seulement ${params.N_eNB * params.RNTICapacity} RNTIs disponibles grâce à la réutilisation des identifiants.`;
    }
  }
  
  // Comparaison latence
  let latencyComparison = "";
  if (ecmScenarios.length > 0 && noEcmScenarios.length > 0) {
    const avgEcmFirstPacket = ecmScenarios.reduce(
      (sum, id) => sum + scenarios[id].metrics.latency.avgFirstPacketLatency, 0
    ) / ecmScenarios.length;
    
    const avgNoEcmFirstPacket = noEcmScenarios.reduce(
      (sum, id) => sum + scenarios[id].metrics.latency.avgFirstPacketLatency, 0
    ) / noEcmScenarios.length;
    
    latencyComparison = `Latence moyenne du premier paquet : ${avgEcmFirstPacket.toFixed(1)} ms avec ECM vs ${avgNoEcmFirstPacket.toFixed(1)} ms sans ECM.`;
  }
  
  // Comparaison capacité réseau
  let capacityComparison = "";
  
  // Comparer RR et PF
  const rrScenarios = scenarioIds.filter(id => id.endsWith('1'));
  const pfScenarios = scenarioIds.filter(id => id.endsWith('2'));
  
  if (rrScenarios.length > 0 && pfScenarios.length > 0) {
    const avgRrGoodput = rrScenarios.reduce(
      (sum, id) => sum + scenarios[id].metrics.qos.avgDLGoodput + scenarios[id].metrics.qos.avgULGoodput, 0
    ) / rrScenarios.length;
    
    const avgPfGoodput = pfScenarios.reduce(
      (sum, id) => sum + scenarios[id].metrics.qos.avgDLGoodput + scenarios[id].metrics.qos.avgULGoodput, 0
    ) / pfScenarios.length;
    
    capacityComparison = `Le scheduler Proportional Fair offre un débit moyen ${(avgPfGoodput / avgRrGoodput * 100 - 100).toFixed(1)}% supérieur au Round Robin.`;
  }
  
  // Recommandation
  let recommendation = "Basé sur les résultats de simulation:";
  
  if (ecmScenarios.length > 0 && noEcmScenarios.length > 0) {
    const avgEcmEnergy = ecmScenarios.reduce(
      (sum, id) => sum + scenarios[id].metrics.energy.averageConsumption, 0
    ) / ecmScenarios.length;
    
    const avgNoEcmEnergy = noEcmScenarios.reduce(
      (sum, id) => sum + scenarios[id].metrics.energy.averageConsumption, 0
    ) / noEcmScenarios.length;
    
    if (avgEcmEnergy < avgNoEcmEnergy) {
      recommendation += " La gestion ECM est fortement recommandée pour les appareils sur batterie en raison des économies d'énergie significatives.";
    }
    
    // Recommandation RNTI
    if (params.N_UE > params.N_eNB * params.RNTICapacity * 0.8) {
      recommendation += " La gestion ECM est essentielle pour les déploiements denses afin de maximiser le nombre d'UEs pouvant être servis avec des ressources RNTI limitées.";
    }
  }
  
  // Recommandation scheduler
  if (rrScenarios.length > 0 && pfScenarios.length > 0) {
    const avgRrPDR = rrScenarios.reduce(
      (sum, id) => sum + scenarios[id].metrics.qos.packetDeliveryRatio, 0
    ) / rrScenarios.length;
    
    const avgPfPDR = pfScenarios.reduce(
      (sum, id) => sum + scenarios[id].metrics.qos.packetDeliveryRatio, 0
    ) / pfScenarios.length;
    
    if (avgPfPDR > avgRrPDR) {
      recommendation += " L'ordonnancement Proportional Fair est recommandé pour une meilleure efficacité du réseau et une meilleure équité entre utilisateurs.";
    } else {
      recommendation += " L'ordonnancement Round Robin semble suffisant pour cette composition de trafic.";
    }
  }
  
  return {
    energyComparison,
    rntiComparison,
    latencyComparison,
    capacityComparison,
    recommendation
  };
}