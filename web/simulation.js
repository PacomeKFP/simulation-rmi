/**
 * Simulation de l'impact de la gestion ECM sur les réseaux 4G/LTE
 * Cette application simule et visualise les performances des réseaux cellulaires
 * avec différentes stratégies de gestion ECM (EPS Connection Management).
 */

// ====================================================================================
// PARTIE 1: CONFIGURATION ET ÉTAT GLOBAL DE L'APPLICATION
// ====================================================================================

// Configuration par défaut de la simulation
const defaultConfig = {
    // Paramètres généraux
    T_sim: 86400,                  // Durée de simulation (24h en secondes)
    T_warmup: 3600,                // Période de chauffe (1h en secondes)
    N_runs: 10,                    // Nombre de répétitions
    delta_t_global: 300,           // Intervalle global pour la modélisation du trafic (5min)
    TTI: 0.001,                    // Transmission Time Interval (1ms)
    N_intervals: 288,              // Nombre d'intervalles sur 24h (24h/5min)
    
    // Topologie
    R: 2.5,                        // Rayon de la zone circulaire (km)
    N_eNB: 19,                     // Nombre d'eNodeBs
    sigma_eNB: 1.0,                // Écart-type du placement des eNBs (km)
    N_UE: 70000,                   // Nombre d'UEs
    sigma_UE: 0.8,                 // Écart-type du placement des UEs (km)
    Mobility_Model: 'Static',      // Modèle de mobilité
    
    // Paramètres ECM
    T_inactivity_C_I: 10,          // Timer d'inactivité CONNECTED → IDLE (secondes)
    L_RRC_Setup: 0.1,              // Délai pour la procédure de connexion RRC (secondes)
    L_RRC_Release: 0.05,           // Délai pour la procédure de libération RRC (secondes)
    L_Paging: 0.05,                // Délai pour la procédure de paging (secondes)
    
    // Paramètres de scheduling
    N_RB: 100,                     // Nombre de Resource Blocks par TTI
    R_RB: 1500,                    // Débit par Resource Block (bits/TTI)
    W_PF: 100,                     // Taille de fenêtre pour Proportional Fair
    
    // Paramètres énergétiques
    P_Idle: 5,                     // Puissance en IDLE (mW)
    P_Connected_Base: 100,         // Puissance de base en CONNECTED (mW)
    P_Tx_Active: 150,              // Surcoût transmission (mW)
    P_Rx_Active: 80,               // Surcoût réception (mW)
    
    // Profils de trafic
    K: 10,                         // Nombre de profils de trafic
    Profile_Distribution: {
        'Office': 0.25,            // Utilisation professionnelle (heures de bureau)
        'Streaming': 0.15,         // Streaming vidéo (soirée)
        'IoT': 0.1,                // Appareils IoT (constant mais faible)
        'Social': 0.2,             // Réseaux sociaux (plusieurs pics dans la journée)
        'Night': 0.05,             // Utilisateur nocturne
        'Commuter': 0.1,           // Déplacements domicile-travail (matin/soir)
        'Student': 0.1,            // Étudiants (journée)
        'Random': 0.05             // Comportement aléatoire
    },
    
    // Buffers
    B_size: 100,                   // Taille des buffers (paquets)
    
    // Modèles d'activité pour les profils (nombre de pics d'activité sur 24h)
    ActivityModel: {
        'Office': [
            { startHour: 8, endHour: 12, peakLevel: 0.8 },
            { startHour: 13, endHour: 17, peakLevel: 0.7 }
        ],
        'Streaming': [
            { startHour: 19, endHour: 23, peakLevel: 0.9 }
        ],
        'IoT': [
            { startHour: 0, endHour: 24, peakLevel: 0.3 }
        ],
        'Social': [
            { startHour: 7, endHour: 9, peakLevel: 0.6 },
            { startHour: 12, endHour: 14, peakLevel: 0.5 },
            { startHour: 18, endHour: 23, peakLevel: 0.8 }
        ],
        'Night': [
            { startHour: 22, endHour: 4, peakLevel: 0.7 }
        ],
        'Commuter': [
            { startHour: 6, endHour: 9, peakLevel: 0.8 },
            { startHour: 16, endHour: 19, peakLevel: 0.8 }
        ],
        'Student': [
            { startHour: 8, endHour: 18, peakLevel: 0.6 },
            { startHour: 19, endHour: 23, peakLevel: 0.4 }
        ],
        'Random': [
            { startHour: 0, endHour: 24, peakLevel: 0.5 }
        ]
    }
};

// État global de la simulation
const simulationState = {
    running: false,                // Indique si une simulation est en cours
    progress: 0,                   // Progression de la simulation (0-100)
    currentRun: 0,                 // Run actuel
    currentScenario: null,         // Scénario en cours d'exécution
    config: {...defaultConfig},    // Configuration active
    results: {                     // Résultats des simulations
        A1: null,  // Avec ECM + Round Robin
        A2: null,  // Avec ECM + Proportional Fair
        B1: null,  // Sans ECM + Round Robin
        B2: null,  // Sans ECM + Proportional Fair
    },
    activeTab: 'configuration',    // Onglet actif
    topologyData: null,            // Données pour la visualisation topologique
    charts: {}                     // Références aux charts créés
};

// ====================================================================================
// PARTIE 2: MODÈLES PRINCIPAUX DE LA SIMULATION
// ====================================================================================

/**
 * Classe définissant les états ECM possibles
 */
class ECMState {
    static IDLE = 'IDLE';
    static CONNECTED = 'CONNECTED';
}

/**
 * Classe représentant un eNodeB dans le réseau
 */
class ENodeB {
    constructor(id, x, y, config) {
        this.id = id;
        this.x = x;
        this.y = y;
        
        // Ressources RNTI
        this.rnti_pool_size = Math.pow(2, 16);
        this.rnti_pool = new Set(Array.from({length: this.rnti_pool_size}, (_, i) => i).slice(0, 1000)); // Simulation avec pool limité pour performance
        this.allocated_rnti = new Map();  // UE ID -> RNTI
        
        // UEs associés
        this.registered_ues = [];       // Tous les UEs assignés
        this.connected_ues = [];        // UEs en état CONNECTED
        
        // Buffers DL (un par UE)
        this.dl_buffers = new Map();    // UE ID -> Buffer
        
        // Scheduler (à initialiser lors de la configuration)
        this.scheduler = null;
        
        // Statistiques
        this.stats = {
            rnti_usage: [],                      // Évolution utilisation RNTI
            connected_ues_count: [],             // Nombre d'UEs connectés au fil du temps
            unique_ues_served: new Set(),        // UEs uniques servis
            packets_transmitted: 0,              // Paquets transmis
            packets_dropped: 0,                  // Paquets rejetés
            total_throughput: 0                  // Débit total
        };
    }
    
    /**
     * Enregistre un UE comme appartenant à cette cellule
     */
    register_ue(ue) {
        this.registered_ues.push(ue);
        this.dl_buffers.set(ue.id, new Buffer(simulationState.config.B_size));
        ue.serving_enb = this;
    }
    
    /**
     * Configure le scheduler avec l'algorithme spécifié
     */
    setup_scheduler(algorithm) {
        if (algorithm === 'RR') {
            this.scheduler = new RoundRobinScheduler();
        } else if (algorithm === 'PF') {
            this.scheduler = new ProportionalFairScheduler();
        }
    }
    
    /**
     * Alloue un RNTI à un UE
     * @returns {boolean} True si l'allocation a réussi, False sinon
     */
    allocate_rnti(ue) {
        if (this.rnti_pool.size === 0) {
            return false; // Échec: plus de RNTI disponible
        }
        
        // Prendre le premier RNTI disponible
        const rnti = this.rnti_pool.values().next().value;
        this.rnti_pool.delete(rnti);
        this.allocated_rnti.set(ue.id, rnti);
        
        // Ajouter l'UE à la liste des UEs connectés
        if (!this.connected_ues.includes(ue)) {
            this.connected_ues.push(ue);
        }
        
        // Enregistrer comme UE unique servi
        this.stats.unique_ues_served.add(ue.id);
        
        return true;
    }
    
    /**
     * Libère le RNTI alloué à un UE
     */
    release_rnti(ue) {
        if (this.allocated_rnti.has(ue.id)) {
            const rnti = this.allocated_rnti.get(ue.id);
            this.rnti_pool.add(rnti);
            this.allocated_rnti.delete(ue.id);
            
            // Retirer l'UE de la liste des UEs connectés
            const index = this.connected_ues.indexOf(ue);
            if (index !== -1) {
                this.connected_ues.splice(index, 1);
            }
        }
    }
    
    /**
     * Ajoute un paquet au buffer DL pour l'UE spécifié
     */
    add_dl_packet(ue_id, packet) {
        if (this.dl_buffers.has(ue_id)) {
            const success = this.dl_buffers.get(ue_id).add_packet(packet);
            if (!success) {
                this.stats.packets_dropped++;
            }
            return success;
        }
        return false;
    }
    
    /**
     * Exécute l'algorithme de scheduling pour allouer les resource blocks
     */
    run_scheduler(current_time) {
        // Collecter les UEs ayant des données à transmettre (DL ou UL)
        const active_ues = [];
        
        // UEs avec données DL
        for (const ue of this.connected_ues) {
            if (this.dl_buffers.has(ue.id) && !this.dl_buffers.get(ue.id).is_empty()) {
                active_ues.push({ ue, direction: 'DL' });
            }
        }
        
        // UEs avec données UL
        for (const ue of this.connected_ues) {
            if (!ue.ul_buffer.is_empty()) {
                active_ues.push({ ue, direction: 'UL' });
            }
        }
        
        // Exécuter le scheduler pour attribuer les RBs
        const allocations = this.scheduler ? this.scheduler.allocate(active_ues, current_time) : [];
        
        // Traiter les allocations (transmettre les paquets)
        this._process_allocations(allocations, current_time);
        
        // Collecter statistiques
        this.stats.rnti_usage.push({
            time: current_time,
            used: this.allocated_rnti.size,
            total: this.rnti_pool_size
        });
        
        this.stats.connected_ues_count.push({
            time: current_time,
            count: this.connected_ues.length
        });
    }
    
    /**
     * Traite les allocations de RBs en transmettant les paquets
     */
    _process_allocations(allocations, current_time) {
        for (const { ue, direction, num_rbs } of allocations) {
            // Calculer la quantité de données pouvant être transmises avec ces RBs
            const data_capacity = num_rbs * simulationState.config.R_RB;
            
            if (direction === 'DL') {
                // Transmission DL (eNB -> UE)
                const buffer = this.dl_buffers.get(ue.id);
                if (buffer) {
                    const transmitted_packets = buffer.get_packets_for_transmission(data_capacity);
                    
                    for (const packet of transmitted_packets) {
                        // Enregistrer les statistiques de transmission
                        packet.transmission_time = current_time;
                        this.stats.packets_transmitted++;
                        this.stats.total_throughput += packet.size;
                        
                        // Notifier l'UE de la réception
                        ue.receive_packet(packet, current_time);
                    }
                }
            } else if (direction === 'UL') {
                // Transmission UL (UE -> eNB)
                const transmitted_packets = ue.transmit_packets(data_capacity, current_time);
                
                for (const packet of transmitted_packets) {
                    // Enregistrer les statistiques de transmission
                    packet.transmission_time = current_time;
                    this.stats.packets_transmitted++;
                    this.stats.total_throughput += packet.size;
                }
            }
        }
    }
    
