import simpy
import numpy as np

class UE:
    """Représentation d'un User Equipment"""
    
    def __init__(self, ue_id, env, network, profile, position, config):
        self.id = ue_id
        self.env = env
        self.network = network
        self.profile = profile
        self.position = position
        self.config = config
        self.serving_enb = None
        
        # État ECM (IDLE au départ)
        self.state = "IDLE" if config.ecm_enabled else "CONNECTED"
        self.rnti = None  # Attribué par l'eNB
        
        # Buffers de paquets
        self.ul_buffer = []
        
        # Métriques
        self.energy_consumed = 0
        self.time_in_idle = 0
        self.time_in_connected = 0
        self.last_state_change = env.now
        self.packets_sent = 0
        self.packets_received = 0
        self.packets_dropped = 0
        
        # Processus de consommation d'énergie
        self.env.process(self.energy_consumption_process())
        
        # Rattachement initial à un eNB
        self.attach_to_nearest_enb()
        
        # Démarrer le processus de génération de trafic
        self.traffic_process = env.process(self.generate_traffic())
        
    def attach_to_nearest_enb(self):
        """Attache l'UE à l'eNB le plus proche"""
        nearest_enb = None
        min_distance = float('inf')
        
        for enb in self.network.enbs:
            distance = np.sqrt((self.position[0] - enb.position[0])**2 + 
                              (self.position[1] - enb.position[1])**2)
            if distance < min_distance:
                min_distance = distance
                nearest_enb = enb
        
        self.serving_enb = nearest_enb
        self.serving_enb.register_ue(self)
    
    def generate_traffic(self):
        """Génère du trafic selon le profil de l'UE"""
        # Attendre la fin de la période de chauffe
        if self.env.now < self.config.T_warmup:
            yield self.env.timeout(self.config.T_warmup - self.env.now)
        
        while True:
            # Déterminer l'intervalle global actuel
            current_interval = int((self.env.now - self.config.T_warmup) / self.config.dt_global) % self.config.N_intervals
            
            # Déterminer la durée de la période ON
            activity_level = self.profile.get_activity_level(current_interval)
            on_duration = self.profile.get_on_duration(activity_level)
            
            # Période active (ON)
            if on_duration > 0:
                # Déclencher la transition vers CONNECTED si nécessaire
                if self.state == "IDLE":
                    yield self.env.process(self.transition_to_connected())
                
                # Génération de paquets pendant la période ON
                end_time = self.env.now + on_duration
                while self.env.now < end_time:
                    # Générer un paquet UL
                    packet_size = self.profile.get_ul_packet_size(activity_level)
                    self.add_ul_packet(packet_size)
                    
                    # Temps avant le prochain paquet
                    inter_arrival = self.profile.get_ul_inter_arrival(activity_level)
                    yield self.env.timeout(inter_arrival)
            
            # Période inactive (OFF)
            off_duration = self.profile.get_off_duration(activity_level)
            yield self.env.timeout(off_duration)
    
    def add_ul_packet(self, size):
        """Ajoute un paquet dans le buffer UL"""
        if len(self.ul_buffer) < self.config.B_size:
            packet = {
                'size': size,
                'created_at': self.env.now,
                'ue_id': self.id
            }
            self.ul_buffer.append(packet)
            
            # Déclencher la transmission si nécessaire
            if self.state == "IDLE" and self.config.ecm_enabled:
                self.env.process(self.transition_to_connected())
        else:
            self.packets_dropped += 1
    
    def receive_dl_packet(self, packet):
        """Reçoit un paquet DL"""
        self.packets_received += 1
        
        # Mesurer la latence (temps entre création et réception)
        latency = self.env.now - packet['created_at']
        self.network.metrics.record_dl_latency(latency)
    
    def transition_to_connected(self):
        """Transition de l'état IDLE à CONNECTED"""
        if self.state == "IDLE" and self.config.ecm_enabled:
            # Délai pour la procédure RRC Setup
            yield self.env.timeout(self.config.L_RRC_Setup)
            
            # Demander un RNTI à l'eNB
            success = self.serving_enb.allocate_rnti(self)
            
            if success:
                # Changement d'état et mise à jour des métriques
                self.update_state("CONNECTED")
                # Réinitialiser le timer d'inactivité
                self.reset_inactivity_timer()
            else:
                # Échec de l'allocation RNTI
                self.network.metrics.record_rnti_failure()
    
    def transition_to_idle(self):
        """Transition de l'état CONNECTED à IDLE"""
        if self.state == "CONNECTED" and self.config.ecm_enabled:
            # Délai pour la procédure RRC Release
            yield self.env.timeout(self.config.L_RRC_Release)
            
            # Libérer le RNTI
            self.serving_enb.release_rnti(self)
            self.rnti = None
            
            # Changement d'état et mise à jour des métriques
            self.update_state("IDLE")
    
    def reset_inactivity_timer(self):
        """Réinitialise le timer d'inactivité"""
        if hasattr(self, 'inactivity_timer') and self.inactivity_timer is not None:
            self.inactivity_timer.interrupt()
        
        if self.config.ecm_enabled and self.state == "CONNECTED":
            self.inactivity_timer = self.env.process(self.inactivity_timeout())
    
    def inactivity_timeout(self):
        """Processus qui gère le timer d'inactivité"""
        try:
            yield self.env.timeout(self.config.T_inactivity_C_I)
            # Déclencher la transition vers IDLE si toujours en CONNECTED
            if self.state == "CONNECTED":
                yield self.env.process(self.transition_to_idle())
        except simpy.Interrupt:
            # Le timer a été réinitialisé
            pass
    
    def update_state(self, new_state):
        """Met à jour l'état de l'UE et les métriques associées"""
        if self.state != new_state:
            now = self.env.now
            duration = now - self.last_state_change
            
            if self.state == "IDLE":
                self.time_in_idle += duration
            else:  # CONNECTED
                self.time_in_connected += duration
            
            self.last_state_change = now
            self.state = new_state
            
            # Notifier le collecteur de métriques
            self.network.metrics.record_state_change(self, new_state)
    
    def energy_consumption_process(self):
        """Processus qui calcule la consommation d'énergie en continu"""
        last_update = self.env.now
        
        while True:
            yield self.env.timeout(1.0)  # Mise à jour chaque seconde
            
            now = self.env.now
            duration = now - last_update
            
            # Calculer la consommation selon l'état
            if self.state == "IDLE":
                power = self.config.P_Idle
            else:  # CONNECTED
                power = self.config.P_Connected_Base
                # Ajouter le surcoût si transmission/réception active
                # (Cette partie serait plus précise si intégrée directement au scheduling)
            
            # Mettre à jour la consommation totale
            self.energy_consumed += power * duration / 1000.0  # Conversion en joules
            last_update = now


