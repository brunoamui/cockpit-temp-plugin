/*
 * ADS-B Monitor - Cockpit Plugin
 * Monitor ADS-B receiver statistics and embedded tar1090 map
 */

import React, { useEffect, useState } from 'react';
import { Alert } from "@patternfly/react-core/dist/esm/components/Alert/index.js";
import { Card, CardBody, CardTitle } from "@patternfly/react-core/dist/esm/components/Card/index.js";
import { Grid, GridItem } from "@patternfly/react-core/dist/esm/layouts/Grid/index.js";
import { Button } from "@patternfly/react-core/dist/esm/components/Button/index.js";
import { Tabs, Tab, TabTitleText } from "@patternfly/react-core/dist/esm/components/Tabs/index.js";

import cockpit from 'cockpit';

const _ = cockpit.gettext;

interface ADSBStats {
    now: number;
    gain_db: number;
    estimated_ppm: number;
    aircraft_with_pos: number;
    aircraft_without_pos: number;
    aircraft_count_by_type: {[key: string]: number};
    last1min: PeriodStats;
    last5min: PeriodStats;
    last15min: PeriodStats;
    total: PeriodStats;
}

interface PeriodStats {
    start: number;
    end: number;
    messages: number;
    messages_valid: number;
    position_count_total: number;
    max_distance: number;
    local: {
        samples_processed: number;
        samples_dropped: number;
        samples_lost: number;
        modes: number;
        bad: number;
        unknown_icao: number;
        accepted: number[];
        signal: number;
        noise: number;
        peak_signal: number;
        strong_signals: number;
    };
    tracks: {
        all: number;
        single_message: number;
    };
    cpu: {
        demod: number;
        reader: number;
        background: number;
    };
}

interface ReceiverInfo {
    status: string;
    uptime: string;
    version: string;
    sampleRate: string;
    gain: string;
    ppm: string;
}