    /**
     * Récupère les statistiques d'utilisation du pool RNTI
     */
    get_rnti_usage_stats(time_window = null) {
        let usage_data = this.stats.rnti_usage;
        
        if (time_window !== null) {
            // Filtrer par fenêtre temporelle
            const start_time = time_window[0];
            const end_time = time_window[1];
            usage_data = usage_data.filter(d => d.time >= start_time && d.time <= end_time);
        }
        
        if (usage_data.length === 0) return { avg: 0, max: 0, min: 0 };
        
        const usage_percentages = usage_data.map(d => (d.used / d.total) * 100);
        
        return {
            avg: usage_percentages.reduce((a, b) => a + b, 0) / usage_percentages.length,
            max: Math.max(...usage_percentages),
            min: Math.min(...usage_percentages),
            data: usage_data
        };
    }
}

/**
 * Classe représentant un équipement utilisateur (UE)
 */
class UserEquipment {
    constructor(id, x, y, config) {
        this.id = id;
        this.x = x;
        this.y = y;
        
        // État ECM et timers
        this.ecm_state = ECMState.IDLE;
        this.idle_timer = null;
        
        // Association eNB
        this.serving_enb = null;
        
        // Buffer UL
        this.ul_buffer = new Buffer(config.B_size);
        
        // Profil de trafic
        this.traffic_profile = null;
        
        // Statistiques énergétiques
        this.energy_consumption = 0;
        this.time_in_idle = 0;
        this.time_in_connected = 0;
        this.last_state_change_time = 0;
        
        // Statistiques de paquets
        this.dl_packets_received = 0;
        this.ul_packets_transmitted = 0;
        this.total_dl_bits = 0;
        this.total_ul_bits = 0;
        
        // Statistiques de latence
        this.idle_to_connected_latencies = [];
        this.queuing_latencies = [];
        this.first_packet_latencies = [];
        
        // Pour la visualisation
        this.last_position_update = 0;
        this.is_active = false;
    }
    
    /**
     * Associe l'UE à un profil de trafic
     */
    set_traffic_profile(profile_name) {
        this.traffic_profile = profile_name;
    }
    
    /**
     * Calcule la distance à un autre objet (eNB ou UE)
     */
    distance_to(other) {
        return Math.sqrt(Math.pow(this.x - other.x, 2) + Math.pow(this.y - other.y, 2));
    }
    
    /**
     * Effectue la transition vers l'état CONNECTED
     */
    transition_to_connected(current_time) {
        // Mesurer la latence de transition
        if (this.ecm_state === ECMState.IDLE) {
            const transition_start = this.last_state_change_time;
            const latency = current_time - transition_start;
            this.idle_to_connected_latencies.push(latency);
        }
        
        // Mettre à jour les statistiques de temps dans les états
        const time_delta = current_time - this.last_state_change_time;
        if (this.ecm_state === ECMState.IDLE) {
            this.time_in_idle += time_delta;
        }
        
        // Demander l'allocation d'un RNTI
        const success = this.serving_enb.allocate_rnti(this);
        
        if (success) {
            // Changer l'état
            this.ecm_state = ECMState.CONNECTED;
            this.last_state_change_time = current_time;
            
            // Réinitialiser le timer d'inactivité
            this.idle_timer = current_time + simulationState.config.T_inactivity_C_I;
            
            // Marquer comme actif pour la visualisation
            this.is_active = true;
            
            return true;
        } else {
            // L'allocation a échoué (pas de RNTI disponible)
            return false;
        }
    }
    
    /**
     * Effectue la transition vers l'état IDLE
     */
    transition_to_idle(current_time) {
        // Mettre à jour les statistiques de temps dans les états
        const time_delta = current_time - this.last_state_change_time;
        if (this.ecm_state === ECMState.CONNECTED) {
            this.time_in_connected += time_delta;
        }
        
        // Libérer le RNTI
        this.serving_enb.release_rnti(this);
        
        // Changer l'état
        this.ecm_state = ECMState.IDLE;
        this.last_state_change_time = current_time;
        this.idle_timer = null;
        
        return true;
    }
    
    /**
     * Réinitialise le timer d'inactivité
     */
    reset_idle_timer(current_time) {
        if (this.ecm_state === ECMState.CONNECTED) {
            this.idle_timer = current_time + simulationState.config.T_inactivity_C_I;
        }
    }
    
    /**
     * Ajoute un paquet au buffer UL
     */
    add_ul_packet(packet) {
        return this.ul_buffer.add_packet(packet);
    }
    
    /**
     * Traite un paquet reçu en DL
     */
    receive_packet(packet, current_time) {
        // Calculer la latence de file d'attente
        const queuing_latency = current_time - packet.creation_time;
        this.queuing_latencies.push(queuing_latency);
        
        // Mettre à jour les statistiques
        this.dl_packets_received++;
        this.total_dl_bits += packet.size;
        
        // Réinitialiser le timer d'inactivité
        this.reset_idle_timer(current_time);
        
        // Mettre à jour la consommation d'énergie (surcoût de réception)
        this.energy_consumption += simulationState.config.P_Rx_Active * simulationState.config.TTI;
    }
    
    /**
     * Transmet des paquets du buffer UL selon la capacité disponible
     */
    transmit_packets(data_capacity, current_time) {
        // Réinitialiser le timer d'inactivité
        this.reset_idle_timer(current_time);
        
        // Extraire les paquets à transmettre
        const packets = this.ul_buffer.get_packets_for_transmission(data_capacity);
        
        // Mettre à jour les statistiques
        this.ul_packets_transmitted += packets.length;
        for (const packet of packets) {
            this.total_ul_bits += packet.size;
            
            // Calculer la latence de file d'attente
            const queuing_latency = current_time - packet.creation_time;
            this.queuing_latencies.push(queuing_latency);
        }
        
        // Mettre à jour la consommation d'énergie (surcoût de transmission)
        if (packets.length > 0) {
            this.energy_consumption += simulationState.config.P_Tx_Active * simulationState.config.TTI;
        }
        
        return packets;
    }
    
    /**
     * Met à jour la consommation d'énergie selon l'état actuel
     */
    update_energy_consumption(current_time, last_update_time) {
        const time_delta = current_time - last_update_time;
        
        if (this.ecm_state === ECMState.IDLE) {
            // Consommation en état IDLE
            this.energy_consumption += simulationState.config.P_Idle * time_delta;
        } else {
            // Consommation de base en état CONNECTED
            this.energy_consumption += simulationState.config.P_Connected_Base * time_delta;
        }
    }
    
    /**
     * Met à jour la position de l'UE (pour les modèles de mobilité)
     */
    update_position(current_time, config) {
        if (config.Mobility_Model === 'Static') return;
        
        // Modèle Random Waypoint simplifié pour la zone circulaire
        if (config.Mobility_Model === 'RandomWaypointInCircle') {
            const time_delta = current_time - this.last_position_update;
            
            // Vitesse aléatoire (m/s)
            const speed = 1 + Math.random() * 4; // Entre 1 et 5 m/s
            
            // Distance parcourue (km)
            const distance = (speed * time_delta) / 1000;
            
            // Direction aléatoire (radians)
            const angle = Math.random() * Math.PI * 2;
            
            // Nouvelles coordonnées
            let new_x = this.x + distance * Math.cos(angle);
            let new_y = this.y + distance * Math.sin(angle);
            
            // Vérifier si les nouvelles coordonnées sont dans le cercle
            const distance_from_center = Math.sqrt(new_x * new_x + new_y * new_y);
            if (distance_from_center > config.R) {
                // Rebond sur le bord (réflexion)
                const norm_x = new_x / distance_from_center;
                const norm_y = new_y / distance_from_center;
                
                new_x = (2 * config.R - distance_from_center) * norm_x;
                new_y = (2 * config.R - distance_from_center) * norm_y;
            }
            
            this.x = new_x;
            this.y = new_y;
            this.last_position_update = current_time;
        }
    }
    
    /**
     * Calcule et retourne le débit moyen
     */
    get_average_throughput() {
        const total_bits = this.total_dl_bits + this.total_ul_bits;
        const active_time = this.time_in_connected;
        
        if (active_time > 0) {
            return total_bits / active_time; // bits/s
        }
        
        return 0;
    }
}

/**
 * Classe représentant un buffer de paquets
 */
class Buffer {
    constructor(size) {
        this.max_size = size;
        this.packets = [];
        this.total_size = 0;
        
        // Statistiques
        this.stats = {
            added_packets: 0,
            rejected_packets: 0,
            occupancy_history: [] // [{time, occupancy_ratio}]
        };
    }
    
    /**
     * Ajoute un paquet au buffer
     */
    add_packet(packet) {
        this.stats.added_packets++;
        
        // Vérifier si le buffer a assez d'espace
        if (this.packets.length < this.max_size) {
            this.packets.push(packet);
            this.total_size += packet.size;
            return true;
        }
        
        // Buffer plein, paquet rejeté
        this.stats.rejected_packets++;
        return false;
    }
    
    /**
     * Vérifie si le buffer est vide
     */
    is_empty() {
        return this.packets.length === 0;
    }
    
    /**
     * Récupère les paquets pour la transmission selon la capacité disponible
     */
    get_packets_for_transmission(data_capacity) {
        const transmitted_packets = [];
        let remaining_capacity = data_capacity;
        
        while (this.packets.length > 0 && remaining_capacity >= this.packets[0].size) {
            const packet = this.packets.shift();
            transmitted_packets.push(packet);
            remaining_capacity -= packet.size;
            this.total_size -= packet.size;
        }
        
        return transmitted_packets;
    }
    
    /**
     * Enregistre l'état d'occupation du buffer à un instant donné
     */
    record_occupancy(time) {
        const occupancy_ratio = this.packets.length / this.max_size;
        this.stats.occupancy_history.push({
            time,
            occupancy_ratio
        });
    }
    
    /**
     * Retourne le taux d'occupation actuel
     */
    get_occupancy_ratio() {
        return this.packets.length / this.max_size;
    }
}

/**
 * Classe représentant un paquet de données
 */
class Packet {
    constructor(id, source_id, destination_id, size, creation_time) {
        this.id = id;
        this.source_id = source_id;
        this.destination_id = destination_id;
        this.size = size;  // En bits
        this.creation_time = creation_time;
        this.transmission_time = null;  // À remplir lors de la transmission
    }
    
    /**
     * Calcule la latence totale du paquet
     */
    get_latency() {
        if (this.transmission_time === null) return null;
        return this.transmission_time - this.creation_time;
    }
}

/**
 * Classe abstraite représentant un algorithme d'ordonnancement
 */
class Scheduler {
    constructor() {
        this.config = simulationState.config;
    }
    
    allocate(active_ues, current_time) {
        // Méthode abstraite à implémenter dans les sous-classes
        throw new Error("La méthode allocate doit être implémentée par les sous-classes");
    }
}

/**
 * Implémentation du scheduler Round Robin
 */
class RoundRobinScheduler extends Scheduler {
    constructor() {
        super();
        this.last_allocated_index = -1;
    }
    
    allocate(active_ues, current_time) {
        if (!active_ues.length) return [];
        
        const allocations = [];
        const num_active = active_ues.length;
        
        // Nombre de RBs par UE (au moins 1 si possible)
        const rb_per_ue = Math.max(1, Math.floor(this.config.N_RB / num_active));
        
        // Allouer les RBs de manière équitable
        let remaining_rbs = this.config.N_RB;
        
        for (let i = 0; i < num_active; i++) {
            // Index circulaire à partir du dernier alloué
            const index = (this.last_allocated_index + 1 + i) % num_active;
            const { ue, direction } = active_ues[index];
            
            // Nombre de RBs à allouer à cet UE
            const rbs = Math.min(rb_per_ue, remaining_rbs);
            if (rbs > 0) {
                allocations.push({ ue, direction, num_rbs: rbs });
                remaining_rbs -= rbs;
            }
            
            // Mettre à jour le dernier index alloué
            this.last_allocated_index = index;
        }
        
        return allocations;
    }
}

/**
 * Implémentation du scheduler Proportional Fair
 */
