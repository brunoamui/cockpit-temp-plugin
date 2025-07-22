/*
 * Temperature Monitor - Cockpit Plugin
 * Monitor CPU/system temperature with graphing and automatic logging setup
 */

import React, { useEffect, useState } from 'react';
import { Alert } from "@patternfly/react-core/dist/esm/components/Alert/index.js";
import { Card, CardBody, CardTitle } from "@patternfly/react-core/dist/esm/components/Card/index.js";
import { Grid, GridItem } from "@patternfly/react-core/dist/esm/layouts/Grid/index.js";
import { Button } from "@patternfly/react-core/dist/esm/components/Button/index.js";
import { Tabs, Tab, TabTitleText } from "@patternfly/react-core/dist/esm/components/Tabs/index.js";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';

import cockpit from 'cockpit';

const _ = cockpit.gettext;

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

interface TempReading {
    timestamp: string;
    sensorsTemp: number | null;
    thermalTemp: number;
}

interface LoggingStatus {
    isInstalled: boolean;
    isRunning: boolean;
    logExists: boolean;
    lastReading?: TempReading;
    recentReadings: TempReading[];
    currentTemp?: number;
}

interface CurrentTemperature {
    sensors: number | null;
    thermal: number;
}

export const Application = () => {
    const [hostname, setHostname] = useState('');
    const [loggingStatus, setLoggingStatus] = useState<LoggingStatus>({
        isInstalled: false,
        isRunning: false,
        logExists: false,
        recentReadings: []
    });
    const [currentTemp, setCurrentTemp] = useState<CurrentTemperature>({ sensors: null, thermal: 0 });
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<string | number>(0);
    const [timeRange, setTimeRange] = useState<string>('1h');

    // Temperature status colors
    const getTempColor = (temp: number): string => {
        if (temp >= 80) return '#dc3545'; // Critical - red
        if (temp >= 70) return '#fd7e14'; // Hot - orange
        if (temp >= 60) return '#ffc107'; // Warm - yellow
        return '#28a745'; // Normal - green
    };

    const getTempStatus = (temp: number): string => {
        if (temp >= 80) return 'Critical';
        if (temp >= 70) return 'Hot';
        if (temp >= 60) return 'Warm';
        return 'Normal';
    };

    const fetchCurrentTemperature = async () => {
        try {
            // Get current sensor temperature
            const sensorsProc = cockpit.spawn(['sensors'], { superuser: 'try' });
            sensorsProc.done((data) => {
                let sensorsTemp = null;
                const tempLine = data.split('\n').find(line => line.includes('temp1:'));
                if (tempLine) {
                    const match = tempLine.match(/\+([0-9.]+)°C/);
                    if (match) {
                        sensorsTemp = parseFloat(match[1]);
                    }
                }

                // Get thermal zone temperature
                const thermalProc = cockpit.spawn(['cat', '/sys/class/thermal/thermal_zone0/temp'], { superuser: 'try' });
                thermalProc.done((thermalData) => {
                    const rawTemp = parseInt(thermalData.trim());
                    const thermalTemp = rawTemp / 1000;
                    
                    setCurrentTemp({
                        sensors: sensorsTemp,
                        thermal: thermalTemp
                    });
                });
            });

        } catch (error) {
            console.error('Error fetching current temperature:', error);
        }
    };

    const checkLoggingStatus = async () => {
        try {
            setLoading(true);
            
            // Check if logging script exists
            const scriptCheckProc = cockpit.spawn(['test', '-f', '/usr/local/bin/temp_logger.sh'], { superuser: 'try' });
            scriptCheckProc.done(() => {
                // Check if cron job exists
                const cronCheckProc = cockpit.spawn(['grep', 'temp_logger.sh', '/etc/crontab'], { superuser: 'try' });
                cronCheckProc.done(() => {
                    // Both script and cron exist
                    // Check if log file exists and get recent data
                    const logCheckProc = cockpit.spawn(['test', '-f', '/var/log/temperature/temperature.log'], { superuser: 'try' });
                    logCheckProc.done(() => {
                        // Get recent readings
                        const readLogProc = cockpit.spawn(['tail', '-100', '/var/log/temperature/temperature.log'], { superuser: 'try' });
                        readLogProc.done((data) => {
                            const lines = data.split('\n').filter(line => line && !line.startsWith('#'));
                            const recentReadings: TempReading[] = lines.map(line => {
                                const parts = line.split(',');
                                if (parts.length === 3) {
                                    return {
                                        timestamp: parts[0],
                                        sensorsTemp: parts[1] ? parseFloat(parts[1]) : null,
                                        thermalTemp: parseFloat(parts[2])
                                    };
                                }
                                return null;
                            }).filter(reading => reading !== null) as TempReading[];
                            
                            setLoggingStatus({
                                isInstalled: true,
                                isRunning: true,
                                logExists: true,
                                lastReading: recentReadings[recentReadings.length - 1],
                                recentReadings: recentReadings
                            });
                            setLoading(false);
                        });
                    }).fail(() => {
                        setLoggingStatus({
                            isInstalled: true,
                            isRunning: true,
                            logExists: false,
                            recentReadings: []
                        });
                        setLoading(false);
                    });
                }).fail(() => {
                    setLoggingStatus({
                        isInstalled: false,
                        isRunning: false,
                        logExists: false,
                        recentReadings: []
                    });
                    setLoading(false);
                });
            }).fail(() => {
                setLoggingStatus({
                    isInstalled: false,
                    isRunning: false,
                    logExists: false,
                    recentReadings: []
                });
                setLoading(false);
            });

        } catch (error) {
            console.error('Error checking logging status:', error);
            setLoading(false);
        }
    };

    const installLogging = async () => {
        try {
            setLoading(true);
            
            // Create log directory
            await cockpit.spawn(['mkdir', '-p', '/var/log/temperature'], { superuser: 'require' });
            
            // Create logging script
            const scriptContent = `#!/bin/bash

LOG_FILE="/var/log/temperature/temperature.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Get CPU temperature from sensors (extract numeric value)
CPU_TEMP=$(sensors | grep 'temp1:' | awk '{print $2}' | sed 's/[+°C]//g')

# Get raw temperature from thermal zone (in millicelsius)
RAW_TEMP=$(cat /sys/class/thermal/thermal_zone0/temp)
THERMAL_TEMP=$(echo "scale=1; $RAW_TEMP / 1000" | bc)

# Log both readings (CSV format: timestamp,sensors_temp,thermal_temp)
echo "$TIMESTAMP,$CPU_TEMP,$THERMAL_TEMP" >> $LOG_FILE

# Optional: Keep only last 30 days of logs
find /var/log/temperature -name "*.log" -mtime +30 -delete 2>/dev/null
`;
            
            await cockpit.file('/tmp/temp_logger.sh', { superuser: 'require' }).replace(scriptContent);
            await cockpit.spawn(['mv', '/tmp/temp_logger.sh', '/usr/local/bin/'], { superuser: 'require' });
            await cockpit.spawn(['chmod', '+x', '/usr/local/bin/temp_logger.sh'], { superuser: 'require' });
            
            // Add cron job
            await cockpit.spawn(['sh', '-c', 'echo "* * * * * root /usr/local/bin/temp_logger.sh" >> /etc/crontab'], { superuser: 'require' });
            
            // Create log file with header
            await cockpit.spawn(['sh', '-c', 'echo "# Timestamp,Sensors_Temp(C),Thermal_Temp(C)" > /var/log/temperature/temperature.log'], { superuser: 'require' });
            await cockpit.spawn(['chmod', '644', '/var/log/temperature/temperature.log'], { superuser: 'require' });
            
            // Run once immediately
            await cockpit.spawn(['/usr/local/bin/temp_logger.sh'], { superuser: 'require' });
            
            // Refresh status
            await checkLoggingStatus();
            
        } catch (error) {
            console.error('Error installing logging:', error);
            setLoading(false);
        }
    };

    const getChartData = () => {
        const filteredReadings = filterReadingsByTimeRange(loggingStatus.recentReadings);
        
        return {
            labels: filteredReadings.map(reading => new Date(reading.timestamp)),
            datasets: [
                {
                    label: 'Thermal Zone Temperature',
                    data: filteredReadings.map(reading => reading.thermalTemp),
                    borderColor: 'rgb(255, 99, 132)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    tension: 0.1,
                },
                {
                    label: 'Sensors Temperature',
                    data: filteredReadings.map(reading => reading.sensorsTemp || null),
                    borderColor: 'rgb(54, 162, 235)',
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    tension: 0.1,
                    spanGaps: true,
                },
            ],
        };
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top' as const,
            },
            title: {
                display: true,
                text: 'Temperature History',
            },
        },
        scales: {
            x: {
                type: 'time' as const,
                time: {
                    displayFormats: {
                        minute: 'HH:mm',
                        hour: 'HH:mm',
                        day: 'MM/dd',
                    },
                },
            },
            y: {
                beginAtZero: false,
                title: {
                    display: true,
                    text: 'Temperature (°C)',
                },
            },
        },
    };

    const filterReadingsByTimeRange = (readings: TempReading[]): TempReading[] => {
        if (timeRange === 'all') return readings;
        
        const now = new Date();
        let cutoffTime = new Date();
        
        switch (timeRange) {
            case '1h':
                cutoffTime = new Date(now.getTime() - 60 * 60 * 1000);
                break;
            case '6h':
                cutoffTime = new Date(now.getTime() - 6 * 60 * 60 * 1000);
                break;
            case '24h':
                cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                break;
            case '7d':
                cutoffTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            default:
                return readings;
        }
        
        return readings.filter(reading => new Date(reading.timestamp) >= cutoffTime);
    };

    useEffect(() => {
        const hostname = cockpit.file('/etc/hostname');
        hostname.watch(content => setHostname(content?.trim() ?? ""));
        
        fetchCurrentTemperature();
        checkLoggingStatus();
        
        // Refresh every 30 seconds
        const interval = setInterval(() => {
            fetchCurrentTemperature();
            if (loggingStatus.isInstalled) {
                checkLoggingStatus();
            }
        }, 30000);
        
        return () => {
            hostname.close();
            clearInterval(interval);
        };
    }, []);

    const currentTempValue = currentTemp.sensors || currentTemp.thermal;

    return (
        <div style={{height: '100vh', overflowY: 'scroll', padding: '20px'}}>
        <Grid hasGutter>
            <GridItem span={12}>
                <Alert
                    variant="info"
                    title={cockpit.format(_("Temperature Monitor - $0"), hostname)}
                />
            </GridItem>
            
            <GridItem span={12}>
                <Card>
                    <CardBody style={{padding: '0'}}>
                        <Tabs activeKey={activeTab} onSelect={(event, tabIndex) => setActiveTab(tabIndex)}>
                            <Tab eventKey={0} title={<TabTitleText>Current Status</TabTitleText>}>
                                <div style={{padding: '20px'}}>
                                    <Grid hasGutter>
                                        {/* Current Temperature */}
                                        <GridItem span={6}>
                                            <Card>
                                                <CardTitle>Current Temperature</CardTitle>
                                                <CardBody style={{textAlign: 'center'}}>
                                                    <div style={{fontSize: '3em', fontWeight: 'bold', color: getTempColor(currentTempValue)}}>
                                                        {currentTempValue.toFixed(1)}°C
                                                    </div>
                                                    <div style={{fontSize: '1.2em', margin: '10px 0'}}>
                                                        Status: <span style={{color: getTempColor(currentTempValue), fontWeight: 'bold'}}>
                                                            {getTempStatus(currentTempValue)}
                                                        </span>
                                                    </div>
                                                    {currentTemp.sensors && (
                                                        <div style={{fontSize: '0.9em', color: '#666'}}>
                                                            Sensors: {currentTemp.sensors.toFixed(1)}°C | 
                                                            Thermal: {currentTemp.thermal.toFixed(1)}°C
                                                        </div>
                                                    )}
                                                </CardBody>
                                            </Card>
                                        </GridItem>

                                        {/* Logging Status */}
                                        <GridItem span={6}>
                                            <Card>
                                                <CardTitle>
                                                    Temperature Logging
                                                    <Button 
                                                        variant="link" 
                                                        onClick={checkLoggingStatus} 
                                                        isDisabled={loading}
                                                        style={{float: 'right'}}
                                                    >
                                                        {loading ? 'Refreshing...' : 'Refresh'}
                                                    </Button>
                                                </CardTitle>
                                                <CardBody>
                                                    <Alert
                                                        variant={loggingStatus.isInstalled ? 'success' : 'warning'}
                                                        title={`Logging: ${loggingStatus.isInstalled ? 'Active' : 'Not Installed'}`}
                                                    />
                                                    
                                                    {!loggingStatus.isInstalled && (
                                                        <div style={{marginTop: '15px', textAlign: 'center'}}>
                                                            <p>Temperature logging is not set up. Click below to install automatic temperature logging.</p>
                                                            <Button 
                                                                variant="primary"
                                                                onClick={installLogging}
                                                                isDisabled={loading}
                                                                style={{marginTop: '10px'}}
                                                            >
                                                                {loading ? 'Installing...' : 'Install Temperature Logging'}
                                                            </Button>
                                                        </div>
                                                    )}

                                                    {loggingStatus.isInstalled && loggingStatus.lastReading && (
                                                        <div style={{marginTop: '10px', fontSize: '0.9em'}}>
                                                            <div><strong>Last Reading:</strong> {loggingStatus.lastReading.timestamp}</div>
                                                            <div><strong>Temperature:</strong> {loggingStatus.lastReading.thermalTemp.toFixed(1)}°C</div>
                                                            <div><strong>Total Readings:</strong> {loggingStatus.recentReadings.length}</div>
                                                        </div>
                                                    )}
                                                </CardBody>
                                            </Card>
                                        </GridItem>
                                    </Grid>
                                </div>
                            </Tab>
                            
                            <Tab eventKey={1} title={<TabTitleText>Temperature Graph</TabTitleText>}>
                                <div style={{padding: '20px'}}>
                                    {loggingStatus.isInstalled && loggingStatus.recentReadings.length > 0 ? (
                                        <>
                                            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                                                <h3>Temperature History</h3>
                                                <select 
                                                    value={timeRange} 
                                                    onChange={(e) => setTimeRange(e.target.value)}
                                                    style={{
                                                        padding: '8px 12px',
                                                        borderRadius: '4px',
                                                        border: '1px solid #ccc',
                                                        backgroundColor: 'white',
                                                        fontSize: '14px',
                                                        minWidth: '150px'
                                                    }}
                                                >
                                                    <option value="1h">Last Hour</option>
                                                    <option value="6h">Last 6 Hours</option>
                                                    <option value="24h">Last 24 Hours</option>
                                                    <option value="7d">Last 7 Days</option>
                                                    <option value="all">All Time</option>
                                                </select>
                                            </div>
                                            
                                            <div style={{height: '400px'}}>
                                                <Line data={getChartData()} options={chartOptions} />
                                            </div>
                                        </>
                                    ) : (
                                        <Card>
                                            <CardBody style={{textAlign: 'center', padding: '60px'}}>
                                                <div style={{color: '#666', fontSize: '1.2em'}}>
                                                    {!loggingStatus.isInstalled ? (
                                                        <p>Temperature logging is not installed. Please go to the Status tab to install it.</p>
                                                    ) : (
                                                        <p>No temperature data available yet. Please wait for data collection to begin.</p>
                                                    )}
                                                </div>
                                            </CardBody>
                                        </Card>
                                    )}
                                </div>
                            </Tab>
                        </Tabs>
                    </CardBody>
                </Card>
            </GridItem>
        </Grid>
        </div>
    );
};
