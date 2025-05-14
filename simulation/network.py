import numpy as np
from simulation.entities import UE, eNodeB

class Network:
    """Gestion du réseau et de sa topologie"""
    
    def __init__(self, env, config, metrics):
        self.env = env
        self.config = config
        self.metrics = metrics
        self.enbs = []
        self.ues = []
        
        # Créer la topologie
        self.create_topology()
        
        # Processus de collecte périodique de métriques
        self.env.process(self.periodic_metrics_collection())
    
    def create_topology(self):
        """Crée et positionne les eNodeBs dans la zone circulaire"""
        for i in range(self.config.N_eNB):
            # Position des eNodeBs selon une distribution Gaussienne 2D
            distance = np.random.rayleigh(self.config.sigma_eNB)
            angle = np.random.uniform(0, 2 * np.pi)
            
            # Coordonnées cartésiennes
            x = distance * np.cos(angle)
            y = distance * np.sin(angle)
            
            # Vérifier que l'eNB est dans le cercle de rayon R
            while np.sqrt(x**2 + y**2) > self.config.R:
                distance = np.random.rayleigh(self.config.sigma_eNB)
                angle = np.random.uniform(0, 2 * np.pi)
                x = distance * np.cos(angle)
                y = distance * np.sin(angle)
            
            position = (x, y)
            
            # Créer l'eNodeB
            enb = eNodeB(i, self.env, self, position, self.config)
            self.enbs.append(enb)
    
    def create_ues(self, profiles):
        """Crée et positionne les UEs dans la zone circulaire"""
        # Distribution des profils selon les probabilités configurées
        profile_ids = list(range(len(profiles)))
        profile_probs = [self.config.profile_distribution.get(i, 1.0/len(profiles)) for i in profile_ids]
        
        for i in range(self.config.N_UE):
            # Assigner un profil
            profile_idx = np.random.choice(profile_ids, p=profile_probs)
            profile = profiles[profile_idx]
            
            # Position des UEs selon une distribution Gaussienne 2D
            distance = np.random.rayleigh(self.config.sigma_UE)
            angle = np.random.uniform(0, 2 * np.pi)
            
            # Coordonnées cartésiennes
            x = distance * np.cos(angle)
            y = distance * np.sin(angle)
            
            # Vérifier que l'UE est dans le cercle de rayon R
            while np.sqrt(x**2 + y**2) > self.config.R:
                distance = np.random.rayleigh(self.config.sigma_UE)
                angle = np.random.uniform(0, 2 * np.pi)
                x = distance * np.cos(angle)
                y = distance * np.sin(angle)
            
            position = (x, y)
            
            # Créer l'UE
            ue = UE(i, self.env, self, profile, position, self.config)
            self.ues.append(ue)
    
    def periodic_metrics_collection(self):
        """Processus de collecte périodique des métriques"""
        while True:
            self.metrics.update_periodic_metrics(self.env, self)
            yield self.env.timeout(self.metrics.sampling_interval)