class ProportionalFairScheduler extends Scheduler {
    constructor() {
        super();
        this.average_throughputs = new Map(); // UE ID -> throughput moyen historique
    }
    
    allocate(active_ues, current_time) {
        if (!active_ues.length) return [];
        
        const allocations = [];
        
        // Calculer les métriques PF pour chaque UE actif
        const pf_metrics = [];
        
        for (let i = 0; i < active_ues.length; i++) {
            const { ue, direction } = active_ues[i];
            
            // Estimation du débit instantané potentiel
            // (simplifié, en pratique dépendrait de la qualité du canal)
            const instantaneous_throughput = this.config.R_RB;
            
            // Récupérer le débit historique moyen ou initialiser à une petite valeur
            if (!this.average_throughputs.has(ue.id)) {
                this.average_throughputs.set(ue.id, instantaneous_throughput / 10.0);
            }
            
            // Calculer la métrique PF
            const average_throughput = this.average_throughputs.get(ue.id);
            const pf_metric = instantaneous_throughput / average_throughput;
            
            pf_metrics.push({ index: i, pf_metric });
        }
        
        // Trier les UEs par métrique PF décroissante
        pf_metrics.sort((a, b) => b.pf_metric - a.pf_metric);
        
        // Allouer les RBs en commençant par l'UE avec la plus haute métrique PF
        let remaining_rbs = this.config.N_RB;
        
        for (const { index } of pf_metrics) {
            if (remaining_rbs > 0) {
                const { ue, direction } = active_ues[index];
                
                // Allouer un nombre de RBs proportionnel à la métrique
                // (simplifié, en pratique plus complexe)
                const rbs = Math.max(1, Math.min(remaining_rbs, Math.floor(this.config.N_RB / active_ues.length)));
                
                allocations.push({ ue, direction, num_rbs: rbs });
                remaining_rbs -= rbs;
                
                // Mettre à jour le débit moyen historique
                const alpha = 1.0 / this.config.W_PF; // Facteur d'oubli
                const old_avg = this.average_throughputs.get(ue.id);
                const new_throughput = rbs * this.config.R_RB;
                this.average_throughputs.set(
                    ue.id,
                    (1 - alpha) * old_avg + alpha * new_throughput
                );
            }
        }
        
        return allocations;
    }
}

/**
 * Classe pour la génération de trafic selon des profils utilisateur
 */
class TrafficGenerator {
    constructor(config) {
        this.config = config;
        this.packet_id_counter = 0;
    }
    
    /**
     * Génère l'activité pour un UE à un instant donné
     */
    generate_activity(ue, current_time) {
        const profile_name = ue.traffic_profile;
        
        if (!profile_name || !this.config.ActivityModel[profile_name]) {
            return { ul_packets: [], dl_packets: [] };
        }
        
        const profile = this.config.ActivityModel[profile_name];
        
        // Déterminer l'heure de la journée
        const hour = (current_time / 3600) % 24;
        
        // Trouver si l'UE est dans une période d'activité
        let activity_level = 0;
        for (const period of profile) {
            let startHour = period.startHour;
            let endHour = period.endHour;
            
            // Gestion des périodes qui traversent minuit
            if (endHour < startHour) endHour += 24;
            
            // Vérifier si l'heure actuelle est dans cette période
            let current_hour = hour;
            if (startHour > endHour && hour < startHour) current_hour += 24;
            
            if (current_hour >= startHour && current_hour <= endHour) {
                // Calculer le niveau d'activité (décroît à mesure qu'on s'approche des bords)
                const center = (startHour + endHour) / 2;
                const distance_from_center = Math.abs(current_hour - center);
                const half_width = (endHour - startHour) / 2;
                
                // Niveau d'activité décroît linéairement du centre vers les bords
                const normalized_activity = Math.max(0, 1 - distance_from_center / half_width);
                
                // Ajouter une composante aléatoire
                activity_level = Math.max(
                    activity_level,
                    period.peakLevel * normalized_activity * (0.8 + Math.random() * 0.4)
                );
            }
        }
        
        // Si pas d'activité, retourner tableau vide
        if (activity_level < 0.1 || Math.random() > activity_level) {
            return { ul_packets: [], dl_packets: [] };
        }
        
        // Générer paquets UL/DL selon le niveau d'activité
        const ul_packets = this._generate_packets(ue.id, "UL", activity_level, current_time);
        const dl_packets = this._generate_packets(ue.id, "DL", activity_level, current_time);
        
        return { ul_packets, dl_packets };
    }
    
    /**
     * Génère des paquets dans une direction donnée
     */
    _generate_packets(ue_id, direction, activity_level, current_time) {
        const packets = [];
        
        // Nombre de paquets à générer (fonction du niveau d'activité)
        const packet_count = Math.floor(activity_level * 5) * (Math.random() < 0.3 ? 1 : 0);
        
        for (let i = 0; i < packet_count; i++) {
            // Taille de paquet variable selon la direction et l'activité
            let size;
            if (direction === "UL") {
                // Paquets UL plus petits en moyenne
                size = 64 + Math.floor(Math.random() * 1000 * activity_level);
            } else {
                // Paquets DL plus grands en moyenne
                size = 128 + Math.floor(Math.random() * 2000 * activity_level);
            }
            
            // Créer le paquet
            const packet_id = this.packet_id_counter++;
            const source_id = direction === "UL" ? ue_id : -1; // -1 pour le réseau
            const destination_id = direction === "UL" ? -1 : ue_id;
            
            packets.push(new Packet(packet_id, source_id, destination_id, size * 8, current_time));
        }
        
        return packets;
    }
}

/**
 * Classe principale pour la simulation d'un réseau 4G/LTE
 */
class NetworkSimulator {
    constructor(config, scenario) {
        this.config = config;
        this.scenario = scenario; // 'A1', 'A2', 'B1', 'B2'
        this.current_time = 0;
        this.enbs = [];
        this.ues = [];
        this.traffic_generator = new TrafficGenerator(config);
        this.stats_collector = new SimulationStatsCollector();
        
        // Déterminer le mode ECM et l'algorithme de scheduling
        this.ecm_mode = this.scenario.startsWith('A') ? 'With ECM' : 'Without ECM';
        this.scheduler_algo = this.scenario.endsWith('1') ? 'RR' : 'PF';
        
        // Initialisation
        this._initialize_topology();
        this._assign_traffic_profiles();
    }
    
    /**
     * Initialise la topologie du réseau avec des eNBs et UEs
     */
    _initialize_topology() {
        // Créer les eNodeBs
        for (let i = 0; i < this.config.N_eNB; i++) {
            // Générer une position selon une distribution gaussienne 2D
            let x, y;
            do {
                x = this._gaussian_random(0, this.config.sigma_eNB);
                y = this._gaussian_random(0, this.config.sigma_eNB);
            } while (Math.sqrt(x * x + y * y) > this.config.R);
            
            const enb = new ENodeB(i, x, y, this.config);
            enb.setup_scheduler(this.scheduler_algo);
            this.enbs.push(enb);
        }
        
        // Créer les UEs
        // Note: on simule un nombre réduit d'UEs pour des raisons de performance
        // Le facteur de réduction permet de garder les proportions tout en limitant la charge
        const ue_reduction_factor = 50; // Simule 1 UE sur X
        const n_ue_simulated = Math.ceil(this.config.N_UE / ue_reduction_factor);
        
        for (let i = 0; i < n_ue_simulated; i++) {
            // Générer une position selon une distribution gaussienne 2D
            let x, y;
            do {
                x = this._gaussian_random(0, this.config.sigma_UE);
                y = this._gaussian_random(0, this.config.sigma_UE);
            } while (Math.sqrt(x * x + y * y) > this.config.R);
            
            const ue = new UserEquipment(i, x, y, this.config);
            this.ues.push(ue);
        }
        
        // Associer chaque UE à l'eNB le plus proche
        for (const ue of this.ues) {
            let closest_enb = null;
            let min_distance = Infinity;
            
            for (const enb of this.enbs) {
                const distance = ue.distance_to(enb);
                if (distance < min_distance) {
                    min_distance = distance;
                    closest_enb = enb;
                }
            }
            
            closest_enb.register_ue(ue);
        }
    }
    
    /**
     * Assigne un profil de trafic à chaque UE
     */
    _assign_traffic_profiles() {
        const profiles = Object.keys(this.config.Profile_Distribution);
        const probabilities = Object.values(this.config.Profile_Distribution);
        
        for (const ue of this.ues) {
            // Sélectionner un profil selon la distribution de probabilité
            const profile = this._select_weighted_random(profiles, probabilities);
            ue.set_traffic_profile(profile);
        }
    }
    
    /**
     * Sélectionne un élément aléatoirement selon une distribution de probabilité
     */
    _select_weighted_random(items, weights) {
        const random = Math.random();
        let cumulative_weight = 0;
        
        for (let i = 0; i < items.length; i++) {
            cumulative_weight += weights[i];
            if (random < cumulative_weight) {
                return items[i];
            }
        }
        
        return items[items.length - 1];
    }
    
    /**
     * Génère un nombre aléatoire selon une distribution gaussienne
     */
    _gaussian_random(mean, stdev) {
        const u = 1 - Math.random(); // Converting [0,1) to (0,1]
        const v = Math.random();
        const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
        return z * stdev + mean;
    }
    
    /**
     * Initialise les UEs selon le mode ECM
     */
    _initialize_ue_states() {
        for (const ue of this.ues) {
            if (this.ecm_mode === 'Without ECM') {
                // En mode sans ECM, tous les UEs commencent en CONNECTED
                ue.ecm_state = ECMState.CONNECTED;
                ue.serving_enb.allocate_rnti(ue);
                ue.is_active = true;
            } else {
                // En mode avec ECM, tous les UEs commencent en IDLE
                ue.ecm_state = ECMState.IDLE;
                ue.is_active = false;
            }
            
            ue.last_state_change_time = 0;
        }
    }
    
    /**
     * Exécute la simulation pour une étape de temps
     */
    step(time_step) {
        // Mettre à jour l'horloge
        const previous_time = this.current_time;
        this.current_time += time_step;
        
        // Mettre à jour les positions des UEs (mobilité)
        if (this.config.Mobility_Model !== 'Static') {
            for (const ue of this.ues) {
                ue.update_position(this.current_time, this.config);
            }
        }
        
        // Générer le trafic
        this._generate_traffic();
        
        // Exécuter le scheduling pour chaque eNB
        for (const enb of this.enbs) {
            enb.run_scheduler(this.current_time);
        }
        
        // Mettre à jour les consommations énergétiques des UEs
        for (const ue of this.ues) {
            ue.update_energy_consumption(this.current_time, previous_time);
        }
        
        // Vérifier les timers d'inactivité (mode avec ECM)
        if (this.ecm_mode === 'With ECM') {
            this._check_inactivity_timers();
        }
        
        // Collecter les statistiques
        this._collect_statistics();
        
        // Retourner l'heure actuelle
        return this.current_time;
    }
    
