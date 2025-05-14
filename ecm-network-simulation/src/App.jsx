import React, { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Tabs, Tab, Form, Button, Card, Alert } from 'react-bootstrap';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  BarElement, 
  Title, 
  Tooltip, 
  Legend,
  ArcElement
} from 'chart.js';
import { Line, Bar, Pie } from 'react-chartjs-2';
import * as d3 from 'd3';
import { runSimulation, getDefaultParams } from './simulation';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

function App() {
  const [activeTab, setActiveTab] = useState('configuration');
  const [simulationParams, setSimulationParams] = useState(getDefaultParams());
  const [simulationResults, setSimulationResults] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeScenario, setActiveScenario] = useState('all');
  const [selectedMetric, setSelectedMetric] = useState('energy');
  const [showAdvancedParams, setShowAdvancedParams] = useState(false);
  
  const topologyRef = useRef(null);
  const profilesRef = useRef(null);

  // Effect to run once for initializing visualization components
  useEffect(() => {
    if (topologyRef.current && simulationResults) {
      renderTopology();
    }
    
    if (profilesRef.current && simulationResults) {
      renderNetworkLoadCurves();
    }
  }, [topologyRef.current, profilesRef.current, simulationResults]);

  // Function to run the simulation with current parameters
  const startSimulation = () => {
    setIsSimulating(true);
    setProgress(0);
    
    // Start the simulation in a non-blocking way
    setTimeout(() => {
      try {
        const results = runSimulation(simulationParams, updateProgress);
        setSimulationResults(results);
        setActiveTab('results');
      } catch (error) {
        console.error("Simulation error:", error);
        alert("Error during simulation: " + error.message);
      } finally {
        setIsSimulating(false);
      }
    }, 100);
  };

  const updateProgress = (percent) => {
    setProgress(percent);
  };

  const handleParamChange = (param, value) => {
    setSimulationParams({
      ...simulationParams,
      [param]: value
    });
  };

  const renderTopology = () => {
    if (!topologyRef.current || !simulationResults) return;

    const container = topologyRef.current;
    const width = container.clientWidth;
    const height = 600;
    
    // Clear previous SVG
    d3.select(container).selectAll("svg").remove();
    
    const svg = d3.select(container)
      .append("svg")
      .attr("width", width)
      .attr("height", height);
      
    const { eNodeBs, UEs } = simulationResults.topology;
    
    // Scale to fit in SVG
    const radius = simulationParams.R * 1000; // km to m
    const scale = Math.min(width, height) / (2 * radius);
    
    // Create a group for the visualization and center it
    const g = svg.append("g")
      .attr("transform", `translate(${width/2}, ${height/2})`);
    
    // Draw the simulation boundary circle
    g.append("circle")
      .attr("cx", 0)
      .attr("cy", 0)
      .attr("r", radius * scale)
      .attr("fill", "none")
      .attr("stroke", "gray")
      .attr("stroke-dasharray", "5,5");
    
    // Draw eNodeBs
    g.selectAll(".enodeb")
      .data(eNodeBs)
      .enter()
      .append("circle")
      .attr("class", "enodeb")
      .attr("cx", d => d.x * scale)
      .attr("cy", d => d.y * scale)
      .attr("r", 8)
      .attr("fill", "red")
      .append("title")
      .text(d => `eNodeB ${d.id}: ${d.connectedUEs.length} connected UEs`);
    
    // Draw UEs
    g.selectAll(".ue")
      .data(UEs)
      .enter()
      .append("circle")
      .attr("class", d => `ue ${d.state.toLowerCase()}`)
      .attr("cx", d => d.x * scale)
      .attr("cy", d => d.y * scale)
      .attr("r", 3)
      .append("title")
      .text(d => `UE ${d.id}: ${d.state}, Profile: ${d.profile}`);
    
    // Add legend
    const legend = svg.append("g")
      .attr("transform", `translate(${width - 150}, 20)`);
      
    const legendItems = [
      { color: "#007bff", label: "IDLE" },
      { color: "#28a745", label: "CONNECTED" },
      { color: "#fd7e14", label: "eNodeB" }
    ];
    
    legendItems.forEach((item, i) => {
      const g = legend.append("g")
        .attr("transform", `translate(0, ${i * 20})`);
        
      g.append("circle")
        .attr("r", 5)
        .attr("fill", item.color);
        
      g.append("text")
        .attr("x", 15)
        .attr("y", 5)
        .text(item.label);
    });
  };
  
  const renderNetworkLoadCurves = () => {
    if (!profilesRef.current || !simulationResults) return;
    
    const container = profilesRef.current;
    const width = container.clientWidth;
    const height = 400;
    
    // Clear previous SVG
    d3.select(container).selectAll("svg").remove();
    
    const svg = d3.select(container)
      .append("svg")
      .attr("width", width)
      .attr("height", height);
    
    const { profiles, loadCurves } = simulationResults;
    
    // Préparer les données
    const hours = Array.from({length: 24}, (_, i) => i);
    
    const activityData = profiles.map(profile => ({
      profile: profile.name,
      values: loadCurves[profile.id].hourlyActivity.map((value, i) => ({
        hour: i,
        value
      }))
    }));
    
    // Configuration des échelles
    const xScale = d3.scaleLinear()
      .domain([0, 23])
      .range([50, width - 50]);
      
    const yScale = d3.scaleLinear()
      .domain([0, 1])
      .range([height - 50, 50]);
      
    // Créer un générateur de ligne
    const lineGenerator = d3.line()
      .x(d => xScale(d.hour))
      .y(d => yScale(d.value))
      .curve(d3.curveMonotoneX);
      
    // Couleurs pour les profils
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
    
    // Dessiner les lignes
    activityData.forEach((profileData, i) => {
      svg.append("path")
        .datum(profileData.values)
        .attr("fill", "none")
        .attr("stroke", colorScale(i))
        .attr("stroke-width", 2)
        .attr("d", lineGenerator);
        
      // Ajouter le nom du profil à la fin de la ligne
      const lastPoint = profileData.values[profileData.values.length - 1];
      
      svg.append("text")
        .attr("x", xScale(lastPoint.hour) + 5)
        .attr("y", yScale(lastPoint.value))
        .attr("fill", colorScale(i))
        .attr("font-size", "10px")
        .text(profileData.profile);
    });
    
    // Ajouter les axes
    const xAxis = d3.axisBottom(xScale).ticks(12);
    const yAxis = d3.axisLeft(yScale);
    
    svg.append("g")
      .attr("transform", `translate(0, ${height - 50})`)
      .call(xAxis);
      
    svg.append("g")
      .attr("transform", `translate(50, 0)`)
      .call(yAxis);
      
    // Ajouter les légendes des axes
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", height - 10)
      .attr("text-anchor", "middle")
      .text("Heure de la journée");
      
    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", 15)
      .attr("text-anchor", "middle")
      .text("Niveau d'activité");
  };
  
  const renderMetricCharts = () => {
    if (!simulationResults) return null;
    
    const scenarioData = activeScenario === 'all' 
      ? simulationResults.scenarios 
      : { [activeScenario]: simulationResults.scenarios[activeScenario] };
    
    switch (selectedMetric) {
      case 'energy':
        return renderEnergyMetrics(scenarioData);
      case 'rnti':
        return renderRNTIMetrics(scenarioData);
      case 'latency':
        return renderLatencyMetrics(scenarioData);
      case 'qos':
        return renderQoSMetrics(scenarioData);
      default:
        return <Alert variant="warning">Select a metric to visualize</Alert>;
    }
  };
  
  const renderEnergyMetrics = (scenarioData) => {
    const labels = Object.keys(scenarioData);
    const energyData = {
      labels,
      datasets: [
        {
          label: 'Average UE Energy Consumption (mWh)',
          data: labels.map(scenario => scenarioData[scenario].metrics.energy.averageConsumption),
          backgroundColor: 'rgba(54, 162, 235, 0.5)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1,
        },
      ],
    };
    
    const stateTimeData = {
      labels: ['IDLE', 'CONNECTED', 'TX Active', 'RX Active'],
      datasets: labels.map((scenario, index) => ({
        label: scenario,
        data: [
          scenarioData[scenario].metrics.energy.timeInIdle,
          scenarioData[scenario].metrics.energy.timeInConnected,
          scenarioData[scenario].metrics.energy.timeInTx,
          scenarioData[scenario].metrics.energy.timeInRx
        ],
        backgroundColor: [
          `rgba(75, 192, 192, ${0.7 - index * 0.1})`,
          `rgba(153, 102, 255, ${0.7 - index * 0.1})`,
          `rgba(255, 159, 64, ${0.7 - index * 0.1})`,
          `rgba(255, 99, 132, ${0.7 - index * 0.1})`
        ]
      })),
    };
    
    return (
      <>
        <Row className="mb-4">
          <Col>
            <Card>
              <Card.Header>Average UE Energy Consumption (24h)</Card.Header>
              <Card.Body>
                <Bar data={energyData} 
                  options={{
                    scales: {
                      y: { beginAtZero: true, title: { display: true, text: 'Energy (mWh)' } }
                    }
                  }} 
                />
              </Card.Body>
            </Card>
          </Col>
        </Row>
        <Row className="mb-4">
          <Col>
            <Card>
              <Card.Header>Time Distribution by UE State (% of 24h)</Card.Header>
              <Card.Body>
                <Bar data={stateTimeData}
                  options={{
                    scales: {
                      y: { beginAtZero: true, title: { display: true, text: '% of Time' }, stacked: true },
                      x: { stacked: true }
                    }
                  }}  
                />
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </>
    );
  };
  
  const renderRNTIMetrics = (scenarioData) => {
    const labels = Object.keys(scenarioData);
    const rntiData = {
      labels,
      datasets: [
        {
          label: 'Peak RNTI Usage (%)',
          data: labels.map(scenario => scenarioData[scenario].metrics.rnti.peakUsagePercent),
          backgroundColor: 'rgba(255, 99, 132, 0.5)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 1,
        },
        {
          label: 'Average RNTI Usage (%)',
          data: labels.map(scenario => scenarioData[scenario].metrics.rnti.averageUsagePercent),
          backgroundColor: 'rgba(75, 192, 192, 0.5)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1,
        }
      ],
    };
    
    const uniqueUEsData = {
      labels,
      datasets: [
        {
          label: 'Total Unique UEs Served',
          data: labels.map(scenario => scenarioData[scenario].metrics.rnti.uniqueUEsServed),
          backgroundColor: 'rgba(153, 102, 255, 0.5)',
          borderColor: 'rgba(153, 102, 255, 1)',
          borderWidth: 1,
        }
      ],
    };
    
    return (
      <>
        <Row className="mb-4">
          <Col>
            <Card>
              <Card.Header>RNTI Usage Statistics</Card.Header>
              <Card.Body>
                <Bar data={rntiData} 
                  options={{
                    scales: {
                      y: { beginAtZero: true, max: 100, title: { display: true, text: 'Usage (%)' } }
                    }
                  }} 
                />
              </Card.Body>
            </Card>
          </Col>
        </Row>
        <Row className="mb-4">
          <Col>
            <Card>
              <Card.Header>Unique UEs Served (24h)</Card.Header>
              <Card.Body>
                <Bar data={uniqueUEsData}
                  options={{
                    scales: {
                      y: { beginAtZero: true, title: { display: true, text: 'Count' } }
                    }
                  }}  
                />
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </>
    );
  };
  
  const renderLatencyMetrics = (scenarioData) => {
    const labels = Object.keys(scenarioData);
    const timeSeriesLabels = Array.from({length: 24}, (_, i) => `${i}:00`);
    
    const idleToConnectedData = {
      labels,
      datasets: [
        {
          label: 'Average IDLE->CONNECTED Transition Latency (ms)',
          data: labels.map(scenario => scenarioData[scenario].metrics.latency.avgIdleToConnected),
          backgroundColor: 'rgba(255, 206, 86, 0.5)',
          borderColor: 'rgba(255, 206, 86, 1)',
          borderWidth: 1,
        }
      ],
    };
    
    // Time series of latency throughout the day for the first scenario (or selected)
    const firstScenario = labels[0];
    const latencyTimeSeriesData = {
      labels: timeSeriesLabels,
      datasets: [
        {
          label: 'Avg First Packet Latency (ms)',
          data: scenarioData[firstScenario].metrics.latency.hourlyFirstPacketLatency,
          borderColor: 'rgba(255, 99, 132, 1)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          tension: 0.4,
          fill: true
        },
        {
          label: 'Avg Queuing Latency (ms)',
          data: scenarioData[firstScenario].metrics.latency.hourlyQueueingLatency,
          borderColor: 'rgba(54, 162, 235, 1)',
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          tension: 0.4,
          fill: true
        }
      ],
    };
    
    return (
      <>
        <Row className="mb-4">
          <Col>
            <Card>
              <Card.Header>IDLE->CONNECTED Transition Latency</Card.Header>
              <Card.Body>
                <Bar data={idleToConnectedData} 
                  options={{
                    scales: {
                      y: { beginAtZero: true, title: { display: true, text: 'Latency (ms)' } }
                    }
                  }} 
                />
              </Card.Body>
            </Card>
          </Col>
        </Row>
        <Row className="mb-4">
          <Col>
            <Card>
              <Card.Header>Latency Trends Throughout Day ({firstScenario})</Card.Header>
              <Card.Body>
                <Line data={latencyTimeSeriesData}
                  options={{
                    scales: {
                      y: { beginAtZero: true, title: { display: true, text: 'Latency (ms)' } },
                      x: { title: { display: true, text: 'Hour of Day' } }
                    }
                  }}  
                />
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </>
    );
  };
  
  const renderQoSMetrics = (scenarioData) => {
    const labels = Object.keys(scenarioData);
    const goodputData = {
      labels,
      datasets: [
        {
          label: 'Average UL Goodput (Mbps)',
          data: labels.map(scenario => scenarioData[scenario].metrics.qos.avgULGoodput),
          backgroundColor: 'rgba(75, 192, 192, 0.5)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1,
        },
        {
          label: 'Average DL Goodput (Mbps)',
          data: labels.map(scenario => scenarioData[scenario].metrics.qos.avgDLGoodput),
          backgroundColor: 'rgba(153, 102, 255, 0.5)',
          borderColor: 'rgba(153, 102, 255, 1)',
          borderWidth: 1,
        }
      ],
    };
    
    const pdrData = {
      labels,
      datasets: [
        {
          label: 'Packet Delivery Ratio (%)',
          data: labels.map(scenario => scenarioData[scenario].metrics.qos.packetDeliveryRatio * 100),
          backgroundColor: 'rgba(255, 159, 64, 0.5)',
          borderColor: 'rgba(255, 159, 64, 1)',
          borderWidth: 1,
        }
      ],
    };
    
    return (
      <>
        <Row className="mb-4">
          <Col>
            <Card>
              <Card.Header>Average Goodput (UL/DL)</Card.Header>
              <Card.Body>
                <Bar data={goodputData} 
                  options={{
                    scales: {
                      y: { beginAtZero: true, title: { display: true, text: 'Goodput (Mbps)' } }
                    }
                  }} 
                />
              </Card.Body>
            </Card>
          </Col>
        </Row>
        <Row className="mb-4">
          <Col>
            <Card>
              <Card.Header>Packet Delivery Ratio</Card.Header>
              <Card.Body>
                <Bar data={pdrData}
                  options={{
                    scales: {
                      y: { beginAtZero: true, max: 100, title: { display: true, text: 'PDR (%)' } }
                    }
                  }}  
                />
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </>
    );
  };

  const renderConfigurationTab = () => (
    <div className="mt-4">
      <Alert variant="info">
        <strong>Simulation statistique :</strong> Cette application utilise des modèles statistiques pour estimer l'impact de la gestion ECM dans un réseau 4G/LTE sans effectuer une simulation complète à événements discrets.
      </Alert>
      
      <Card className="mb-4">
        <Card.Header>Paramètres de Simulation</Card.Header>
        <Card.Body>
          <Form>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Rayon du réseau (km)</Form.Label>
                  <Form.Control 
                    type="number" 
                    value={simulationParams.R} 
                    onChange={(e) => handleParamChange('R', parseFloat(e.target.value))}
                    min={0.5}
                    step={0.1}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Nombre d'eNodeBs</Form.Label>
                  <Form.Control 
                    type="number" 
                    value={simulationParams.N_eNB} 
                    onChange={(e) => handleParamChange('N_eNB', parseInt(e.target.value))}
                    min={1}
                  />
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Nombre d'UEs</Form.Label>
                  <Form.Control 
                    type="number" 
                    value={simulationParams.N_UE} 
                    onChange={(e) => handleParamChange('N_UE', parseInt(e.target.value))}
                    min={1}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Timer d'inactivité (s) - Mode ECM</Form.Label>
                  <Form.Control 
                    type="number" 
                    value={simulationParams.T_inactivity_C_I} 
                    onChange={(e) => handleParamChange('T_inactivity_C_I', parseFloat(e.target.value))}
                    min={0.1}
                    step={0.1}
                  />
                </Form.Group>
              </Col>
            </Row>
            
            <Form.Group className="mb-3">
              <Form.Check 
                type="checkbox"
                label="Afficher les paramètres avancés"
                checked={showAdvancedParams}
                onChange={(e) => setShowAdvancedParams(e.target.checked)}
              />
            </Form.Group>
            
            {showAdvancedParams && (
              <>
                <h5>Paramètres avancés</h5>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Délai RRC Setup (s)</Form.Label>
                      <Form.Control 
                        type="number" 
                        value={simulationParams.L_RRC_Setup}
                        onChange={(e) => handleParamChange('L_RRC_Setup', parseFloat(e.target.value))}
                        min={0.01}
                        step={0.01}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Délai RRC Release (s)</Form.Label>
                      <Form.Control 
                        type="number" 
                        value={simulationParams.L_RRC_Release}
                        onChange={(e) => handleParamChange('L_RRC_Release', parseFloat(e.target.value))}
                        min={0.01}
                        step={0.01}
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Puissance en état IDLE (mW)</Form.Label>
                      <Form.Control 
                        type="number" 
                        value={simulationParams.P_Idle}
                        onChange={(e) => handleParamChange('P_Idle', parseFloat(e.target.value))}
                        min={0}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Puissance de base en CONNECTED (mW)</Form.Label>
                      <Form.Control 
                        type="number" 
                        value={simulationParams.P_Connected_Base}
                        onChange={(e) => handleParamChange('P_Connected_Base', parseFloat(e.target.value))}
                        min={0}
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Puissance en TX active (mW)</Form.Label>
                      <Form.Control 
                        type="number" 
                        value={simulationParams.P_Tx_Active}
                        onChange={(e) => handleParamChange('P_Tx_Active', parseFloat(e.target.value))}
                        min={0}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Puissance en RX active (mW)</Form.Label>
                      <Form.Control 
                        type="number" 
                        value={simulationParams.P_Rx_Active}
                        onChange={(e) => handleParamChange('P_Rx_Active', parseFloat(e.target.value))}
                        min={0}
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Resource Blocks par TTI</Form.Label>
                      <Form.Control 
                        type="number" 
                        value={simulationParams.N_RB}
                        onChange={(e) => handleParamChange('N_RB', parseInt(e.target.value))}
                        min={1}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Taille de Buffer (paquets)</Form.Label>
                      <Form.Control 
                        type="number" 
                        value={simulationParams.B_size}
                        onChange={(e) => handleParamChange('B_size', parseInt(e.target.value))}
                        min={1}
                      />
                    </Form.Group>
                  </Col>
                </Row>
              </>
            )}
            
            <hr />
            <h5>Scénarios à simuler</h5>
            <Row>
              <Col md={3}>
                <Form.Group className="mb-3">
                  <Form.Check 
                    type="checkbox"
                    id="scenario-a1"
                    label="A1: With ECM + RR"
                    checked={simulationParams.scenarios.includes("A1")}
                    onChange={(e) => {
                      const scenarios = e.target.checked 
                        ? [...simulationParams.scenarios, "A1"]
                        : simulationParams.scenarios.filter(s => s !== "A1");
                      handleParamChange('scenarios', scenarios);
                    }}
                  />
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group className="mb-3">
                  <Form.Check 
                    type="checkbox"
                    id="scenario-a2"
                    label="A2: With ECM + PF"
                    checked={simulationParams.scenarios.includes("A2")}
                    onChange={(e) => {
                      const scenarios = e.target.checked 
                        ? [...simulationParams.scenarios, "A2"]
                        : simulationParams.scenarios.filter(s => s !== "A2");
                      handleParamChange('scenarios', scenarios);
                    }}
                  />
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group className="mb-3">
                  <Form.Check 
                    type="checkbox"
                    id="scenario-b1"
                    label="B1: No ECM + RR"
                    checked={simulationParams.scenarios.includes("B1")}
                    onChange={(e) => {
                      const scenarios = e.target.checked 
                        ? [...simulationParams.scenarios, "B1"]
                        : simulationParams.scenarios.filter(s => s !== "B1");
                      handleParamChange('scenarios', scenarios);
                    }}
                  />
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group className="mb-3">
                  <Form.Check 
                    type="checkbox"
                    id="scenario-b2"
                    label="B2: No ECM + PF"
                    checked={simulationParams.scenarios.includes("B2")}
                    onChange={(e) => {
                      const scenarios = e.target.checked 
                        ? [...simulationParams.scenarios, "B2"]
                        : simulationParams.scenarios.filter(s => s !== "B2");
                      handleParamChange('scenarios', scenarios);
                    }}
                  />
                </Form.Group>
              </Col>
            </Row>
            
            <div className="mt-4 d-flex justify-content-end">
              <Button 
                variant="primary" 
                onClick={startSimulation}
                disabled={isSimulating}
              >
                {isSimulating ? 'Simulation en cours...' : 'Lancer la simulation'}
              </Button>
            </div>
            
            {isSimulating && (
              <div className="mt-3">
                <h6>Progression de la simulation</h6>
                <div className="progress">
                  <div 
                    className="progress-bar" 
                    role="progressbar" 
                    style={{width: `${progress}%`}} 
                    aria-valuenow={progress} 
                    aria-valuemin="0" 
                    aria-valuemax="100"
                  >
                    {progress}%
                  </div>
                </div>
              </div>
            )}
          </Form>
        </Card.Body>
      </Card>
    </div>
  );

  const renderProfilesTab = () => (
    <div className="mt-4">
      <Card>
        <Card.Header>Profils Utilisateurs et Courbes d'Activité</Card.Header>
        <Card.Body>
          {simulationResults ? (
            <>
              <div className="mb-4">
                <h5>Courbes d'activité sur 24h par profil utilisateur</h5>
                <div ref={profilesRef} className="profiles-container" style={{ height: '400px', width: '100%' }}></div>
              </div>
              
              <h5>Description des profils</h5>
              <div className="table-responsive">
                <table className="table table-striped table-hover">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Nom</th>
                      <th>Description</th>
                      <th>Session moyenne</th>
                      <th>Données UL/DL</th>
                      <th>Heures de pointe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {simulationResults.profiles.map(profile => (
                      <tr key={profile.id}>
                        <td>{profile.id}</td>
                        <td>{profile.name}</td>
                        <td>{profile.description}</td>
                        <td>{profile.sessionDuration.avg} min</td>
                        <td>{profile.dataVolume.ul}/{profile.dataVolume.dl} MB</td>
                        <td>
                          {profile.peakHours.length > 0 
                            ? profile.peakHours.map(h => h + 'h').join(', ')
                            : 'Constante'
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <Alert variant="info">Lancez une simulation pour voir les profils utilisateurs et leurs courbes d'activité.</Alert>
          )}
        </Card.Body>
      </Card>
    </div>
  );
  
  const renderTopologyTab = () => (
    <div className="mt-4">
      <Card>
        <Card.Header>Visualisation de la topologie du réseau</Card.Header>
        <Card.Body>
          {simulationResults ? (
            <>
              <div className="d-flex justify-content-between mb-3">
                <div>
                  <strong>eNodeBs:</strong> {simulationResults.topology.eNodeBs.length}
                  <span className="mx-3">|</span>
                  <strong>UEs:</strong> {simulationResults.topology.UEs.length}
                </div>
              </div>
              <div ref={topologyRef} className="topology-container" style={{ height: '600px', width: '100%' }}></div>
              <div className="mt-3">
                <Row>
                  <Col md={6}>
                    <Card className="h-100">
                      <Card.Header>Statistiques des eNodeBs</Card.Header>
                      <Card.Body>
                        <ul>
                          <li><strong>UEs connectés (moyenne):</strong> {simulationResults.topology.stats.meanConnectedUEs.toFixed(2)}</li>
                          <li><strong>UEs connectés (max):</strong> {simulationResults.topology.stats.maxConnectedUEs}</li>
                          <li><strong>RNTIs disponibles:</strong> {simulationResults.topology.stats.totalRNTIs}</li>
                          <li><strong>Taux de réutilisation RNTI:</strong> {simulationResults.topology.stats.rntiReuseRate.toFixed(2)} réutilisations/heure</li>
                        </ul>
                      </Card.Body>
                    </Card>
                  </Col>
                  <Col md={6}>
                    <Card className="h-100">
                      <Card.Header>Distribution des états UE</Card.Header>
                      <Card.Body>
                        <Pie 
                          data={{
                            labels: ['IDLE', 'CONNECTED'],
                            datasets: [
                              {
                                data: [
                                  simulationResults.topology.stats.idleUEs,
                                  simulationResults.topology.stats.connectedUEs
                                ],
                                backgroundColor: [
                                  'rgba(54, 162, 235, 0.6)',
                                  'rgba(75, 192, 192, 0.6)'
                                ]
                              }
                            ]
                          }}
                          options={{
                            plugins: {
                              legend: { position: 'right' }
                            }
                          }}
                        />
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              </div>
            </>
          ) : (
            <Alert variant="info">Lancez une simulation pour voir la topologie du réseau.</Alert>
          )}
        </Card.Body>
      </Card>
    </div>
  );
  
  const renderResultsTab = () => (
    <div className="mt-4">
      {simulationResults ? (
        <>
          <div className="d-flex justify-content-between align-items-center mb-4">
            <Form.Group>
              <Form.Label>Sélectionner un scénario</Form.Label>
              <Form.Select
                value={activeScenario}
                onChange={(e) => setActiveScenario(e.target.value)}
              >
                <option value="all">Tous les scénarios</option>
                {Object.keys(simulationResults.scenarios).map(scenario => (
                  <option key={scenario} value={scenario}>{scenario}</option>
                ))}
              </Form.Select>
            </Form.Group>
            
            <div>
              <div className="btn-group">
                <Button 
                  variant={selectedMetric === 'energy' ? 'primary' : 'outline-primary'} 
                  onClick={() => setSelectedMetric('energy')}
                >
                  Énergie
                </Button>
                <Button 
                  variant={selectedMetric === 'rnti' ? 'primary' : 'outline-primary'} 
                  onClick={() => setSelectedMetric('rnti')}
                >
                  RNTI
                </Button>
                <Button 
                  variant={selectedMetric === 'latency' ? 'primary' : 'outline-primary'} 
                  onClick={() => setSelectedMetric('latency')}
                >
                  Latence
                </Button>
                <Button 
                  variant={selectedMetric === 'qos' ? 'primary' : 'outline-primary'} 
                  onClick={() => setSelectedMetric('qos')}
                >
                  QoS
                </Button>
              </div>
            </div>
          </div>
          
          {renderMetricCharts()}
          
          <Card className="mt-4">
            <Card.Header>Résumé de la simulation</Card.Header>
            <Card.Body>
              <h5>Comparaisons clés</h5>
              <ul>
                <li><strong>Consommation énergétique:</strong> {simulationResults.summary.energyComparison}</li>
                <li><strong>Utilisation RNTI:</strong> {simulationResults.summary.rntiComparison}</li>
                <li><strong>Latence:</strong> {simulationResults.summary.latencyComparison}</li>
                <li><strong>Capacité réseau:</strong> {simulationResults.summary.capacityComparison}</li>
              </ul>
              
              <h5>Recommandation</h5>
              <p>{simulationResults.summary.recommendation}</p>
            </Card.Body>
          </Card>
        </>
      ) : (
        <Alert variant="info">Lancez une simulation pour voir les résultats.</Alert>
      )}
    </div>
  );

  return (
    <Container fluid className="p-4">
      <h1 className="text-center mb-4">Simulation d'Impact de la Gestion ECM dans un Réseau 4G/LTE</h1>
      
      <Tabs
        activeKey={activeTab}
        onSelect={(k) => setActiveTab(k)}
        className="mb-3"
      >
        <Tab eventKey="configuration" title="Configuration">
          {renderConfigurationTab()}
        </Tab>
        <Tab eventKey="profiles" title="Profils Utilisateurs">
          {renderProfilesTab()}
        </Tab>
        <Tab eventKey="topology" title="Topologie">
          {renderTopologyTab()}
        </Tab>
        <Tab eventKey="results" title="Résultats">
          {renderResultsTab()}
        </Tab>
      </Tabs>
    </Container>
  );
}

export default App;