import numpy as np

class Scheduler:
    """Classe de base pour les schedulers"""
    
    def __init__(self, enb, config):
        self.enb = enb
        self.config = config
        self.N_RB = config.N_RB
    
    def schedule_ul(self, eligible_ues):
        """Alloue les RBs pour les transmissions UL"""
        raise NotImplementedError("Méthode à implémenter dans les classes dérivées")
    
    def schedule_dl(self, eligible_ues):
        """Alloue les RBs pour les transmissions DL"""
        raise NotImplementedError("Méthode à implémenter dans les classes dérivées")


class RoundRobinScheduler(Scheduler):
    """Scheduler Round Robin qui alloue les RBs de manière équitable"""
    
    def __init__(self, enb, config):
        super().__init__(enb, config)
        self.ul_pointer = 0  # Indice pour UL Round Robin
        self.dl_pointer = 0  # Indice pour DL Round Robin
    
    def schedule_ul(self, eligible_ues):
        """Alloue les RBs pour les transmissions UL avec Round Robin"""
        if not eligible_ues:
            return []
        
        n_ues = len(eligible_ues)
        if n_ues == 0:
            return []
        
        # Allouer les RBs équitablement, avec au moins 1 RB par UE
        rb_per_ue = max(1, self.N_RB // n_ues)
        
        # Ordonnancer les UEs à partir du pointeur actuel
        scheduled = []
        remaining_rbs = self.N_RB
        
        for i in range(n_ues):
            ue_index = (self.ul_pointer + i) % n_ues
            ue = eligible_ues[ue_index]
            
            # Ne pas allouer plus que le nombre de RBs restants
            alloc_rbs = min(rb_per_ue, remaining_rbs)
            if alloc_rbs > 0:
                scheduled.append((ue, alloc_rbs))
                remaining_rbs -= alloc_rbs
            
            if remaining_rbs <= 0:
                break
        
        # Mettre à jour le pointeur pour le prochain scheduling
        self.ul_pointer = (self.ul_pointer + len(scheduled)) % n_ues if n_ues > 0 else 0
        
        return scheduled
    
    def schedule_dl(self, eligible_ues):
        """Alloue les RBs pour les transmissions DL avec Round Robin"""
        if not eligible_ues:
            return []
        
        n_ues = len(eligible_ues)
        if n_ues == 0:
            return []
        
        # Allouer les RBs équitablement, avec au moins 1 RB par UE
        rb_per_ue = max(1, self.N_RB // n_ues)
        
        # Ordonnancer les UEs à partir du pointeur actuel
        scheduled = []
        remaining_rbs = self.N_RB
        
        for i in range(n_ues):
            ue_index = (self.dl_pointer + i) % n_ues
            ue = eligible_ues[ue_index]
            
            # Ne pas allouer plus que le nombre de RBs restants
            alloc_rbs = min(rb_per_ue, remaining_rbs)
            if alloc_rbs > 0:
                scheduled.append((ue, alloc_rbs))
                remaining_rbs -= alloc_rbs
            
            if remaining_rbs <= 0:
                break
        
        # Mettre à jour le pointeur pour le prochain scheduling
        self.dl_pointer = (self.dl_pointer + len(scheduled)) % n_ues if n_ues > 0 else 0
        
        return scheduled


class ProportionalFairScheduler(Scheduler):
    """Scheduler Proportional Fair qui alloue les RBs en fonction du débit historique"""
    
    def __init__(self, enb, config):
        super().__init__(enb, config)
        self.w_PF = config.w_PF
        self.ue_history_ul = {}  # UE_id -> historique de débit UL
        self.ue_history_dl = {}  # UE_id -> historique de débit DL
    
    def schedule_ul(self, eligible_ues):
        """Alloue les RBs pour les transmissions UL avec Proportional Fair"""
        if not eligible_ues:
            return []
        
        # Initialiser l'historique pour les nouveaux UEs
        for ue in eligible_ues:
            if ue.id not in self.ue_history_ul:
                self.ue_history_ul[ue.id] = 1.0  # Débit initial non-nul
        
        # Calculer les métriques PF pour chaque UE
        pf_metrics = []
        for ue in eligible_ues:
            # Taille du paquet en tête de file
            if len(ue.ul_buffer) > 0:
                instantaneous_rate = ue.ul_buffer[0]['size']
            else:
                instantaneous_rate = 0
            
            # Calculer la métrique PF
            if self.ue_history_ul[ue.id] > 0:
                pf_metric = instantaneous_rate / self.ue_history_ul[ue.id]
            else:
                pf_metric = float('inf')  # Priorité maximale si pas d'historique
            
            pf_metrics.append((ue, pf_metric))
        
        # Trier les UEs par métrique PF décroissante
        pf_metrics.sort(key=lambda x: x[1], reverse=True)
        
        # Allouer les RBs aux UEs selon l'ordre PF
        scheduled = []
        remaining_rbs = self.N_RB
        
        for ue, _ in pf_metrics:
            if remaining_rbs > 0:
                # Allocation simple : min(RBs nécessaires, RBs restants, 1/4 des RBs totaux)
                needed_rbs = min(4, len(ue.ul_buffer))  # Hypothèse simplifiée
                alloc_rbs = min(needed_rbs, remaining_rbs, self.N_RB // 4)
                
                if alloc_rbs > 0:
                    scheduled.append((ue, alloc_rbs))
                    remaining_rbs -= alloc_rbs
            else:
                break
        
        # Mettre à jour les historiques de débit
        for ue in eligible_ues:
            # Trouver si l'UE a été ordonnancé
            scheduled_ue = next((s_ue for s_ue, _ in scheduled if s_ue.id == ue.id), None)
            
            if scheduled_ue:
                # UE ordonnancé, calculer le débit instantané
                rb_count = next(rbs for s_ue, rbs in scheduled if s_ue.id == ue.id)
                instantaneous_rate = rb_count * self.config.R_RB
            else:
                # UE non ordonnancé
                instantaneous_rate = 0
            
            # Mettre à jour l'historique avec fenêtre glissante
            self.ue_history_ul[ue.id] = ((self.w_PF - 1) * self.ue_history_ul[ue.id] + instantaneous_rate) / self.w_PF
        
        return scheduled
    
    def schedule_dl(self, eligible_ues):
        """Alloue les RBs pour les transmissions DL avec Proportional Fair"""
        if not eligible_ues:
            return []
        
        # Initialiser l'historique pour les nouveaux UEs
        for ue in eligible_ues:
            if ue.id not in self.ue_history_dl:
                self.ue_history_dl[ue.id] = 1.0  # Débit initial non-nul
        
        # Calculer les métriques PF pour chaque UE
        pf_metrics = []
        for ue in eligible_ues:
            # Taille du paquet en tête de file
            if ue.id in self.enb.dl_buffers and len(self.enb.dl_buffers[ue.id]) > 0:
                instantaneous_rate = self.enb.dl_buffers[ue.id][0]['size']
            else:
                instantaneous_rate = 0
            
            # Calculer la métrique PF
            if self.ue_history_dl[ue.id] > 0:
                pf_metric = instantaneous_rate / self.ue_history_dl[ue.id]
            else:
                pf_metric = float('inf')  # Priorité maximale si pas d'historique
            
            pf_metrics.append((ue, pf_metric))
        
        # Trier les UEs par métrique PF décroissante
        pf_metrics.sort(key=lambda x: x[1], reverse=True)
        
        # Allouer les RBs aux UEs selon l'ordre PF
        scheduled = []
        remaining_rbs = self.N_RB
        
        for ue, _ in pf_metrics:
            if remaining_rbs > 0:
                # Allocation simple : min(RBs nécessaires, RBs restants, 1/4 des RBs totaux)
                if ue.id in self.enb.dl_buffers:
                    needed_rbs = min(4, len(self.enb.dl_buffers[ue.id]))  # Hypothèse simplifiée
                else:
                    needed_rbs = 0
                
                alloc_rbs = min(needed_rbs, remaining_rbs, self.N_RB // 4)
                
                if alloc_rbs > 0:
                    scheduled.append((ue, alloc_rbs))
                    remaining_rbs -= alloc_rbs
            else:
                break
        
        # Mettre à jour les historiques de débit
        for ue in eligible_ues:
            # Trouver si l'UE a été ordonnancé
            scheduled_ue = next((s_ue for s_ue, _ in scheduled if s_ue.id == ue.id), None)
            
            if scheduled_ue:
                # UE ordonnancé, calculer le débit instantané
                rb_count = next(rbs for s_ue, rbs in scheduled if s_ue.id == ue.id)
                instantaneous_rate = rb_count * self.config.R_RB
            else:
                # UE non ordonnancé
                instantaneous_rate = 0
            
            # Mettre à jour l'historique avec fenêtre glissante
            self.ue_history_dl[ue.id] = ((self.w_PF - 1) * self.ue_history_dl[ue.id] + instantaneous_rate) / self.w_PF
        
        return scheduled