    /**
     * Génère le trafic pour tous les UEs
     */
    _generate_traffic() {
        for (const ue of this.ues) {
            const { ul_packets, dl_packets } = this.traffic_generator.generate_activity(ue, this.current_time);
            
            // Traiter les paquets UL
            for (const packet of ul_packets) {
                // Si l'UE est en IDLE et qu'on est en mode "Avec ECM", transition vers CONNECTED
                if (this.ecm_mode === 'With ECM' && ue.ecm_state === ECMState.IDLE) {
                    // Transition IDLE -> CONNECTED
                    setTimeout(() => {
                        ue.transition_to_connected(this.current_time + this.config.L_RRC_Setup);
                    }, 0);
                    
                    // Mettre le paquet dans le buffer en attendant
                    ue.add_ul_packet(packet);
                } else {
                    // L'UE est déjà CONNECTED, ajouter simplement le paquet au buffer
                    ue.add_ul_packet(packet);
                }
            }
            
            // Traiter les paquets DL
            for (const packet of dl_packets) {
                // Si l'UE est en IDLE et qu'on est en mode "Avec ECM", paging
                if (this.ecm_mode === 'With ECM' && ue.ecm_state === ECMState.IDLE) {
                    // Paging puis transition IDLE -> CONNECTED
                    setTimeout(() => {
                        const new_time = this.current_time + this.config.L_Paging + this.config.L_RRC_Setup;
                        if (ue.transition_to_connected(new_time)) {
                            // Transition réussie, ajouter le paquet au buffer DL
                            ue.serving_enb.add_dl_packet(ue.id, packet);
                        }
                    }, 0);
                } else {
                    // L'UE est déjà CONNECTED, ajouter simplement le paquet au buffer DL
                    ue.serving_enb.add_dl_packet(ue.id, packet);
                }
            }
        }
    }
    
    /**
     * Vérifie les timers d'inactivité et fait transitionner les UEs vers IDLE si nécessaire
     */
    _check_inactivity_timers() {
        if (this.ecm_mode !== 'With ECM') return;
        
        for (const ue of this.ues) {
            if (ue.ecm_state === ECMState.CONNECTED && ue.idle_timer !== null && this.current_time >= ue.idle_timer) {
                // Le timer est expiré, transition vers IDLE
                setTimeout(() => {
                    ue.transition_to_idle(this.current_time + this.config.L_RRC_Release);
                }, 0);
            }
        }
    }
    
    /**
     * Collecte les statistiques de la simulation
     */
    _collect_statistics() {
        // Statistiques RNTI
        for (const enb of this.enbs) {
            this.stats_collector.record_rnti_usage(
                this.current_time,
                enb.id,
                enb.allocated_rnti.size,
                enb.rnti_pool_size
            );
            
            this.stats_collector.record_connected_ues(
                this.current_time,
                enb.id,
                enb.connected_ues.length
            );
            
            // Enregistrer l'occupation des buffers DL
            for (const [ue_id, buffer] of enb.dl_buffers.entries()) {
                buffer.record_occupancy(this.current_time);
                this.stats_collector.record_buffer_occupancy(
                    this.current_time,
                    `DL_${enb.id}_${ue_id}`,
                    buffer.get_occupancy_ratio()
                );
            }
        }
        
        // Statistiques UE
        for (const ue of this.ues) {
            // Enregistrer l'état ECM
            this.stats_collector.record_ecm_state(
                this.current_time,
                ue.id,
                ue.ecm_state
            );
            
            // Enregistrer l'occupation du buffer UL
            ue.ul_buffer.record_occupancy(this.current_time);
            this.stats_collector.record_buffer_occupancy(
                this.current_time,
                `UL_${ue.id}`,
                ue.ul_buffer.get_occupancy_ratio()
            );
            
            // Enregistrer la consommation énergétique
            this.stats_collector.record_energy(
                this.current_time,
                ue.id,
                ue.energy_consumption
            );
        }
        
        // Statistiques réseau globales
        let total_throughput = 0;
        for (const enb of this.enbs) {
            total_throughput += enb.stats.total_throughput;
        }
        
        this.stats_collector.record_network_throughput(
            this.current_time,
            total_throughput
        );
    }
    
    /**
     * Exécute la simulation complète
     */
    run_simulation(callback) {
        // Initialiser les états des UEs
        this._initialize_ue_states();
        
        // Réinitialiser le temps de simulation
        this.current_time = 0;
        
        // Phase de chauffe
        console.log(`Début de la phase de chauffe (${this.config.T_warmup}s)`);
        
        const warmup_steps = 100; // Nombre d'étapes pour la phase de chauffe
        const warmup_step_size = this.config.T_warmup / warmup_steps;
        
        // Boucle de simulation avec utilisation de setTimeout pour ne pas bloquer l'UI
        const run_warmup_step = (current_step) => {
            if (current_step >= warmup_steps) {
                // Fin de la phase de chauffe
                console.log("Fin de la phase de chauffe");
                
                // Réinitialiser les statistiques
                this.stats_collector.reset();
                
                // Lancer la simulation principale
                this._run_main_simulation(callback);
                return;
            }
            
            // Exécuter une étape de simulation
            this.step(warmup_step_size);
            
            // Mettre à jour la progression
            const warmup_progress = (current_step / warmup_steps) * 10; // 0-10%
            callback(warmup_progress);
            
            // Planifier la prochaine étape
            setTimeout(() => run_warmup_step(current_step + 1), 0);
        };
        
        // Démarrer la phase de chauffe
        run_warmup_step(0);
    }
    
    /**
     * Exécute la simulation principale après la phase de chauffe
     */
    _run_main_simulation(callback) {
        console.log(`Début de la simulation principale (${this.config.T_sim}s)`);
        
        const main_steps = 500; // Nombre d'étapes pour la simulation principale
        const main_step_size = this.config.T_sim / main_steps;
        
        // Boucle de simulation principale
        const run_main_step = (current_step) => {
            if (current_step >= main_steps) {
                // Fin de la simulation principale
                console.log("Fin de la simulation principale");
                
                // Analyser les résultats
                const results = this.stats_collector.analyze(this.ues, this.enbs, {
                    ecm_mode: this.ecm_mode,
                    scheduler_algo: this.scheduler_algo
                });
                
                // Appeler le callback avec 100% de progression et les résultats
                callback(100, results);
                return;
            }
            
            // Exécuter une étape de simulation
            this.step(main_step_size);
            
            // Mettre à jour la progression (10-100%)
            const main_progress = 10 + (current_step / main_steps) * 90;
            callback(main_progress);
            
            // Planifier la prochaine étape
            setTimeout(() => run_main_step(current_step + 1), 0);
        };
        
        // Démarrer la simulation principale
        run_main_step(0);
    }
    
    /**
     * Retourne une capture de l'état actuel pour la visualisation
     */
    get_visualization_snapshot() {
        return {
            time: this.current_time,
            enbs: this.enbs.map(enb => ({
                id: enb.id,
                x: enb.x,
                y: enb.y,
                connected_ues: enb.connected_ues.length,
                rnti_usage: enb.allocated_rnti.size / enb.rnti_pool_size
            })),
            ues: this.ues.map(ue => ({
                id: ue.id,
                x: ue.x,
                y: ue.y,
                ecm_state: ue.ecm_state,
                serving_enb_id: ue.serving_enb ? ue.serving_enb.id : null,
                is_active: ue.is_active
            }))
        };
    }
}

/**
 * Classe pour collecter et analyser les statistiques de simulation
 */
class SimulationStatsCollector {
    constructor() {
        this.reset();
    }
    
    /**
     * Réinitialise toutes les statistiques
     */
    reset() {
        // Statistiques RNTI
        this.rnti_usage = []; // [{time, enb_id, used, total}]
        this.connected_ues = []; // [{time, enb_id, count}]
        
        // Statistiques énergétiques
        this.energy_consumption = []; // [{time, ue_id, energy}]
        
        // Statistiques d'états ECM
        this.ecm_states = []; // [{time, ue_id, state}]
        
        // Statistiques de buffers
        this.buffer_occupancy = []; // [{time, buffer_id, occupancy_ratio}]
        
        // Statistiques de débit
        this.network_throughput = []; // [{time, throughput}]
    }
    
    /**
     * Enregistre l'utilisation des RNTI
     */
    record_rnti_usage(time, enb_id, used, total) {
        this.rnti_usage.push({ time, enb_id, used, total });
    }
    
    /**
     * Enregistre le nombre d'UEs connectés
     */
    record_connected_ues(time, enb_id, count) {
        this.connected_ues.push({ time, enb_id, count });
    }
    
    /**
     * Enregistre la consommation énergétique
     */
    record_energy(time, ue_id, energy) {
        this.energy_consumption.push({ time, ue_id, energy });
    }
    
    /**
     * Enregistre l'état ECM
     */
    record_ecm_state(time, ue_id, state) {
        this.ecm_states.push({ time, ue_id, state });
    }
    
    /**
     * Enregistre l'occupation d'un buffer
     */
    record_buffer_occupancy(time, buffer_id, occupancy_ratio) {
        this.buffer_occupancy.push({ time, buffer_id, occupancy_ratio });
    }
    
    /**
     * Enregistre le débit réseau global
     */
    record_network_throughput(time, throughput) {
        this.network_throughput.push({ time, throughput });
    }
    
    /**
     * Analyse les statistiques collectées et génère un rapport
     */
    analyze(ues, enbs, config) {
        // Résultats à retourner
        const results = {
            rnti: this._analyze_rnti_stats(enbs),
            energy: this._analyze_energy_stats(ues),
            latency: this._analyze_latency_stats(ues),
            throughput: this._analyze_throughput_stats(ues, enbs),
            time_series: {
                rnti_usage: this._process_time_series(this.rnti_usage, 'enb_id', 'used', 'total'),
                connected_ues: this._process_time_series(this.connected_ues, 'enb_id', 'count'),
                energy: this._process_time_series(this.energy_consumption, 'ue_id', 'energy'),
                ecm_states: this._process_ecm_states(),
                buffer_occupancy: this._process_buffer_occupancy(),
                network_throughput: this._format_time_series(this.network_throughput)
            },
            raw_data: {
                ues: ues.map(ue => ({
                    id: ue.id,
                    energy_consumption: ue.energy_consumption,
                    time_in_idle: ue.time_in_idle,
                    time_in_connected: ue.time_in_connected,
                    idle_to_connected_latencies: ue.idle_to_connected_latencies,
                    queuing_latencies: ue.queuing_latencies,
                    first_packet_latencies: ue.first_packet_latencies,
                    total_dl_bits: ue.total_dl_bits,
                    total_ul_bits: ue.total_ul_bits,
                    traffic_profile: ue.traffic_profile
                })),
                enbs: enbs.map(enb => ({
                    id: enb.id,
                    unique_ues_served: enb.stats.unique_ues_served.size,
                    packets_transmitted: enb.stats.packets_transmitted,
                    packets_dropped: enb.stats.packets_dropped,
                    total_throughput: enb.stats.total_throughput
                }))
            },
            config: config
        };
        
        return results;
    }
    
    /**
     * Analyse les statistiques RNTI
     */
    _analyze_rnti_stats(enbs) {
        const stats = {
            avg_connected_ues_per_enb: 0,
            max_connected_ues_per_enb: 0,
            avg_unique_ues_per_enb: 0,
            avg_rnti_usage: 0,
            max_rnti_usage: 0,
            per_enb: {}
        };
        
        // Statistiques par eNB
        for (const enb of enbs) {
            // Extraire les données pour cet eNB
            const enb_connected = this.connected_ues.filter(d => d.enb_id === enb.id);
            const enb_rnti = this.rnti_usage.filter(d => d.enb_id === enb.id);
            
            if (enb_connected.length === 0 || enb_rnti.length === 0) {
                continue;
            }
            
            // Statistiques des UEs connectés
            const connected_counts = enb_connected.map(d => d.count);
            const avg_connected = connected_counts.reduce((a, b) => a + b, 0) / connected_counts.length;
            const max_connected = Math.max(...connected_counts);
            
            // Statistiques d'utilisation RNTI
            const rnti_usage = enb_rnti.map(d => d.used / d.total);
            const avg_rnti_usage = rnti_usage.reduce((a, b) => a + b, 0) / rnti_usage.length;
            const max_rnti_usage = Math.max(...rnti_usage);
            
            // Nombre d'UEs uniques servis
            const unique_ues_served = enb.stats.unique_ues_served.size;
            
            // Stocker les statistiques pour cet eNB
            stats.per_enb[enb.id] = {
                avg_connected_ues: avg_connected,
                max_connected_ues: max_connected,
                                unique_ues_served: unique_ues_served,
                avg_rnti_usage: avg_rnti_usage,
                max_rnti_usage: max_rnti_usage
            };
            
            // Contribuer aux statistiques globales
            stats.avg_connected_ues_per_enb += avg_connected;
            stats.max_connected_ues_per_enb = Math.max(stats.max_connected_ues_per_enb, max_connected);
            stats.avg_unique_ues_per_enb += unique_ues_served;
            stats.avg_rnti_usage += avg_rnti_usage;
            stats.max_rnti_usage = Math.max(stats.max_rnti_usage, max_rnti_usage);
        }
        
        // Calculer les moyennes globales
        const enb_count = Object.keys(stats.per_enb).length;
        if (enb_count > 0) {
            stats.avg_connected_ues_per_enb /= enb_count;
            stats.avg_unique_ues_per_enb /= enb_count;
            stats.avg_rnti_usage /= enb_count;
        }
        
        return stats;
    }
    
