import simpy
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from simulation.network import Network
from simulation.entities import UE, eNodeB
from simulation.schedulers import RoundRobinScheduler, ProportionalFairScheduler
from simulation.traffic import TrafficProfileGenerator
from simulation.metrics import MetricsCollector
from simulation.config import SimulationConfig

def run_simulation(config):
    # Créer l'environnement de simulation à événements discrets
    env = simpy.Environment()
    
    # Initialiser le collecteur de métriques
    metrics = MetricsCollector(config)
    
    # Créer le réseau avec les eNodeBs
    network = Network(env, config, metrics)
    
    # Générer les profils de trafic
    traffic_generator = TrafficProfileGenerator(config)
    profiles = traffic_generator.generate_profiles()
    
    # Créer et placer les UEs avec leurs profils de trafic
    network.create_ues(profiles)
    
    # Lancer la simulation
    env.run(until=config.T_warmup + config.T_sim)
    
    # Collecter et retourner les résultats
    return metrics.get_results()

def main():
    # Définir les scénarios à simuler
    scenarios = [
        {"name": "A1", "ecm_enabled": True, "scheduler": "RR"},
        {"name": "A2", "ecm_enabled": True, "scheduler": "PF"},
        {"name": "B1", "ecm_enabled": False, "scheduler": "RR"},
        {"name": "B2", "ecm_enabled": False, "scheduler": "PF"}
    ]
    
    all_results = {}
    
    # Exécuter chaque scénario N_runs fois
    for scenario in scenarios:
        scenario_results = []
        
        for run in range(config.N_runs):
            print(f"Running scenario {scenario['name']}, run {run+1}/{config.N_runs}")
            
            # Configurer la simulation pour ce scénario
            config = SimulationConfig()
            config.ecm_enabled = scenario["ecm_enabled"]
            config.scheduler_algo = scenario["scheduler"]
            config.random_seed = run  # Différentes graines aléatoires
            
            # Exécuter la simulation
            results = run_simulation(config)
            scenario_results.append(results)
        
        # Agréger les résultats des N_runs
        all_results[scenario["name"]] = aggregate_results(scenario_results)
    
    # Générer les graphes de comparaison
    generate_comparison_graphs(all_results)
    
    # Sauvegarder les résultats
    save_results(all_results)

def aggregate_results(scenario_results):
    # Calculer les moyennes, écarts-types, etc.
    # Pour chaque métrique sur les N_runs
    pass

def generate_comparison_graphs(all_results):
    # Générer des graphiques comparant les différents scénarios
    pass

def save_results(all_results):
    # Sauvegarder les résultats dans des fichiers CSV/JSON
    pass

if __name__ == "__main__":
    main()