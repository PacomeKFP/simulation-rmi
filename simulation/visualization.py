import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns

class ResultVisualizer:
    """Visualisation des résultats de simulation"""
    
    def __init__(self):
        # Configuration du style des graphiques
        sns.set(style="whitegrid")
        plt.rcParams.update({'font.size': 12})
    
    def plot_rnti_usage(self, all_results):
        """Trace l'utilisation des RNTI pour les différents scénarios"""
        plt.figure(figsize=(12, 8))
        
        for scenario_name, results in all_results.items():
            # Préparer les données
            df = pd.DataFrame(results["rnti_usage"], columns=["time", "enb_id", "rnti_count"])
            df["time"] = df["time"] - results.get("T_warmup", 0)  # Ajuster le temps relatif
            
            # Agréger par temps et faire la moyenne sur les eNBs
            df_avg = df.groupby("time")["rnti_count"].mean().reset_index()
            
            # Tracer la courbe
            plt.plot(df_avg["time"]/3600, df_avg["rnti_count"], label=f"Scénario {scenario_name}")
        
        plt.xlabel("Temps (heures)")
        plt.ylabel("Nombre moyen de RNTI utilisés par eNB")
        plt.title("Utilisation des RNTI au cours du temps")
        plt.legend()
        plt.grid(True)
        plt.savefig("results/rnti_usage.png", dpi=300, bbox_inches="tight")
        plt.close()
    
    def plot_energy_comparison(self, all_results):
        """Compare la consommation énergétique entre les scénarios"""
        plt.figure(figsize=(10, 6))
        
        scenario_names = list(all_results.keys())
        energies = [results["avg_energy"] for results in all_results.values()]
        
        # Grouper par mode ECM (A vs B)
        ecm_enabled = [name for name in scenario_names if name.startswith("A")]
        ecm_disabled = [name for name in scenario_names if name.startswith("B")]
        
        ecm_energies = [np.mean([all_results[name]["avg_energy"] for name in ecm_enabled])]
        no_ecm_energies = [np.mean([all_results[name]["avg_energy"] for name in ecm_disabled])]
        
        # Barres regroupées
        x = np.arange(len(scenario_names))
        width = 0.35
        
        plt.bar(x, energies, width, label='Énergie moyenne par UE (J)')
        
        # Ajout d'une figure séparée pour la comparaison A vs B
        plt.figure(figsize=(8, 6))
        plt.bar([0, 1], [ecm_energies[0], no_ecm_energies[0]], width=0.5)
        plt.xticks([0, 1], ['Avec ECM', 'Sans ECM'])
        plt.ylabel('Énergie moyenne par UE (J)')
        plt.title('Comparaison de la consommation énergétique')
        plt.grid(axis='y')
        plt.savefig("results/energy_ecm_comparison.png", dpi=300, bbox_inches="tight")
        plt.close()
        
        # Revenir à la première figure
        plt.figure(1)
        plt.xticks(x, scenario_names)
        plt.xlabel('Scénario')
        plt.ylabel('Énergie (J)')
        plt.title('Consommation énergétique par scénario')
        plt.grid(axis='y')
        plt.savefig("results/energy_by_scenario.png", dpi=300, bbox_inches="tight")
        plt.close()
    
    def plot_latency_comparison(self, all_results):
        """Compare les latences entre les scénarios"""
        plt.figure(figsize=(12, 8))
        
        # Comparer les latences moyennes UL/DL
        scenario_names = list(all_results.keys())
        ul_latencies = [results["ul_latency"]["mean"] for results in all_results.values()]
        dl_latencies = [results["dl_latency"]["mean"] for results in all_results.values()]
        
        x = np.arange(len(scenario_names))
        width = 0.35
        
        plt.bar(x - width/2, ul_latencies, width, label='Latence UL moyenne')
        plt.bar