    /**
     * Analyse les statistiques énergétiques
     */
    _analyze_energy_stats(ues) {
        const stats = {
            avg_energy_per_ue: 0,
            std_energy_per_ue: 0,
            avg_idle_time_ratio: 0,
            energy_distribution: [],
            profile_energy: {}
        };
        
        // Collecter les données énergétiques pour tous les UEs
        const energy_values = [];
        const idle_time_ratios = [];
        const profile_energy = {};
        
        for (const ue of ues) {
            energy_values.push(ue.energy_consumption);
            
            const total_time = ue.time_in_idle + ue.time_in_connected;
            const idle_ratio = total_time > 0 ? ue.time_in_idle / total_time : 0;
            idle_time_ratios.push(idle_ratio);
            
            // Statistiques par profil
            const profile = ue.traffic_profile;
            if (!profile_energy[profile]) {
                profile_energy[profile] = {
                    energy_values: [],
                    idle_ratios: []
                };
            }
            
            profile_energy[profile].energy_values.push(ue.energy_consumption);
            profile_energy[profile].idle_ratios.push(idle_ratio);
        }
        
        // Calculer les statistiques globales
        if (energy_values.length > 0) {
            stats.avg_energy_per_ue = energy_values.reduce((a, b) => a + b, 0) / energy_values.length;
            
            // Écart-type
            const variance = energy_values.reduce((sum, val) => sum + Math.pow(val - stats.avg_energy_per_ue, 2), 0) / energy_values.length;
            stats.std_energy_per_ue = Math.sqrt(variance);
            
            stats.avg_idle_time_ratio = idle_time_ratios.reduce((a, b) => a + b, 0) / idle_time_ratios.length;
            stats.energy_distribution = energy_values;
        }
        
        // Calculer les statistiques par profil
        for (const profile in profile_energy) {
            const profile_data = profile_energy[profile];
            if (profile_data.energy_values.length > 0) {
                stats.profile_energy[profile] = {
                    avg_energy: profile_data.energy_values.reduce((a, b) => a + b, 0) / profile_data.energy_values.length,
                    avg_idle_ratio: profile_data.idle_ratios.reduce((a, b) => a + b, 0) / profile_data.idle_ratios.length
                };
            }
        }
        
        return stats;
    }
    
    /**
     * Analyse les statistiques de latence
     */
    _analyze_latency_stats(ues) {
        const stats = {
            idle_to_connected: {
                avg: 0,
                std: 0,
                min: Infinity,
                max: 0,
                median: 0,
                p95: 0,
                distribution: []
            },
            queuing: {
                avg: 0,
                std: 0,
                min: Infinity,
                max: 0,
                median: 0,
                p95: 0,
                distribution: []
            },
            first_packet: {
                avg: 0,
                std: 0,
                min: Infinity,
                max: 0,
                median: 0,
                p95: 0,
                distribution: []
            }
        };
        
        // Collecter toutes les latences
        const idle_to_connected_latencies = [];
        const queuing_latencies = [];
        const first_packet_latencies = [];
        
        for (const ue of ues) {
            idle_to_connected_latencies.push(...ue.idle_to_connected_latencies);
            queuing_latencies.push(...ue.queuing_latencies);
            first_packet_latencies.push(...ue.first_packet_latencies);
        }
        
        // Analyser chaque type de latence
        this._calculate_latency_stats(idle_to_connected_latencies, stats.idle_to_connected);
        this._calculate_latency_stats(queuing_latencies, stats.queuing);
        this._calculate_latency_stats(first_packet_latencies, stats.first_packet);
        
        return stats;
    }
    
    /**
     * Calcule les statistiques pour un ensemble de valeurs de latence
     */
    _calculate_latency_stats(latencies, stats_obj) {
        if (latencies.length === 0) {
            return;
        }
        
        // Trier les latences pour calculer les percentiles
        const sorted_latencies = [...latencies].sort((a, b) => a - b);
        
        // Moyenne
        stats_obj.avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        
        // Écart-type
        const variance = latencies.reduce((sum, val) => sum + Math.pow(val - stats_obj.avg, 2), 0) / latencies.length;
        stats_obj.std = Math.sqrt(variance);
        
        // Min/Max
        stats_obj.min = sorted_latencies[0];
        stats_obj.max = sorted_latencies[sorted_latencies.length - 1];
        
        // Médiane
        const mid = Math.floor(sorted_latencies.length / 2);
        stats_obj.median = sorted_latencies.length % 2 === 0
            ? (sorted_latencies[mid - 1] + sorted_latencies[mid]) / 2
            : sorted_latencies[mid];
        
        // 95ème percentile
        const p95_idx = Math.min(Math.floor(sorted_latencies.length * 0.95), sorted_latencies.length - 1);
        stats_obj.p95 = sorted_latencies[p95_idx];
        
        // Distribution complète
        stats_obj.distribution = latencies;
    }
    
    /**
     * Analyse les statistiques de débit et de satisfaction
     */
    _analyze_throughput_stats(ues, enbs) {
        const stats = {
            avg_goodput_per_ue: 0,
            std_goodput_per_ue: 0,
            total_network_throughput: 0,
            packet_delivery_ratio: 0,
            avg_buffer_occupancy: 0,
            max_buffer_occupancy: 0,
            goodput_distribution: []
        };
        
        // Calculer le débit utile (goodput) par UE
        const goodputs = [];
        for (const ue of ues) {
            const goodput = ue.get_average_throughput();
            goodputs.push(goodput);
        }
        
        // Calculer les statistiques de débit
        if (goodputs.length > 0) {
            stats.avg_goodput_per_ue = goodputs.reduce((a, b) => a + b, 0) / goodputs.length;
            
            // Écart-type
            const variance = goodputs.reduce((sum, val) => sum + Math.pow(val - stats.avg_goodput_per_ue, 2), 0) / goodputs.length;
            stats.std_goodput_per_ue = Math.sqrt(variance);
            
            stats.goodput_distribution = goodputs;
        }
        
        // Débit total du réseau
        let total_packets_transmitted = 0;
        let total_packets = 0;
        let total_throughput = 0;
        
        for (const enb of enbs) {
            total_packets_transmitted += enb.stats.packets_transmitted;
            total_packets += enb.stats.packets_transmitted + enb.stats.packets_dropped;
            total_throughput += enb.stats.total_throughput;
        }
        
        stats.total_network_throughput = total_throughput;
        
        // Packet Delivery Ratio
        stats.packet_delivery_ratio = total_packets > 0
            ? total_packets_transmitted / total_packets
            : 1.0;
        
        // Statistiques d'occupation des buffers
        const occupancy_ratios = this.buffer_occupancy.map(b => b.occupancy_ratio);
        
        if (occupancy_ratios.length > 0) {
            stats.avg_buffer_occupancy = occupancy_ratios.reduce((a, b) => a + b, 0) / occupancy_ratios.length;
            stats.max_buffer_occupancy = Math.max(...occupancy_ratios);
        }
        
        return stats;
    }
    
    /**
     * Traite les séries temporelles pour le format approprié aux graphiques
     */
    _process_time_series(data, group_field, value_field, ratio_field = null) {
        if (!data || data.length === 0) return [];
        
        // Regrouper par temps et calculer les statistiques
        const time_groups = {};
        
        for (const entry of data) {
            const time = entry.time;
            if (!time_groups[time]) {
                time_groups[time] = {
                    time: time,
                    groups: {}
                };
            }
            
            const group = entry[group_field];
            if (!time_groups[time].groups[group]) {
                time_groups[time].groups[group] = {
                    values: [],
                    ratios: ratio_field ? [] : null
                };
            }
            
            time_groups[time].groups[group].values.push(entry[value_field]);
            
            if (ratio_field) {
                time_groups[time].groups[group].ratios.push(entry[value_field] / entry[ratio_field]);
            }
        }
        
        // Convertir en format de série temporelle
        const result = [];
        
        for (const time in time_groups) {
            const entry = { time: parseFloat(time) };
            
            for (const group in time_groups[time].groups) {
                const values = time_groups[time].groups[group].values;
                
                // Calculer la moyenne des valeurs pour ce groupe à ce moment
                const avg_value = values.reduce((a, b) => a + b, 0) / values.length;
                entry[`group_${group}`] = avg_value;
                
                // Si nous calculons aussi des ratios
                if (ratio_field) {
                    const ratios = time_groups[time].groups[group].ratios;
                    const avg_ratio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
                    entry[`ratio_${group}`] = avg_ratio;
                }
            }
            
            result.push(entry);
        }
        
        // Trier par temps
        result.sort((a, b) => a.time - b.time);
        
        return result;
    }
    
    /**
     * Traite les séries temporelles des états ECM
     */
    _process_ecm_states() {
        if (this.ecm_states.length === 0) return [];
        
        // Regrouper par temps et compter les UEs dans chaque état
        const time_groups = {};
        
        for (const entry of this.ecm_states) {
            const time = entry.time;
            if (!time_groups[time]) {
                time_groups[time] = {
                    time: time,
                    idle_count: 0,
                    connected_count: 0,
                    total: 0
                };
            }
            
            if (entry.state === ECMState.IDLE) {
                time_groups[time].idle_count++;
            } else if (entry.state === ECMState.CONNECTED) {
                time_groups[time].connected_count++;
            }
            
            time_groups[time].total++;
        }
        
        // Convertir en format de série temporelle
        const result = [];
        
        for (const time in time_groups) {
            const entry = {
                time: parseFloat(time),
                idle_count: time_groups[time].idle_count,
                connected_count: time_groups[time].connected_count,
                idle_ratio: time_groups[time].total > 0 
                    ? time_groups[time].idle_count / time_groups[time].total 
                    : 0,
                connected_ratio: time_groups[time].total > 0 
                    ? time_groups[time].connected_count / time_groups[time].total 
                    : 0
            };
            
            result.push(entry);
        }
        
        // Trier par temps
        result.sort((a, b) => a.time - b.time);
        
        return result;
    }
    
