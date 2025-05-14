import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from collections import defaultdict

class MetricsCollector:
    """Collecte et analyse les métriques de la simulation"""
    
    def __init__(self, config):
        self.config = config
        
        # Métriques RNTI
        self.rnti_usage = []  # [(timestamp, enb_id, usage_count)]
        self.rnti_failures = 0
        self.max_connected_ues = defaultdict(int)  # enb_id -> max
        
        # Métriques Énergétiques
        self.energy_per_ue = {}  # ue_id -> énergie totale (J)
        self.idle_time_per_ue = {}  # ue_id -> temps en IDLE (s)
        self.connected_time_per_ue = {}  # ue_id -> temps en CONNECTED (s)
        
        # Métriques QoS - Latence
        self.idle_to_connected_latency = []
        self.ul_latency = []
        self.dl_latency = []
        self.first_packet_latency = []
        
        # Métriques QoS - Débit
        self.ul_throughput_per_ue = defaultdict(list)  # ue_id -> [throughput_samples]
        self.dl_throughput_per_ue = defaultdict(list)  # ue_id -> [throughput_samples]
        self.ul_packets_sent = 0
        self.ul_packets_dropped = 0
        self.dl_packets_sent = 0
        self.dl_packets_dropped = 0
        self.buffer_occupancy_ul = []  # [(timestamp, avg_occupancy)]
        self.buffer_occupancy_dl = []  # [(timestamp, avg_occupancy)]
        
        # Intervalles d'échantillonnage pour certaines métriques
        self.sampling_interval = 60  # seconds
        self.last_sampling = 0
    
    def update_periodic_metrics(self, env, network):
        """Mise à jour des métriques échantillonnées périodiquement"""
        current_time = env.now
        
        if current_time - self.last_sampling >= self.sampling_interval and current_time >= self.config.T_warmup:
            # Collecter les métriques RNTI
            for enb in network.enbs:
                rnti_usage = len(enb.allocated_rntis)
                self.rnti_usage.append((current_time, enb.id, rnti_usage))
                self.max_connected_ues[enb.id] = max(self.max_connected_ues[enb.id], len(enb.connected_ues))
            
            # Collecter les métriques de buffer
            ul_occupancy = []
            dl_occupancy = []
            
            for ue in network.ues:
                ul_occupancy.append(len(ue.ul_buffer) / self.config.B_size)
            
            for enb in network.enbs:
                for buffer in enb.dl_buffers.values():
                    dl_occupancy.append(len(buffer) / self.config.B_size)
            
            if ul_occupancy:
                self.buffer_occupancy_ul.append((current_time, np.mean(ul_occupancy)))
            
            if dl_occupancy:
                self.buffer_occupancy_dl.append((current_time, np.mean(dl_occupancy)))
            
            self.last_sampling = current_time
    
    def record_state_change(self, ue, new_state):
        """Enregistre un changement d'état d'un UE"""
        if new_state == "CONNECTED" and ue.state == "IDLE":
            # Mesurer la latence de transition IDLE -> CONNECTED
            transition_time = ue.env.now - ue.last_state_change
            self.idle_to_connected_latency.append(transition_time)
    
    def record_ul_latency(self, latency):
        """Enregistre la latence d'un paquet UL"""
        self.ul_latency.append(latency)
        self.ul_packets_sent += 1
    
    def record_dl_latency(self, latency):
        """Enregistre la latence d'un paquet DL"""
        self.dl_latency.append(latency)
        self.dl_packets_sent += 1
    
    def record_ul_throughput(self, bits, ue):
        """Enregistre le débit instantané UL pour un UE"""
        if ue.env.now >= self.config.T_warmup:
            throughput = bits / self.config.dt_local  # bits/s
            self.ul_throughput_per_ue[ue.id].append(throughput)
    
    def record_dl_throughput(self, bits, ue):
        """Enregistre le débit instantané DL pour un UE"""
        if ue.env.now >= self.config.T_warmup:
            throughput = bits / self.config.dt_local  # bits/s
            self.dl_throughput_per_ue[ue.id].append(throughput)
    
    def record_rnti_failure(self):
        """Enregistre un échec d'allocation RNTI"""
        self.rnti_failures += 1
    
    def record_ul_packet_dropped(self):
        """Enregistre un paquet UL perdu"""
        self.ul_packets_dropped += 1
    
    def record_dl_packet_dropped(self):
        """Enregistre un paquet DL perdu"""
        self.dl_packets_dropped += 1
    
    def collect_final_ue_metrics(self, network):
        """Collecte les métriques finales par UE"""
        for ue in network.ues:
            self.energy_per_ue[ue.id] = ue.energy_consumed
            self.idle_time_per_ue[ue.id] = ue.time_in_idle
            self.connected_time_per_ue[ue.id] = ue.time_in_connected
    
    def get_results(self):
        """Retourne les résultats de la simulation sous forme de dictionnaire"""
        results = {
            # Métriques RNTI
            "rnti_usage": self.rnti_usage,
            "rnti_failures": self.rnti_failures,
            "max_connected_ues": dict(self.max_connected_ues),
            
            # Métriques Énergétiques
            "energy_per_ue": self.energy_per_ue,
            "idle_time_per_ue": self.idle_time_per_ue,
            "connected_time_per_ue": self.connected_time_per_ue,
            "avg_energy": np.mean(list(self.energy_per_ue.values())) if self.energy_per_ue else 0,
            
            # Métriques QoS - Latence
            "idle_to_connected_latency": {
                "mean": np.mean(self.idle_to_connected_latency) if self.idle_to_connected_latency else 0,
                "std": np.std(self.idle_to_connected_latency) if self.idle_to_connected_latency else 0,
                "samples": self.idle_to_connected_latency
            },
            "ul_latency": {
                "mean": np.mean(self.ul_latency) if self.ul_latency else 0,
                "std": np.std(self.ul_latency) if self.ul_latency else 0,
                "percentile_95": np.percentile(self.ul_latency, 95) if self.ul_latency else 0
            },
            "dl_latency": {
                "mean": np.mean(self.dl_latency) if self.dl_latency else 0,
                "std": np.std(self.dl_latency) if self.dl_latency else 0,
                "percentile_95": np.percentile(self.dl_latency, 95) if self.dl_latency else 0
            },
            
            # Métriques QoS - Débit
            "ul_throughput": {
                "mean_per_ue": {ue_id: np.mean(throughputs) if throughputs else 0 
                              for ue_id, throughputs in self.ul_throughput_per_ue.items()},
                "global_mean": np.mean([np.mean(t) for t in self.ul_throughput_per_ue.values() if t])
                              if self.ul_throughput_per_ue else 0
            },
            "dl_throughput": {
                "mean_per_ue": {ue_id: np.mean(throughputs) if throughputs else 0 
                              for ue_id, throughputs in self.dl_throughput_per_ue.items()},
                "global_mean": np.mean([np.mean(t) for t in self.dl_throughput_per_ue.values() if t])
                              if self.dl_throughput_per_ue else 0
            },
            
            # Packet Delivery Ratio
            "ul_pdr": (self.ul_packets_sent / (self.ul_packets_sent + self.ul_packets_dropped))
                      if (self.ul_packets_sent + self.ul_packets_dropped) > 0 else 1.0,
            "dl_pdr": (self.dl_packets_sent / (self.dl_packets_sent + self.dl_packets_dropped))
                      if (self.dl_packets_sent + self.dl_packets_dropped) > 0 else 1.0,
            
            # Buffer occupancy
            "buffer_occupancy_ul": self.buffer_occupancy_ul,
            "buffer_occupancy_dl": self.buffer_occupancy_dl
        }
        
        return results