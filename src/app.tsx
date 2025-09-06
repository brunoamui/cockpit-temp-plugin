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
    tmp102Temp?: number | null;
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
    tmp102?: number | null;
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
                let tmp102Temp = null;
                
                const lines = data.split('\n');
                let inTmp102Section = false;
                
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    
                    // Check if we're entering the TMP102 section
                    if (line.toLowerCase().includes('tmp102')) {
                        inTmp102Section = true;
                        continue;
                    }
                    
                    // Check if we're leaving the current section (empty line)
                    if (line.trim() === '') {
                        if (inTmp102Section) {
                            inTmp102Section = false;
                        }
                        continue;
                    }
                    
                    // Check if we're entering a new sensor section (not the adapter line for current sensor)
                    if (line.toLowerCase().includes('adapter:') && inTmp102Section) {
                        // This is the adapter line for the TMP102, don't exit the section
                        continue;
                    }
                    
                    // Parse temperature values
                    if (line.includes('temp1:')) {
                        const match = line.match(/\+([0-9.]+)\s*°?C/);
                        if (match) {
                            if (inTmp102Section) {
                                tmp102Temp = parseFloat(match[1]);
                            } else if (!sensorsTemp) {
                                // First temp1 found (CPU sensors)
                                sensorsTemp = parseFloat(match[1]);
                            }
                        }
                    }
                }

                // Get thermal zone temperature
                const thermalProc = cockpit.spawn(['cat', '/sys/class/thermal/thermal_zone0/temp'], { superuser: 'try' });
                thermalProc.done((thermalData) => {
                    const rawTemp = parseInt(thermalData.trim());
                    const thermalTemp = rawTemp / 1000;
                    
                    setCurrentTemp({
                        sensors: sensorsTemp,
                        thermal: thermalTemp,
                        tmp102: tmp102Temp
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
                        // Get recent readings from current log and archives - up to 50,000 lines for more history
                        const readLogProc = cockpit.spawn(['sh', '-c', 'cat /var/log/temperature/temperature.log 2>/dev/null; zcat /var/log/temperature/temperature.log.*.gz 2>/dev/null | sort || true'], { superuser: 'try' });
                        readLogProc.done((data) => {
                            const lines = data.split('\n').filter(line => line && !line.startsWith('#'));
                            
                            // Parse all readings first
                            const allReadings: TempReading[] = lines.map(line => {
                                const parts = line.split(',');
                                // Handle both old format (3 columns) and new format (4 columns with TMP102)
                                if (parts.length === 3) {
                                    return {
                                        timestamp: parts[0],
                                        sensorsTemp: parts[1] ? parseFloat(parts[1]) : null,
                                        thermalTemp: parseFloat(parts[2])
                                    };
                                } else if (parts.length === 4) {
                                    return {
                                        timestamp: parts[0],
                                        sensorsTemp: parts[1] ? parseFloat(parts[1]) : null,
                                        thermalTemp: parseFloat(parts[2]),
                                        tmp102Temp: parts[3] ? parseFloat(parts[3]) : null
                                    };
                                }
                                return null;
                            }).filter(reading => reading !== null) as TempReading[];
                            
                            // Sort by timestamp to ensure chronological order
                            const sortedReadings = allReadings.sort((a, b) => 
                                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                            );
                            
                            // Keep last 30,000 readings (about 20+ days) for better performance
                            const recentReadings = sortedReadings.slice(-30000);
                            
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
        const hasTmp102Data = filteredReadings.some(reading => reading.tmp102Temp !== undefined && reading.tmp102Temp !== null);
        
        const datasets = [
            {
                label: 'CPU Temperature (Thermal Zone)',
                data: filteredReadings.map(reading => reading.thermalTemp),
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                tension: 0.1,
                borderWidth: 2,
            },
            {
                label: 'CPU Temperature (Sensors)',
                data: filteredReadings.map(reading => reading.sensorsTemp || null),
                borderColor: 'rgb(54, 162, 235)',
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                tension: 0.1,
                spanGaps: true,
                borderWidth: 2,
            },
        ];
        
        // Add TMP102 environmental sensor if data is available
        if (hasTmp102Data) {
            datasets.push({
                label: 'Environmental Temperature (TMP102)',
                data: filteredReadings.map(reading => reading.tmp102Temp || null),
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                tension: 0.1,
                spanGaps: true,
                borderWidth: 2,
            });
        }
        
        return {
            labels: filteredReadings.map(reading => new Date(reading.timestamp)),
            datasets: datasets,
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
            case '3d':
                cutoffTime = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
                break;
            case '7d':
                cutoffTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '14d':
                cutoffTime = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
                break;
            case '30d':
                cutoffTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
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
                                                    <div style={{fontSize: '0.9em', color: '#666', marginTop: '10px'}}>
                                                        {currentTemp.sensors && (
                                                            <div>CPU Sensors: {currentTemp.sensors.toFixed(1)}°C</div>
                                                        )}
                                                        <div>CPU Thermal: {currentTemp.thermal.toFixed(1)}°C</div>
                                                        {currentTemp.tmp102 && (
                                                            <div>Environment (TMP102): {currentTemp.tmp102.toFixed(1)}°C</div>
                                                        )}
                                                    </div>
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
                                                            <div><strong>CPU:</strong> {loggingStatus.lastReading.thermalTemp.toFixed(1)}°C</div>
                                                            {loggingStatus.lastReading.tmp102Temp && (
                                                                <div><strong>Environment:</strong> {loggingStatus.lastReading.tmp102Temp.toFixed(1)}°C</div>
                                                            )}
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
                                                <div>
                                                    <h3>Temperature History</h3>
                                                    <div style={{fontSize: '0.9em', color: '#666', marginTop: '5px'}}>
                                                        Showing {filterReadingsByTimeRange(loggingStatus.recentReadings).length} of {loggingStatus.recentReadings.length} readings
                                                    </div>
                                                </div>
                                                <select 
                                                    value={timeRange} 
                                                    onChange={(e) => setTimeRange(e.target.value)}
                                                    style={{
                                                        padding: '8px 12px',
                                                        borderRadius: '4px',
                                                        border: '1px solid #ccc',
                                                        backgroundColor: 'white',
                                                        color: '#333',
                                                        fontSize: '14px',
                                                        fontWeight: '500',
                                                        minWidth: '150px',
                                                        cursor: 'pointer',
                                                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                                                        transition: 'border-color 0.2s, box-shadow 0.2s'
                                                    }}
                                                    onFocus={(e) => {
                                                        e.target.style.borderColor = '#0066cc';
                                                        e.target.style.boxShadow = '0 0 0 2px rgba(0, 102, 204, 0.2)';
                                                    }}
                                                    onBlur={(e) => {
                                                        e.target.style.borderColor = '#ccc';
                                                        e.target.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.1)';
                                                    }}
                                                >
                                                    <option value="1h" style={{color: '#333', backgroundColor: 'white'}}>Last Hour</option>
                                                    <option value="6h" style={{color: '#333', backgroundColor: 'white'}}>Last 6 Hours</option>
                                                    <option value="24h" style={{color: '#333', backgroundColor: 'white'}}>Last 24 Hours</option>
                                                    <option value="3d" style={{color: '#333', backgroundColor: 'white'}}>Last 3 Days</option>
                                                    <option value="7d" style={{color: '#333', backgroundColor: 'white'}}>Last 7 Days</option>
                                                    <option value="14d" style={{color: '#333', backgroundColor: 'white'}}>Last 14 Days</option>
                                                    <option value="30d" style={{color: '#333', backgroundColor: 'white'}}>Last 30 Days</option>
                                                    <option value="all" style={{color: '#333', backgroundColor: 'white'}}>All Time</option>
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