    /**
     * Traite les séries temporelles d'occupation des buffers
     */
    _process_buffer_occupancy() {
        if (this.buffer_occupancy.length === 0) return [];
        
        // Regrouper par temps et calculer les statistiques
        const time_groups = {};
        
        for (const entry of this.buffer_occupancy) {
            const time = entry.time;
            if (!time_groups[time]) {
                time_groups[time] = {
                    time: time,
                    values: [],
                    dl_values: [],
                    ul_values: []
                };
            }
            
            time_groups[time].values.push(entry.occupancy_ratio);
            
            // Séparer UL et DL
            if (entry.buffer_id.startsWith('DL_')) {
                time_groups[time].dl_values.push(entry.occupancy_ratio);
            } else if (entry.buffer_id.startsWith('UL_')) {
                time_groups[time].ul_values.push(entry.occupancy_ratio);
            }
        }
        
        // Convertir en format de série temporelle
        const result = [];
        
        for (const time in time_groups) {
            const values = time_groups[time].values;
            const dl_values = time_groups[time].dl_values;
            const ul_values = time_groups[time].ul_values;
            
            const entry = {
                time: parseFloat(time),
                avg_occupancy: values.reduce((a, b) => a + b, 0) / values.length,
                max_occupancy: Math.max(...values),
                avg_dl_occupancy: dl_values.length > 0 
                    ? dl_values.reduce((a, b) => a + b, 0) / dl_values.length 
                    : 0,
                avg_ul_occupancy: ul_values.length > 0 
                    ? ul_values.reduce((a, b) => a + b, 0) / ul_values.length 
                    : 0
            };
            
            result.push(entry);
        }
        
        // Trier par temps
        result.sort((a, b) => a.time - b.time);
        
        return result;
    }
    
    /**
     * Formate une série temporelle simple
     */
    _format_time_series(data) {
        if (!data || data.length === 0) return [];
        
        // Regrouper par temps et calculer la moyenne
        const time_groups = {};
        
        for (const entry of data) {
            const time = entry.time;
            if (!time_groups[time]) {
                time_groups[time] = {
                    time: time,
                    values: []
                };
            }
            
            time_groups[time].values.push(entry.throughput);
        }
        
        // Convertir en format de série temporelle
        const result = [];
        
        for (const time in time_groups) {
            const values = time_groups[time].values;
            const entry = {
                time: parseFloat(time),
                value: values.reduce((a, b) => a + b, 0) / values.length
            };
            
            result.push(entry);
        }
        
        // Trier par temps
        result.sort((a, b) => a.time - b.time);
        
        return result;
    }
}

// ====================================================================================
// PARTIE 3: INTERFACE UTILISATEUR ET VISUALISATION
// ====================================================================================

/**
 * Initialise l'interface utilisateur
 */
function initializeUI() {
    // Configurer les onglets
    setupTabs();
    
    // Configurer les formulaires
    loadConfigFromState();
    
    // Configurer les événements de la page de configuration
    document.getElementById('start-simulation').addEventListener('click', startSimulation);
    
    // Configurer les sélecteurs de scénario dans chaque onglet
    setupScenarioSelectors();
    
    // Initialiser les graphiques vides
    setupEmptyCharts();
}

/**
 * Configure les onglets
 */
function setupTabs() {
    const tabLinks = document.querySelectorAll('.main-nav a');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            const targetTab = link.getAttribute('data-tab');
            
            // Activer l'onglet sélectionné
            tabLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            // Afficher le contenu correspondant
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === targetTab) {
                    content.classList.add('active');
                    simulationState.activeTab = targetTab;
                    
                    // Mettre à jour la visualisation si nécessaire
                    if (targetTab === 'topologie' && simulationState.topologyData) {
                        renderTopology(simulationState.topologyData);
                    }
                }
            });
        });
    });
}

/**
 * Charge la configuration à partir de l'état global
 */
function loadConfigFromState() {
    const config = simulationState.config;
    
    // Paramètres généraux
    document.getElementById('T_sim').value = config.T_sim;
    document.getElementById('T_warmup').value = config.T_warmup;
    document.getElementById('N_runs').value = config.N_runs;
    document.getElementById('delta_t_global').value = config.delta_t_global;
    document.getElementById('TTI').value = config.TTI;
    
    // Paramètres de topologie
    document.getElementById('R').value = config.R;
    document.getElementById('N_eNB').value = config.N_eNB;
    document.getElementById('sigma_eNB').value = config.sigma_eNB;
    document.getElementById('N_UE').value = config.N_UE;
    document.getElementById('sigma_UE').value = config.sigma_UE;
    document.getElementById('Mobility_Model').value = config.Mobility_Model;
    
    // Paramètres ECM
    document.getElementById('T_inactivity_C_I').value = config.T_inactivity_C_I;
    document.getElementById('L_RRC_Setup').value = config.L_RRC_Setup;
    document.getElementById('L_RRC_Release').value = config.L_RRC_Release;
    document.getElementById('L_Paging').value = config.L_Paging;
    
    // Paramètres de scheduling
    document.getElementById('N_RB').value = config.N_RB;
    document.getElementById('R_RB').value = config.R_RB;
    document.getElementById('W_PF').value = config.W_PF;
    
    // Paramètres énergétiques
    document.getElementById('P_Idle').value = config.P_Idle;
    document.getElementById('P_Connected_Base').value = config.P_Connected_Base;
    document.getElementById('P_Tx_Active').value = config.P_Tx_Active;
    document.getElementById('P_Rx_Active').value = config.P_Rx_Active;
}

/**
 * Configure les sélecteurs de scénario dans chaque onglet
 */
function setupScenarioSelectors() {
    const scenarioSelectors = [
        document.getElementById('rnti-scenario'),
        document.getElementById('energy-scenario'),
        document.getElementById('latency-scenario'),
        document.getElementById('throughput-scenario')
    ];
    
    scenarioSelectors.forEach(selector => {
        if (selector) {
            selector.addEventListener('change', (e) => {
                const scenario = e.target.value;
                updateChartsForScenario(scenario);
            });
        }
    });
}

/**
 * Configure les graphiques vides en attendant les résultats de simulation
 */
function setupEmptyCharts() {
    // Créer des graphiques vides pour chaque visualisation
    
    // Onglet RNTI
    simulationState.charts.rntiUsage = createTimeSeriesChart('rnti-usage-chart', 'Utilisation RNTI au cours du temps', 'Heure', 'Taux d\'utilisation (%)');
    simulationState.charts.connectedUes = createTimeSeriesChart('connected-ues-chart', 'UEs connectés par eNodeB', 'Heure', 'Nombre d\'UEs');
    simulationState.charts.rntiDistribution = createHistogramChart('rnti-distribution-chart', 'Distribution de l\'occupation RNTI', 'Taux d\'occupation (%)', 'Fréquence');
    simulationState.charts.uniqueUes = createBarChart('unique-ues-chart', 'UEs uniques servis par eNodeB (24h)', 'eNodeB', 'Nombre d\'UEs');
    
    // Onglet Énergie
    simulationState.charts.energyConsumption = createBarChart('energy-consumption-chart', 'Consommation énergétique moyenne sur 24h', 'Scénario', 'Énergie (J)');
    simulationState.charts.energyDistribution = createHistogramChart('energy-distribution-chart', 'Distribution de l\'énergie consommée par UE', 'Énergie (J)', 'Fréquence');
    simulationState.charts.stateTime = createPieChart('state-time-chart', 'Répartition du temps dans chaque état');
    simulationState.charts.energyTimeline = createTimeSeriesChart('energy-timeline-chart', 'Évolution énergétique sur 24h', 'Heure', 'Énergie moyenne (J)');
    
    // Onglet Latence
    simulationState.charts.idleToConnected = createHistogramChart('idle-to-connected-chart', 'Latence de transition IDLE → CONNECTED', 'Latence (s)', 'Fréquence');
    simulationState.charts.queuingLatency = createHistogramChart('queuing-latency-chart', 'Latence de mise en file d\'attente', 'Latence (s)', 'Fréquence');
    simulationState.charts.firstPacketLatencyCdf = createCdfChart('first-packet-latency-cdf-chart', 'CDF de la latence du premier paquet', 'Latence (s)', 'Probabilité cumulée');
    simulationState.charts.latencyBoxplot = createBoxplotChart('latency-boxplot-chart', 'Distribution des latences par type', 'Type de latence', 'Latence (s)');
    
    // Onglet Débit
    simulationState.charts.goodputDistribution = createHistogramChart('goodput-distribution-chart', 'Distribution du débit utile par UE', 'Débit (Mbps)', 'Fréquence');
    simulationState.charts.networkThroughput = createTimeSeriesChart('network-throughput-chart', 'Débit total du réseau au cours du temps', 'Heure', 'Débit (Mbps)');
    simulationState.charts.pdr = createBarChart('pdr-chart', 'Packet Delivery Ratio (PDR)', 'Scénario', 'PDR (%)');
    simulationState.charts.bufferOccupancy = createTimeSeriesChart('buffer-occupancy-chart', 'Occupation des buffers', 'Heure', 'Taux d\'occupation (%)');
    
    // Onglet Comparaison
    simulationState.charts.radarComparison = createRadarChart('radar-comparison-chart', 'Comparaison Multi-Critères');
    simulationState.charts.rntiEfficiency = createBarChart('rnti-efficiency-chart', 'Efficacité RNTI', 'Scénario', 'UEs servis / Pool RNTI');
    simulationState.charts.energyLatency = createScatterChart('energy-latency-chart', 'Compromis Énergie-Latence', 'Consommation énergétique (J)', 'Latence moyenne (ms)');
    simulationState.charts.qosChart = createGroupedBarChart('qos-chart', 'Comparaison QoS', 'Scénario', 'Valeur normalisée');
    simulationState.charts.ecmBenefit = createBarChart('ecm-benefit-chart', 'Bénéfice du Mode ECM', 'Métrique', 'Amélioration relative (%)');
}

/**
 * Démarre la simulation
 */
function startSimulation() {
    if (simulationState.running) {
        showMessage('Une simulation est déjà en cours', 'warning');
        return;
    }
    
    // Récupérer la configuration depuis le formulaire
    updateConfigFromForm();
    
    // Vérifier quels scénarios doivent être simulés
    const scenarios = [];
    if (document.getElementById('scenario-A1').checked) scenarios.push('A1');
    if (document.getElementById('scenario-A2').checked) scenarios.push('A2');
    if (document.getElementById('scenario-B1').checked) scenarios.push('B1');
    if (document.getElementById('scenario-B2').checked) scenarios.push('B2');
    
    if (scenarios.length === 0) {
        showMessage('Veuillez sélectionner au moins un scénario à simuler', 'warning');
        return;
    }
    
    // Démarrer la simulation
    simulationState.running = true;
    simulationState.progress = 0;
    document.getElementById('simulation-state').textContent = "En cours...";
    updateProgressBar(0);
    
    // Simuler chaque scénario séquentiellement
    simulateScenarios(scenarios);
}

/**
 * Simule les scénarios séquentiellement
 */
function simulateScenarios(scenarios) {
    if (scenarios.length === 0) {
        // Toutes les simulations sont terminées
        simulationState.running = false;
        document.getElementById('simulation-state').textContent = "Terminé";
        updateProgressBar(100);
        
        // Mettre à jour les visualisations avec les résultats
        updateAllVisualizations();
        
        // Afficher un message de succès
        showMessage('Simulation terminée avec succès!', 'success');
        return;
    }
    
    // Prendre le premier scénario et l'exécuter
    const scenario = scenarios.shift();
    simulationState.currentScenario = scenario;
    
    console.log(`Démarrage de la simulation du scénario ${scenario}`);
    
    // Créer le simulateur pour ce scénario
    const simulator = new NetworkSimulator(simulationState.config, scenario);
    
    // Exécuter la simulation
    simulator.run_simulation((progress, results) => {
        // Mettre à jour la progression
        const overallProgress = (simulationState.results.A1 ? 25 : 0) +
            (simulationState.results.A2 ? 25 : 0) +
            (simulationState.results.B1 ? 25 : 0) +
            (simulationState.results.B2 ? 25 : 0) +
            (progress / scenarios.length);
        
        updateProgressBar(overallProgress);
        
        // Si la simulation est terminée (résultats disponibles)
        if (results) {
            console.log(`Simulation du scénario ${scenario} terminée`);
            simulationState.results[scenario] = results;
            
            // Si c'est le premier scénario, sauvegarder les données de topologie pour visualisation
            if (!simulationState.topologyData) {
                simulationState.topologyData = simulator.get_visualization_snapshot();
            }
            
            // Passer au scénario suivant
            setTimeout(() => {
                simulateScenarios(scenarios);
            }, 0);
        }
    });
}