class eNodeB:
    """Représentation d'un eNodeB"""
    
    def __init__(self, enb_id, env, network, position, config):
        self.id = enb_id
        self.env = env
        self.network = network
        self.position = position
        self.config = config
        
        # Allocation RNTIs
        self.rnti_pool = set(range(1, 2**16 + 1))  # Pool de 2^16 RNTIs disponibles
        self.allocated_rntis = {}  # Mapping UE -> RNTI
        
        # UEs servis par cet eNodeB
        self.connected_ues = set()
        self.all_served_ues = set()  # Tous les UEs servis sur 24h
        
        # Buffers DL par UE
        self.dl_buffers = {}  # UE_id -> buffer
        
        # Créer le scheduler approprié
        if config.scheduler_algo == "RR":
            self.scheduler = RoundRobinScheduler(self, config)
        elif config.scheduler_algo == "PF":
            self.scheduler = ProportionalFairScheduler(self, config)
        
        # Démarrer le processus de scheduling
        self.env.process(self.scheduling_process())
        
        # Générer du trafic DL pour les UEs
        self.env.process(self.generate_dl_traffic())
    
    def register_ue(self, ue):
        """Enregistre un nouvel UE servi par cet eNodeB"""
        self.all_served_ues.add(ue)
        self.dl_buffers[ue.id] = []
    
    def allocate_rnti(self, ue):
        """Alloue un RNTI à un UE"""
        if len(self.rnti_pool) > 0:
            rnti = self.rnti_pool.pop()
            self.allocated_rntis[ue.id] = rnti
            ue.rnti = rnti
            self.connected_ues.add(ue)
            return True
        else:
            # Pas de RNTI disponible
            return False
    
    def release_rnti(self, ue):
        """Libère le RNTI d'un UE"""
        if ue.id in self.allocated_rntis:
            rnti = self.allocated_rntis.pop(ue.id)
            self.rnti_pool.add(rnti)
            self.connected_ues.discard(ue)
            return True
        return False
    
    def add_dl_packet(self, ue_id, size):
        """Ajoute un paquet dans le buffer DL pour un UE"""
        if ue_id in self.dl_buffers:
            if len(self.dl_buffers[ue_id]) < self.config.B_size:
                packet = {
                    'size': size,
                    'created_at': self.env.now,
                    'ue_id': ue_id
                }
                self.dl_buffers[ue_id].append(packet)
                
                # Rechercher l'UE correspondant
                target_ue = next((ue for ue in self.all_served_ues if ue.id == ue_id), None)
                
                # Si UE en IDLE et ECM activé, déclencher paging et transition
                if target_ue and target_ue.state == "IDLE" and self.config.ecm_enabled:
                    self.env.process(target_ue.transition_to_connected())
            else:
                # Buffer plein, paquet perdu
                self.network.metrics.record_dl_packet_dropped()
    
    def generate_dl_traffic(self):
        """Génère du trafic DL pour les UEs selon leurs profils"""
        # Attendre la fin de la période de chauffe
        if self.env.now < self.config.T_warmup:
            yield self.env.timeout(self.config.T_warmup - self.env.now)
        
        while True:
            # Générer les paquets DL pour tous les UEs servis
            for ue in self.all_served_ues:
                # Déterminer l'intervalle global actuel
                current_interval = int((self.env.now - self.config.T_warmup) / self.config.dt_global) % self.config.N_intervals
                
                # Probabilité de génération basée sur le profil et l'activité
                activity_level = ue.profile.get_activity_level(current_interval)
                dl_probability = ue.profile.get_dl_probability(activity_level)
                
                # Décider si un paquet DL est généré pour cet UE
                if np.random.random() < dl_probability:
                    packet_size = ue.profile.get_dl_packet_size(activity_level)
                    self.add_dl_packet(ue.id, packet_size)
            
            # Attendre avant le prochain cycle de génération
            yield self.env.timeout(0.1)  # 100 ms entre les cycles de génération
    
    def scheduling_process(self):
        """Processus d'ordonnancement exécuté à chaque TTI"""
        while True:
            # Attendre le prochain TTI
            yield self.env.timeout(self.config.dt_local)
            
            # Trouver les UEs éligibles (CONNECTED avec données en attente)
            eligible_ues_ul = [ue for ue in self.connected_ues if len(ue.ul_buffer) > 0]
            eligible_ues_dl = [ue for ue in self.connected_ues 
                              if ue.id in self.dl_buffers and len(self.dl_buffers[ue.id]) > 0]
            
            # Exécuter le scheduler pour allouer les RBs
            scheduled_ues_ul = self.scheduler.schedule_ul(eligible_ues_ul)
            scheduled_ues_dl = self.scheduler.schedule_dl(eligible_ues_dl)
            
            # Traiter les transmissions UL
            for ue, rb_count in scheduled_ues_ul:
                self.process_ul_transmission(ue, rb_count)
            
            # Traiter les transmissions DL
            for ue, rb_count in scheduled_ues_dl:
                self.process_dl_transmission(ue, rb_count)
    
    def process_ul_transmission(self, ue, rb_count):
        """Traite la transmission UL d'un paquet"""
        if len(ue.ul_buffer) > 0 and rb_count > 0:
            # Capacité de transmission avec les RBs alloués
            capacity = rb_count * self.config.R_RB  # bits
            
            # Traiter autant de paquets que possible avec la capacité allouée
            bits_sent = 0
            while len(ue.ul_buffer) > 0 and bits_sent + ue.ul_buffer[0]['size'] <= capacity:
                packet = ue.ul_buffer.pop(0)
                bits_sent += packet['size']
                
                # Mesurer la latence
                latency = self.env.now - packet['created_at']
                self.network.metrics.record_ul_latency(latency)
                
                # Comptabiliser le paquet envoyé
                ue.packets_sent += 1
                
                # Réinitialiser le timer d'inactivité
                ue.reset_inactivity_timer()
            
            # Mettre à jour les métriques
            self.network.metrics.record_ul_throughput(bits_sent, ue)
            
            # Ajouter le surcoût énergétique de la transmission
            ue.energy_consumed += self.config.P_Tx_Active * self.config.dt_local / 1000.0
    
    def process_dl_transmission(self, ue, rb_count):
        """Traite la transmission DL d'un paquet"""
        if ue.id in self.dl_buffers and len(self.dl_buffers[ue.id]) > 0 and rb_count > 0:
            # Capacité de transmission avec les RBs alloués
            capacity = rb_count * self.config.R_RB  # bits
            
            # Traiter autant de paquets que possible avec la capacité allouée
            bits_sent = 0
            while len(self.dl_buffers[ue.id]) > 0 and bits_sent + self.dl_buffers[ue.id][0]['size'] <= capacity:
                packet = self.dl_buffers[ue.id].pop(0)
                bits_sent += packet['size']
                
                # Envoyer le paquet à l'UE
                ue.receive_dl_packet(packet)
                
                # Réinitialiser le timer d'inactivité
                ue.reset_inactivity_timer()
            
            # Mettre à jour les métriques
            self.network.metrics.record_dl_throughput(bits_sent, ue)
            
            # Ajouter le surcoût énergétique de la réception
            ue.energy_consumed += self.config.P_Rx_Active * self.config.dt_local / 1000.0