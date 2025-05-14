import numpy as np

class TrafficProfile:
    """Définition d'un profil de trafic sur 24h"""
    
    def __init__(self, profile_id, config):
        self.id = profile_id
        self.config = config
        
        # Générer les niveaux d'activité pour les 288 intervalles (5 minutes sur 24h)
        self.activity_levels = self.generate_activity_pattern()
    
    def generate_activity_pattern(self):
        """Génère les niveaux d'activité pour chaque intervalle de 5 minutes"""
        activity_levels = np.zeros(self.config.N_intervals)
        
        # Exemple de génération selon le profil
        if self.id == 0:  # Profil "Travailleur bureau"
            # Plus actif pendant les heures de bureau (8h-18h)
            for i in range(self.config.N_intervals):
                hour = (i * 5) // 60  # Heure correspondant à l'intervalle
                if 8 <= hour < 12 or 14 <= hour < 18:
                    activity_levels[i] = 0.7 + 0.2 * np.random.random()
                elif 12 <= hour < 14:  # Pause déjeuner
                    activity_levels[i] = 0.4 + 0.3 * np.random.random()
                elif hour >= 22 or hour < 6:  # Nuit
                    activity_levels[i] = 0.05 + 0.1 * np.random.random()
                else:
                    activity_levels[i] = 0.2 + 0.3 * np.random.random()
        
        elif self.id == 1:  # Profil "Utilisateur nocturne"
            # Plus actif le soir et la nuit
            for i in range(self.config.N_intervals):
                hour = (i * 5) // 60
                if 19 <= hour < 2:
                    activity_levels[i] = 0.6 + 0.3 * np.random.random()
                elif 2 <= hour < 8:  # Sommeil
                    activity_levels[i] = 0.05 + 0.1 * np.random.random()
                else:
                    activity_levels[i] = 0.2 + 0.3 * np.random.random()
                    
        # ... Autres profils (2-9) ...
        
        else:  # Profil par défaut avec activité moyenne
            for i in range(self.config.N_intervals):
                activity_levels[i] = 0.3 + 0.4 * np.random.random()
        
        return activity_levels
    
    def get_activity_level(self, interval_index):
        """Retourne le niveau d'activité pour un intervalle donné"""
        return self.activity_levels[interval_index % len(self.activity_levels)]
    
    def get_on_duration(self, activity_level):
        """Retourne la durée de la période ON basée sur le niveau d'activité"""
        # Plus le niveau d'activité est élevé, plus la période ON est longue
        base_duration = 60  # Secondes
        return base_duration * (0.5 + activity_level)
    
    def get_off_duration(self, activity_level):
        """Retourne la durée de la période OFF basée sur le niveau d'activité"""
        # Plus le niveau d'activité est élevé, plus la période OFF est courte
        base_duration = 300  # Secondes
        return base_duration * (1.5 - activity_level)
    
    def get_ul_packet_size(self, activity_level):
        """Retourne la taille d'un paquet UL basée sur le niveau d'activité"""
        # Taille moyenne de paquet entre 200 et 1000 bits selon l'activité
        mean_size = 200 + 800 * activity_level
        return int(np.random.normal(mean_size, mean_size * 0.2))
    
    def get_dl_packet_size(self, activity_level):
        """Retourne la taille d'un paquet DL basée sur le niveau d'activité"""
        # Paquets DL généralement plus grands que UL
        mean_size = 500 + 2000 * activity_level
        return int(np.random.normal(mean_size, mean_size * 0.2))
    
    def get_ul_inter_arrival(self, activity_level):
        """Retourne le temps entre deux paquets UL consécutifs"""
        # Plus le niveau d'activité est élevé, plus les paquets arrivent fréquemment
        mean_time = 2.0 * (1.0 - 0.7 * activity_level)
        return max(0.1, np.random.exponential(mean_time))
    
    def get_dl_probability(self, activity_level):
        """Retourne la probabilité de générer un paquet DL à chaque cycle"""
        # Probabilité proportionnelle au niveau d'activité
        return min(0.9, activity_level * 0.8)


class TrafficProfileGenerator:
    """Génère les différents profils de trafic pour la simulation"""
    
    def __init__(self, config):
        self.config = config
    
    def generate_profiles(self):
        """Crée les K profils de trafic définis"""
        profiles = []
        
        for k in range(self.config.K):
            profile = TrafficProfile(k, self.config)
            profiles.append(profile)
        
        return profiles