/**
 * Met à jour la configuration depuis le formulaire
 */
function updateConfigFromForm() {
    const config = simulationState.config;
    
    // Paramètres généraux
    config.T_warmup = parseFloat(document.getElementById('T_warmup').value);
    config.N_runs = parseInt(document.getElementById('N_runs').value);
    
    // Paramètres de topologie
    config.R = parseFloat(document.getElementById('R').value);
    config.N_eNB = parseInt(document.getElementById('N_eNB').value);
    config.sigma_eNB = parseFloat(document.getElementById('sigma_eNB').value);
    config.N_UE = parseInt(document.getElementById('N_UE').value);
    config.sigma_UE = parseFloat(document.getElementById('sigma_UE').value);
    config.Mobility_Model = document.getElementById('Mobility_Model').value;
    
    // Paramètres ECM
    config.T_inactivity_C_I = parseFloat(document.getElementById('T_inactivity_C_I').value);
    config.L_RRC_Setup = parseFloat(document.getElementById('L_RRC_Setup').value);
    config.L_RRC_Release = parseFloat(document.getElementById('L_RRC_Release').value);
    config.L_Paging = parseFloat(document.getElementById('L_Paging').value);
    
    // Paramètres de scheduling
    config.N_RB = parseInt(document.getElementById('N_RB').value);
    config.R_RB = parseInt(document.getElementById('R_RB').value);
    config.W_PF = parseInt(document.getElementById('W_PF').value);
    
    // Paramètres énergétiques
    config.P_Idle = parseFloat(document.getElementById('P_Idle').value);
    config.P_Connected_Base = parseFloat(document.getElementById('P_Connected_Base').value);
    config.P_Tx_Active = parseFloat(document.getElementById('P_Tx_Active').value);
    config.P_Rx_Active = parseFloat(document.getElementById('P_Rx_Active').value);
}

/**
 * Met à jour la barre de progression
 */
function updateProgressBar(percent) {
    const progressBar = document.getElementById('progress-bar');
    progressBar.style.width = `${percent}%`;
    simulationState.progress = percent;
}

/**
 * Affiche un message temporaire
 */
function showMessage(message, type = 'info') {
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const closeBtn = document.querySelector('.close');
    
    // Configurer le titre selon le type de message
    let title = 'Information';
    if (type === 'warning') title = 'Attention';
    if (type === 'success') title = 'Succès';
    if (type === 'error') title = 'Erreur';
    
    modalTitle.textContent = title;
    modalBody.textContent = message;
    
    // Ajouter une classe de couleur selon le type
    modalBody.className = '';
    if (type) modalBody.classList.add(`message-${type}`);
    
    // Afficher la modal
    modal.style.display = 'block';
    
    // Configurer la fermeture
    closeBtn.onclick = () => {
        modal.style.display = 'none';
    };
    
    // Fermer en cliquant en dehors
    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };
}

/**
 * Met à jour toutes les visualisations avec les résultats disponibles
 */
function updateAllVisualizations() {
    // Vérifier si des résultats sont disponibles
    const hasResults = 
        simulationState.results.A1 !== null ||
        simulationState.results.A2 !== null ||
        simulationState.results.B1 !== null ||
        simulationState.results.B2 !== null;
    
    if (!hasResults) {
        console.log('Aucun résultat disponible pour les visualisations');
        return;
    }
    
    // Obtenir le premier scénario disponible pour initialiser les visualisations
    let initialScenario = null;
    for (const scenario of ['A1', 'A2', 'B1', 'B2']) {
        if (simulationState.results[scenario] !== null) {
            initialScenario = scenario;
            break;
        }
    }
    
    if (!initialScenario) return;
    
    // Mettre à jour les sélecteurs de scénario pour n'afficher que les scénarios simulés
    updateScenarioSelectors();
    
    // Afficher les résultats pour le scénario initial
    updateChartsForScenario(initialScenario);
    
    // Mettre à jour les tableaux de comparaison
    updateComparisonTables();
    
    // Mettre à jour la visualisation de topologie
    if (simulationState.topologyData && simulationState.activeTab === 'topologie') {
        renderTopology(simulationState.topologyData);
    }
    
    // Mettre à jour les graphiques de comparaison dans l'onglet dédié
    updateComparisonCharts();
    
    // Générer une conclusion
    generateConclusion();
}

/**
 * Met à jour les sélecteurs de scénario pour n'afficher que les scénarios simulés
 */
function updateScenarioSelectors() {
    const selectors = [
        document.getElementById('rnti-scenario'),
        document.getElementById('energy-scenario'),
        document.getElementById('latency-scenario'),
        document.getElementById('throughput-scenario')
    ];
    
    selectors.forEach(selector => {
        if (!selector) return;
        
        // Sauvegarder la sélection actuelle
        const currentValue = selector.value;
        
        // Vider le sélecteur
        selector.innerHTML = '';
        
        // Ajouter les options pour les scénarios simulés
        let hasSelected = false;
        
        for (const scenario of ['A1', 'A2', 'B1', 'B2']) {
            if (simulationState.results[scenario] !== null) {
                const option = document.createElement('option');
                option.value = scenario;
                
                switch (scenario) {
                    case 'A1': option.text = 'A1: Avec ECM + Round Robin'; break;
                    case 'A2': option.text = 'A2: Avec ECM + Proportional Fair'; break;
                    case 'B1': option.text = 'B1: Sans ECM + Round Robin'; break;
                    case 'B2': option.text = 'B2: Sans ECM + Proportional Fair'; break;
                }
                
                if (scenario === currentValue) {
                    option.selected = true;
                    hasSelected = true;
                }
                
                selector.appendChild(option);
            }
        }
        
        // Si l'ancienne sélection n'est plus disponible, sélectionner la première option
        if (!hasSelected && selector.options.length > 0) {
            selector.options[0].selected = true;
        }
    });
}

/**
 * Met à jour les graphiques pour un scénario spécifique
 */
function updateChartsForScenario(scenario) {
    const results = simulationState.results[scenario];
    if (!results) {
        console.log(`Aucun résultat disponible pour le scénario ${scenario}`);
        return;
    }
    
    console.log(`Mise à jour des graphiques pour le scénario ${scenario}`);
    
    // Mettre à jour les graphiques de l'onglet RNTI
    updateRNTICharts(results);
    
    // Mettre à jour les graphiques de l'onglet Énergie
    updateEnergyCharts(results);
    
    // Mettre à jour les graphiques de l'onglet Latence
    updateLatencyCharts(results);
    
    // Mettre à jour les graphiques de l'onglet Débit
    updateThroughputCharts(results);
}

/**
 * Met à jour les graphiques de l'onglet RNTI
 */
function updateRNTICharts(results) {
    // Graphique d'utilisation RNTI au cours du temps
    const rntiTimeData = results.time_series.rnti_usage;
    if (rntiTimeData && rntiTimeData.length > 0) {
        const datasets = [];
        
        // Créer un dataset pour chaque eNB
        const enbIds = new Set();
        
        for (const entry of rntiTimeData) {
            for (const key in entry) {
                if (key.startsWith('ratio_')) {
                    const enbId = key.replace('ratio_', '');
                    enbIds.add(enbId);
                }
            }
        }
        
        for (const enbId of enbIds) {
            datasets.push({
                label: `eNB ${enbId}`,
                data: rntiTimeData.map(entry => ({
                    x: formatTime(entry.time),
                    y: entry[`ratio_${enbId}`] * 100 || 0
                })),
                borderColor: getColorForIndex(parseInt(enbId)),
                backgroundColor: getColorForIndex(parseInt(enbId), 0.2),
                fill: false
            });
        }
        
        // Ajouter un dataset pour la moyenne
        const avgData = rntiTimeData.map(entry => {
            const ratios = [];
            for (const key in entry) {
                if (key.startsWith('ratio_')) {
                    ratios.push(entry[key]);
                }
            }
            
            const avg = ratios.length > 0 
                ? ratios.reduce((a, b) => a + b, 0) / ratios.length * 100
                : 0;
            
            return {
                x: formatTime(entry.time),
                y: avg
            };
        });
        
        datasets.push({
            label: 'Moyenne',
            data: avgData,
            borderColor: '#000000',
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
            borderWidth: 2,
            fill: false
        });
        
        updateChart(simulationState.charts.rntiUsage, datasets);
    }
    
    // Graphique du nombre d'UEs connectés par eNodeB
    const connectedUEsData = results.time_series.connected_ues;
    if (connectedUEsData && connectedUEsData.length > 0) {
        const datasets = [];
        
        // Créer un dataset pour chaque eNB
        const enbIds = new Set();
        
        for (const entry of connectedUEsData) {
            for (const key in entry) {
                if (key.startsWith('group_')) {
                    const enbId = key.replace('group_', '');
                    enbIds.add(enbId);
                }
            }
        }
        
        for (const enbId of enbIds) {
            datasets.push({
                label: `eNB ${enbId}`,
                data: connectedUEsData.map(entry => ({
                    x: formatTime(entry.time),
                    y: entry[`group_${enbId}`] || 0
                })),
                borderColor: getColorForIndex(parseInt(enbId)),
                backgroundColor: getColorForIndex(parseInt(enbId), 0.2),
                fill: false
            });
        }
        
        // Ajouter un dataset pour la moyenne
        const avgData = connectedUEsData.map(entry => {
            const counts = [];
            for (const key in entry) {
                if (key.startsWith('group_')) {
                    counts.push(entry[key]);
                }
            }
            
            const avg = counts.length > 0 
                ? counts.reduce((a, b) => a + b, 0) / counts.length
                : 0;
            
            return {
                x: formatTime(entry.time),
                y: avg
            };
        });
        
        datasets.push({
            label: 'Moyenne',
            data: avgData,
            borderColor: '#000000',
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
            borderWidth: 2,
            fill: false
        });
        
        updateChart(simulationState.charts.connectedUes, datasets);
    }
    
    // Graphique de distribution de l'occupation RNTI
    if (results.rnti && results.rnti.per_enb) {
        const rntiUsages = Object.values(results.rnti.per_enb).map(e => e.avg_rnti_usage * 100);
        
        const data = generateHistogramData(rntiUsages, 10);
        
        const datasets = [{
            label: 'Distribution',
            data: data.map(bin => bin.count),
            backgroundColor: 'rgba(54, 162, 235, 0.6)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1
        }];
        
        updateHistogramChart(simulationState.charts.rntiDistribution, datasets, data.map(bin => `${bin.min.toFixed(0)}-${bin.max.toFixed(0)}%`));
    }
    
    // Graphique des UEs uniques servis par eNodeB
    if (results.rnti && results.rnti.per_enb) {
        const labels = [];
        const data = [];
        
        for (const enb_id in results.rnti.per_enb) {
            labels.push(`eNB ${enb_id}`);
            data.push(results.rnti.per_enb[enb_id].unique_ues_served);
        }
        
        const datasets = [{
            label: 'UEs uniques',
            data: data,
            backgroundColor: 'rgba(54, 162, 235, 0.6)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1
        }];
        
        updateBarChart(simulationState.charts.uniqueUes, datasets, labels);
    }
}

/**
 * Met à jour les graphiques de l'onglet Énergie
 */