export const Application = () => {
    const [hostname, setHostname] = useState('');
    const [stats, setStats] = useState<ADSBStats | null>(null);
    const [receiverInfo, setReceiverInfo] = useState<ReceiverInfo>({
        status: 'Unknown',
        uptime: 'N/A',
        version: 'N/A',
        sampleRate: 'N/A',
        gain: 'N/A',
        ppm: 'N/A'
    });
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<string | number>(0);

    const fetchADSBStats = async () => {
        try {
            setLoading(true);

            // Fetch tar1090 stats
            const statsProc = cockpit.spawn(['curl', '-s', 'http://localhost/tar1090/data/stats.json'], { superuser: 'try' });
            statsProc.done((data) => {
                try {
                    const parsedStats = JSON.parse(data);
                    setStats(parsedStats);
                } catch (e) {
                    console.error('Error parsing stats JSON:', e);
                }
            });

            // Check readsb service status
            const statusProc = cockpit.spawn(['systemctl', 'status', 'readsb', '--no-pager', '-l'], { superuser: 'try' });
            statusProc.done((data) => {
                const lines = data.split('\n');
                let isActive = false;
                let startTime = '';
                
                for (const line of lines) {
                    if (line.includes('Active:')) {
                        isActive = line.includes('active (running)');
                        const match = line.match(/since\s+(.+?);/);
                        if (match) {
                            startTime = match[1];
                        }
                    }
                }
                
                setReceiverInfo(prev => ({
                    ...prev,
                    status: isActive ? 'Active' : 'Inactive',
                    uptime: startTime || 'N/A'
                }));
            }).fail(() => {
                setReceiverInfo(prev => ({ ...prev, status: 'Service check failed' }));
            });

            setLoading(false);
        } catch (error) {
            console.error('Error fetching ADS-B stats:', error);
            setLoading(false);
        }
    };

    useEffect(() => {
        const hostname = cockpit.file('/etc/hostname');
        hostname.watch(content => setHostname(content?.trim() ?? ""));
        
        fetchADSBStats();
        
        // Refresh every 10 seconds
        const interval = setInterval(fetchADSBStats, 10000);
        
        return () => {
            hostname.close();
            clearInterval(interval);
        };
    }, []);

    const formatNumber = (num: number): string => {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    };

    const formatDistance = (meters: number): string => {
        if (meters >= 1000) {
            return (meters / 1000).toFixed(1) + ' km';
        }
        return meters + ' m';
    };

    const getSignalQuality = (signal: number, noise: number): { level: string, color: string } => {
        const snr = signal - noise;
        if (snr > 20) return { level: 'Excellent', color: '#28a745' };
        if (snr > 15) return { level: 'Good', color: '#28a745' };
        if (snr > 10) return { level: 'Fair', color: '#ffc107' };
        return { level: 'Poor', color: '#dc3545' };
    };

    return (
        <div style={{height: '100vh', overflowY: 'scroll', padding: '20px'}}>
        <Grid hasGutter>
            <GridItem span={12}>
                <Alert
                    variant="info"
                    title={cockpit.format(_("ADS-B Monitor - $0"), hostname)}
                />
            </GridItem>
            
            <GridItem span={12}>
                <Card>
                    <CardBody style={{padding: '0'}}>
                        <Tabs activeKey={activeTab} onSelect={(event, tabIndex) => setActiveTab(tabIndex)}>
                            <Tab eventKey={0} title={<TabTitleText>Live Map</TabTitleText>}>
                                <div style={{padding: '20px', textAlign: 'center'}}>
                                    <Card>
                                        <CardTitle>tar1090 Live Aircraft Map</CardTitle>
                                        <CardBody style={{textAlign: 'center', padding: '40px'}}>
                                            <div style={{marginBottom: '20px', color: '#666'}}>
                                                <p>Click the button below to open the live aircraft tracking map.</p>
                                                <p style={{fontSize: '0.9em'}}>The map will open in a new tab/window and show real-time aircraft positions, tracks, and details.</p>
                                            </div>
                                            <Button 
                                                variant="primary" 
                                                size="lg"
                                                onClick={() => window.open('http://radiogps/tar1090/', '_blank')}
                                                style={{padding: '12px 24px', fontSize: '16px'}}
                                            >
                                                🛩️ Open Live Map
                                            </Button>
                                            <div style={{marginTop: '20px', fontSize: '0.85em', color: '#888'}}>
                                                <p>Map features:</p>
                                                <ul style={{listStyle: 'none', padding: 0}}>
                                                    <li>• Real-time aircraft positions</li>
                                                    <li>• Flight tracks and history</li>
                                                    <li>• Aircraft details and flight info</li>
                                                    <li>• Range and coverage visualization</li>
                                                </ul>
                                            </div>
                                        </CardBody>
                                    </Card>
                                </div>
                            </Tab>
                            <Tab eventKey={1} title={<TabTitleText>Statistics</TabTitleText>}>
                                <div style={{padding: '20px'}}>
                                    <Grid hasGutter>
                                        {/* Receiver Status */}
                                        <GridItem span={6}>
                                            <Card>
                                                <CardTitle>
                                                    Receiver Status
                                                    <Button 
                                                        variant="link" 
                                                        onClick={fetchADSBStats} 
                                                        isDisabled={loading}
                                                        style={{float: 'right'}}
                                                    >
                                                        {loading ? 'Refreshing...' : 'Refresh'}
                                                    </Button>
                                                </CardTitle>
                                                <CardBody>
                                                    <Alert
                                                        variant={receiverInfo.status === 'Active' ? 'success' : 'danger'}
                                                        title={`Readsb Service: ${receiverInfo.status}`}
                                                    />
                                                    {stats && (
                                                        <div style={{marginTop: '10px', fontSize: '0.9em'}}>
                                                            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px'}}>
                                                                <div>
                                                                    <strong>Receiver Gain:</strong><br/>
                                                                    {stats.gain_db.toFixed(1)} dB<br/>
                                                                    <strong>PPM Correction:</strong><br/>
                                                                    {stats.estimated_ppm.toFixed(1)} ppm
                                                                </div>
                                                                <div>
                                                                    <strong>Started:</strong><br/>
                                                                    {receiverInfo.uptime}<br/>
                                                                    <strong>Current Aircraft:</strong><br/>
                                                                    {stats.aircraft_with_pos + stats.aircraft_without_pos} total
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </CardBody>
                                            </Card>
                                        </GridItem>

                                        {/* Signal Quality */}
                                        <GridItem span={6}>
                                            <Card>
                                                <CardTitle>Signal Quality</CardTitle>
                                                <CardBody>
                                                    {stats && (
                                                        <div>
                                                            <Alert
                                                                variant={getSignalQuality(stats.last1min.local.signal, stats.last1min.local.noise).level === 'Excellent' || getSignalQuality(stats.last1min.local.signal, stats.last1min.local.noise).level === 'Good' ? 'success' : getSignalQuality(stats.last1min.local.signal, stats.last1min.local.noise).level === 'Fair' ? 'warning' : 'danger'}
                                                                title={`Signal Quality: ${getSignalQuality(stats.last1min.local.signal, stats.last1min.local.noise).level}`}
                                                            />
                                                            <div style={{marginTop: '10px', fontSize: '0.85em'}}>
                                                                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '0.8em'}}>
                                                                    <div style={{textAlign: 'center', padding: '6px', backgroundColor: '#f8f9fa', borderRadius: '4px'}}>
                                                                        <div style={{fontWeight: 'bold', color: '#495057'}}>Signal</div>
                                                                        <div style={{color: '#007bff', fontWeight: 'bold'}}>{stats.last1min.local.signal.toFixed(1)} dBFS</div>
                                                                    </div>
                                                                    <div style={{textAlign: 'center', padding: '6px', backgroundColor: '#f8f9fa', borderRadius: '4px'}}>
                                                                        <div style={{fontWeight: 'bold', color: '#495057'}}>Noise</div>
                                                                        <div style={{color: '#28a745'}}>{stats.last1min.local.noise.toFixed(1)} dBFS</div>
                                                                    </div>
                                                                    <div style={{textAlign: 'center', padding: '6px', backgroundColor: '#f8f9fa', borderRadius: '4px'}}>
                                                                        <div style={{fontWeight: 'bold', color: '#495057'}}>Peak Signal</div>
                                                                        <div style={{color: '#dc3545', fontWeight: 'bold'}}>{stats.last1min.local.peak_signal.toFixed(1)} dBFS</div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </CardBody>
                                            </Card>
                                        </GridItem>

                                        {/* Live Statistics */}
                                        <GridItem span={12}>
                                            <Card>
                                                <CardTitle>Current Activity (Last 1 minute)</CardTitle>
                                                <CardBody>
                                                    {stats && (
                                                        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', fontSize: '0.85em'}}>
                                                            <div style={{textAlign: 'center', padding: '8px', backgroundColor: '#e7f3ff', borderRadius: '8px', border: '1px solid #b3d9ff'}}>
                                                                <div style={{fontWeight: 'bold', color: '#495057'}}>Aircraft with Position</div>
                                                                <div style={{color: '#007bff', fontWeight: 'bold', fontSize: '1.2em'}}>{stats.aircraft_with_pos}</div>
                                                            </div>
                                                            <div style={{textAlign: 'center', padding: '8px', backgroundColor: '#e8f5e8', borderRadius: '8px', border: '1px solid #b3e6b3'}}>
                                                                <div style={{fontWeight: 'bold', color: '#495057'}}>Messages</div>
                                                                <div style={{color: '#28a745', fontWeight: 'bold', fontSize: '1.2em'}}>{formatNumber(stats.last1min.messages)}</div>
                                                            </div>
                                                            <div style={{textAlign: 'center', padding: '8px', backgroundColor: '#fff3e0', borderRadius: '8px', border: '1px solid #ffcc80'}}>
                                                                <div style={{fontWeight: 'bold', color: '#495057'}}>Valid Positions</div>
                                                                <div style={{color: '#ff9800', fontWeight: 'bold', fontSize: '1.2em'}}>{stats.last1min.position_count_total}</div>
                                                            </div>
                                                            <div style={{textAlign: 'center', padding: '8px', backgroundColor: '#fce4ec', borderRadius: '8px', border: '1px solid #f8bbd9'}}>
                                                                <div style={{fontWeight: 'bold', color: '#495057'}}>Max Range</div>
                                                                <div style={{color: '#e91e63', fontWeight: 'bold', fontSize: '1.2em'}}>{formatDistance(stats.last1min.max_distance)}</div>
                                                            </div>
                                                            <div style={{textAlign: 'center', padding: '8px', backgroundColor: '#f3e5f5', borderRadius: '8px', border: '1px solid #ce93d8'}}>
                                                                <div style={{fontWeight: 'bold', color: '#495057'}}>Active Tracks</div>
                                                                <div style={{color: '#9c27b0', fontWeight: 'bold', fontSize: '1.2em'}}>{stats.last1min.tracks.all}</div>
                                                            </div>
                                                            <div style={{textAlign: 'center', padding: '8px', backgroundColor: '#e0f2f1', borderRadius: '8px', border: '1px solid #80cbc4'}}>
                                                                <div style={{fontWeight: 'bold', color: '#495057'}}>CPU Usage</div>
                                                                <div style={{color: '#009688', fontWeight: 'bold', fontSize: '1.2em'}}>{((stats.last1min.cpu.demod + stats.last1min.cpu.reader + stats.last1min.cpu.background) / 1000).toFixed(1)}%</div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </CardBody>
                                            </Card>
                                        </GridItem>

                                        {/* Historical Statistics */}
                                        <GridItem span={12}>
                                            <Card>
                                                <CardTitle>Historical Statistics</CardTitle>
                                                <CardBody>
                                                    {stats && (
                                                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px', fontSize: '0.85em'}}>
                                                            <div>
                                                                <div style={{fontWeight: 'bold', marginBottom: '8px', textAlign: 'center', color: '#495057'}}>Last 1 min</div>
                                                                <div style={{padding: '8px', backgroundColor: '#f8f9fa', borderRadius: '6px'}}>
                                                                    <div><strong>Messages:</strong> {formatNumber(stats.last1min.messages)}</div>
                                                                    <div><strong>Aircraft:</strong> {stats.aircraft_with_pos}</div>
                                                                    <div><strong>Max Range:</strong> {formatDistance(stats.last1min.max_distance)}</div>
                                                                    <div><strong>Signal:</strong> {stats.last1min.local.signal.toFixed(1)} dBFS</div>
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div style={{fontWeight: 'bold', marginBottom: '8px', textAlign: 'center', color: '#495057'}}>Last 5 min</div>
                                                                <div style={{padding: '8px', backgroundColor: '#f8f9fa', borderRadius: '6px'}}>
                                                                    <div><strong>Messages:</strong> {formatNumber(stats.last5min.messages)}</div>
                                                                    <div><strong>Positions:</strong> {stats.last5min.position_count_total}</div>
                                                                    <div><strong>Max Range:</strong> {formatDistance(stats.last5min.max_distance)}</div>
                                                                    <div><strong>Signal:</strong> {stats.last5min.local.signal.toFixed(1)} dBFS</div>
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div style={{fontWeight: 'bold', marginBottom: '8px', textAlign: 'center', color: '#495057'}}>Last 15 min</div>
                                                                <div style={{padding: '8px', backgroundColor: '#f8f9fa', borderRadius: '6px'}}>
                                                                    <div><strong>Messages:</strong> {formatNumber(stats.last15min.messages)}</div>
                                                                    <div><strong>Positions:</strong> {stats.last15min.position_count_total}</div>
                                                                    <div><strong>Max Range:</strong> {formatDistance(stats.last15min.max_distance)}</div>
                                                                    <div><strong>Signal:</strong> {stats.last15min.local.signal.toFixed(1)} dBFS</div>
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div style={{fontWeight: 'bold', marginBottom: '8px', textAlign: 'center', color: '#495057'}}>Total</div>
                                                                <div style={{padding: '8px', backgroundColor: '#f8f9fa', borderRadius: '6px'}}>
                                                                    <div><strong>Messages:</strong> {formatNumber(stats.total.messages)}</div>
                                                                    <div><strong>Positions:</strong> {stats.total.position_count_total}</div>
                                                                    <div><strong>Max Range:</strong> {formatDistance(stats.total.max_distance)}</div>
                                                                    <div><strong>Tracks:</strong> {stats.total.tracks.all}</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </CardBody>
                                            </Card>
                                        </GridItem>
                                    </Grid>
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
