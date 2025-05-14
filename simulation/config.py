import numpy as np

class SimulationConfig:
    """Configuration des paramètres de simulation"""
    
    def __init__(self):
        # Paramètres généraux
        self.T_sim = 24 * 3600  # Durée de simulation (s)
        self.T_warmup = 3600    # Période de chauffe (s)
        self.N_runs = 10        # Nombre de répétitions
        self.dt_global = 300    # Intervalle global (s)
        self.dt_local = 0.001   # TTI (s)
        
        # Topologie
        self.R = 2.5            # Rayon de la zone (km)
        self.N_eNB = 19         # Nombre d'eNodeBs
        self.sigma_eNB = 1.0    # Écart-type pour placement eNB (km)
        self.N_UE = self.N_eNB * 70000  # Nombre d'UEs (> N_eNB * 2^16)
        self.sigma_UE = 0.8     # Écart-type pour placement UE (km)
        self.mobility_model = "Static"  # Modèle de mobilité
        
        # Trafic
        self.K = 10              # Nombre de profils de trafic
        self.profile_distribution = {
            # Probabilité d'assignation des profils
            i: 1.0/self.K for i in range(self.K)
        }
        self.B_size = 100        # Taille des buffers (paquets)
        
        # RRM
        self.ecm_enabled = True  # Mode "Avec ECM" par défaut
        self.T_inactivity_C_I = 10.0  # Timer d'inactivité (s)
        self.L_RRC_Setup = 0.1    # Délai Setup (s)
        self.L_RRC_Release = 0.05  # Délai Release (s)
        self.scheduler_algo = "RR"  # Algorithme d'ordonnancement
        self.N_RB = 100           # Nombre de Resource Blocks par TTI
        self.w_PF = 100           # Fenêtre pour Proportional Fair (TTI)
        
        # Canal
        self.R_RB = 477           # Débit par Resource Block (bits/TTI)
        
        # Énergie
        self.P_Idle = 5           # Puissance en IDLE (mW)
        self.P_Connected_Base = 100  # Puissance de base en CONNECTED (mW)
        self.P_Tx_Active = 150     # Surcoût en transmission (mW)
        self.P_Rx_Active = 80      # Surcoût en réception (mW)
        
        # Graine aléatoire
        self.random_seed = 42
        
    def initialize(self):
        """Initialise les paramètres dépendants et la graine aléatoire"""
        np.random.seed(self.random_seed)
        
        # Calculer le nombre d'intervalles globaux
        self.N_intervals = int(24 * 3600 / self.dt_global)