function updateEnergyCharts(results) {
    // Consommation énergétique moyenne
    if (results.energy) {
        const data = [results.energy.avg_energy_per_ue];
        
        const datasets = [{
            label: 'Consommation moyenne',
            data: data,
            backgroundColor: 'rgba(54, 162, 235, 0.6)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1
        }];
        
        updateBarChart(simulationState.charts.energyConsumption, datasets, [getScenarioLabel(results.config)]);
    }
    
    // Distribution de l'énergie consommée
    if (results.energy && results.energy.energy_distribution) {
        const data = generateHistogramData(results.energy.energy_distribution, 10);
        
        const datasets = [{
            label: 'Distribution',
            data: data.map(bin => bin.count),
            backgroundColor: 'rgba(54, 162, 235, 0.6)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1
        }];
        
        updateHistogramChart(simulationState.charts.energyDistribution, datasets, data.map(bin => `${bin.min.toFixed(1)}-${bin.max.toFixed(1)}`));
    }
    
    // Répartition du temps dans chaque état
    if (results.energy && results.config.ecm_mode === 'With ECM') {
        const idle_time_percent = results.energy.avg_idle_time_ratio * 100;
        const connected_time_percent = 100 - idle_time_percent;
        
        const data = [idle_time_percent, connected_time_percent];
        const backgroundColor = ['rgba(255, 206, 86, 0.6)', 'rgba(75, 192, 192, 0.6)'];
        
        updatePieChart(simulationState.charts.stateTime, data, ['IDLE', 'CONNECTED'], backgroundColor);
    } else {
        // Mode sans ECM, 100% CONNECTED
        const data = [0, 100];
        const backgroundColor = ['rgba(255, 206, 86, 0.6)', 'rgba(75, 192, 192, 0.6)'];
        
        updatePieChart(simulationState.charts.stateTime, data, ['IDLE', 'CONNECTED'], backgroundColor);
    }
    
    // Évolution énergétique sur 24h
    if (results.time_series.energy && results.time_series.energy.length > 0) {
        const energyData = results.time_series.energy;
        
        // Calculer la consommation énergétique moyenne à chaque instant
        const processedData = {};
        
        for (const entry of energyData) {
            const time = entry.time;
            const timeKey = Math.floor(time / 3600) * 3600; // Regrouper par heure pour lisibilité
            
            if (!processedData[timeKey]) {
                processedData[timeKey] = {
                    time: timeKey,
                    energies: []
                };
            }
            
            for (const key in entry) {
                if (key !== 'time' && !isNaN(entry[key])) {
                    processedData[timeKey].energies.push(entry[key]);
                }
            }
        }
        
        const timeLabels = [];
        const avgEnergies = [];
        
        for (const timeKey in processedData) {
            const data = processedData[timeKey];
            
            if (data.energies.length > 0) {
                const avgEnergy = data.energies.reduce((a, b) => a + b, 0) / data.energies.length;
                
                timeLabels.push(formatTime(data.time));
                avgEnergies.push(avgEnergy);
            }
        }
        
        const datasets = [{
            label: 'Consommation moyenne',
            data: avgEnergies,
            borderColor: 'rgba(75, 192, 192, 1)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            fill: true
        }];
        
        updateChartWithLabels(simulationState.charts.energyTimeline, datasets, timeLabels);
    }
}

/**
 * Met à jour les graphiques de l'onglet Latence
 */
function updateLatencyCharts(results) {
    // Latence IDLE -> CONNECTED
    if (results.latency && results.config.ecm_mode === 'With ECM') {
        const latencies = results.latency.idle_to_connected.distribution;
        
        if (latencies && latencies.length > 0) {
            const data = generateHistogramData(latencies, 10);
            
            const datasets = [{
                label: 'Distribution',
                data: data.map(bin => bin.count),
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }];
            
            updateHistogramChart(simulationState.charts.idleToConnected, datasets, data.map(bin => `${bin.min.toFixed(3)}-${bin.max.toFixed(3)}`));
        }
    } else {
        // Mode sans ECM, pas de transition IDLE -> CONNECTED
        simulationState.charts.idleToConnected.data = {
            datasets: []
        };
        simulationState.charts.idleToConnected.options.plugins.title.text = 'Latence de transition IDLE → CONNECTED (Non applicable)';
        simulationState.charts.idleToConnected.update();
    }
    
    // Latence de mise en file d'attente
    if (results.latency && results.latency.queuing.distribution) {
        const latencies = results.latency.queuing.distribution;
        
        const data = generateHistogramData(latencies, 10);
        
        const datasets = [{
            label: 'Distribution',
            data: data.map(bin => bin.count),
            backgroundColor: 'rgba(153, 102, 255, 0.6)',
            borderColor: 'rgba(153, 102, 255, 1)',
            borderWidth: 1
        }];
        
        updateHistogramChart(simulationState.charts.queuingLatency, datasets, data.map(bin => `${bin.min.toFixed(3)}-${bin.max.toFixed(3)}`));
    }
    
    // CDF de la latence du premier paquet
    if (results.latency && results.latency.first_packet.distribution) {
        const latencies = results.latency.first_packet.distribution;
        
        if (latencies && latencies.length > 0) {
            // Trier les latences pour la CDF
            const sortedLatencies = [...latencies].sort((a, b) => a - b);
            
            const points = [];
            const n = sortedLatencies.length;
            
            for (let i = 0; i < n; i++) {
                points.push({
                    x: sortedLatencies[i],
                    y: (i + 1) / n
                });
            }
            
            // Ajouter les points extrêmes si nécessaire
            if (points.length > 0) {
                if (points[0].x > 0) {
                    points.unshift({ x: 0, y: 0 });
                }
            }
            
            const datasets = [{
                label: 'CDF',
                data: points,
                borderColor: 'rgba(255, 99, 132, 1)',
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                fill: true,
                stepped: true
            }];
            
            updateScatterChart(simulationState.charts.firstPacketLatencyCdf, datasets);
        }
    }
    
    // Boxplot des latences
    if (results.latency) {
        const datasets = [];
        
        if (results.config.ecm_mode === 'With ECM' && results.latency.idle_to_connected.distribution.length > 0) {
            datasets.push({
                label: 'IDLE → CONNECTED',
                data: [{
                    min: results.latency.idle_to_connected.min,
                    q1: calculatePercentile(results.latency.idle_to_connected.distribution, 25),
                    median: results.latency.idle_to_connected.median,
                    q3: calculatePercentile(results.latency.idle_to_connected.distribution, 75),
                    max: results.latency.idle_to_connected.max
                }],
                backgroundColor: 'rgba(255, 99, 132, 0.6)'
            });
        }
        
        datasets.push({
            label: 'Mise en file d\'attente',
            data: [{
                min: results.latency.queuing.min,
                q1: calculatePercentile(results.latency.queuing.distribution, 25),
                median: results.latency.queuing.median,
                q3: calculatePercentile(results.latency.queuing.distribution, 75),
                max: results.latency.queuing.max
            }],
            backgroundColor: 'rgba(54, 162, 235, 0.6)'
        });
        
        datasets.push({
            label: 'Premier paquet',
            data: [{
                min: results.latency.first_packet.min,
                q1: calculatePercentile(results.latency.first_packet.distribution, 25),
                median: results.latency.first_packet.median,
                q3: calculatePercentile(results.latency.first_packet.distribution, 75),
                max: results.latency.first_packet.max
            }],
            backgroundColor: 'rgba(75, 192, 192, 0.6)'
        });
        
        updateBoxplotChart(simulationState.charts.latencyBoxplot, datasets);
    }
}

/**
 * Met à jour les graphiques de l'onglet Débit
 */
function updateThroughputCharts(results) {
    // Distribution du débit utile
    if (results.throughput && results.throughput.goodput_distribution) {
        // Convertir bits/s en Mbps
        const goodputs = results.throughput.goodput_distribution.map(g => g / 1000000);
        
        const data = generateHistogramData(goodputs, 10);
        
        const datasets = [{
            label: 'Distribution',
            data: data.map(bin => bin.count),
            backgroundColor: 'rgba(54, 162, 235, 0.6)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1
        }];
        
        updateHistogramChart(simulationState.charts.goodputDistribution, datasets, data.map(bin => `${bin.min.toFixed(1)}-${bin.max.toFixed(1)}`));
    }
    
    // Débit total du réseau au cours du temps
    if (results.time_series.network_throughput && results.time_series.network_throughput.length > 0) {
        const throughputData = results.time_series.network_throughput;
        
        // Convertir bits/s en Mbps et regrouper par heure
        const processedData = {};
        
        for (const entry of throughputData) {
            const time = entry.time;
            const timeKey = Math.floor(time / 3600) * 3600; // Regrouper par heure
            
            if (!processedData[timeKey]) {
                processedData[timeKey] = {
                    time: timeKey,
                    values: []
                };
            }
            
            if (entry.value) {
                processedData[timeKey].values.push(entry.value / 1000000); // bits/s -> Mbps
            }
        }
        
        const timeLabels = [];
        const avgThroughputs = [];
        
        for (const timeKey in processedData) {
            const data = processedData[timeKey];
            
            if (data.values.length > 0) {
                const avgThroughput = data.values.reduce((a, b) => a + b, 0) / data.values.length;
                
                timeLabels.push(formatTime(data.time));
                avgThroughputs.push(avgThroughput);
            }
        }
        
        const datasets = [{
            label: 'Débit total',
            data: avgThroughputs,
            borderColor: 'rgba(75, 192, 192, 1)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            fill: true
        }];
        
        updateChartWithLabels(simulationState.charts.networkThroughput, datasets, timeLabels);
    }
    
    // Packet Delivery Ratio
    if (results.throughput) {
        const data = [results.throughput.packet_delivery_ratio * 100];
        
        const datasets = [{
            label: 'PDR',
            data: data,
            backgroundColor: 'rgba(54, 162, 235, 0.6)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1
        }];
        
        updateBarChart(simulationState.charts.pdr, datasets, [getScenarioLabel(results.config)]);
    }
    
    // Occupation des buffers
    if (results.time_series.buffer_occupancy && results.time_series.buffer_occupancy.length > 0) {
        const bufferData = results.time_series.buffer_occupancy;
        
        // Convertir en pourcentages et regrouper par heure
        const processedData = {};
        
        for (const entry of bufferData) {
            const time = entry.time;
            const timeKey = Math.floor(time / 3600) * 3600; // Regrouper par heure
            
            if (!processedData[timeKey]) {
                processedData[timeKey] = {
                    time: timeKey,
                    avg: [],
                    dl: [],
                    ul: []
                };
            }
            
            processedData[timeKey].avg.push(entry.avg_occupancy * 100);
            processedData[timeKey].dl.push(entry.avg_dl_occupancy * 100);
            processedData[timeKey].ul.push(entry.avg_ul_occupancy * 100);
        }
        
        const timeLabels = [];
        const avgValues = [];
        const dlValues = [];
        const ulValues = [];
        
        for (const timeKey in processedData) {
            const data = processedData[timeKey];
            
            if (data.avg.length > 0) {
                timeLabels.push(formatTime(data.time));
                avgValues.push(data.avg.reduce((a, b) => a + b, 0) / data.avg.length);
                dlValues.push(data.dl.reduce((a, b) => a + b, 0) / data.dl.length);
                ulValues.push(data.ul.reduce((a, b) => a + b, 0) / data.ul.length);
            }
        }
        
        const datasets = [
            {
                label: 'Moyenne globale',
                data: avgValues,
                borderColor: 'rgba(0, 0, 0, 1)',
                backgroundColor: 'rgba(0, 0, 0, 0.1)',
                borderWidth: 2,
                fill: false
            },
            {
                label: 'DL',
                data: dlValues,
                borderColor: 'rgba(54, 162, 235, 1)',
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                borderWidth: 1,
                fill: true
            },
            {
                label: 'UL',
                data: ulValues,
                borderColor: 'rgba(255, 99, 132, 1)',
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                borderWidth: 1,
                fill: true
            }
        ];
        
        updateChartWithLabels(simulationState.charts.bufferOccupancy, datasets, timeLabels);
    }
}

