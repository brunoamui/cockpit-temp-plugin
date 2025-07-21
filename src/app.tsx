/*
 * GPS NTP Server Monitor - Cockpit Plugin
 * Monitor GPS time synchronization and NTP client connections
 */

import React, { useEffect, useState } from 'react';
import { Alert } from "@patternfly/react-core/dist/esm/components/Alert/index.js";
import { Card, CardBody, CardTitle } from "@patternfly/react-core/dist/esm/components/Card/index.js";
import { Grid, GridItem } from "@patternfly/react-core/dist/esm/layouts/Grid/index.js";
import { List, ListItem } from "@patternfly/react-core/dist/esm/components/List/index.js";
import { Button } from "@patternfly/react-core/dist/esm/components/Button/index.js";

import cockpit from 'cockpit';

const _ = cockpit.gettext;

interface NTPSource {
    name: string;
    stratum: string;
    offset: string;
    status: string;
    reach: string;
}

interface NTPClient {
    hostname: string;
    ntpRequests: string;
    ntpDrop: string;
    ntpInterval: string;
    ntpIntervalLast: string;
    ntpLast: string;
    cmdRequests: string;
    cmdDrop: string;
    cmdInterval: string;
    cmdLast: string;
}

interface GPSInfo {
    status: string;
    satellites: string;
    latitude: string;
    longitude: string;
    altitude: string;
    mode: string;
    hdop: string;
    pdop: string;
    vdop: string;
    speed: string;
    climb: string;
    time: string;
    ept: string;
    satellitesVisible: number;
    satellitesUsed: number;
    bestSatellite: { prn: string, ss: number } | null;
}

interface PPSInfo {
    available: boolean;
    offset: string;
    jitter: string;
    frequency: string;
    skew: string;
    stratum: string;
    refId: string;
    systemTime: string;
    lastOffset: string;
    rmsOffset: string;
    updateInterval: string;
}

export const Application = () => {
    const [hostname, setHostname] = useState('');
    const [sources, setSources] = useState<NTPSource[]>([]);
    const [clients, setClients] = useState<NTPClient[]>([]);
    const [gpsStatus, setGpsStatus] = useState('Unknown');
    const [gpsInfo, setGpsInfo] = useState<GPSInfo>({ 
        status: 'Unknown', 
        satellites: '0', 
        latitude: 'N/A', 
        longitude: 'N/A', 
        altitude: 'N/A', 
        mode: 'N/A',
        hdop: 'N/A',
        pdop: 'N/A', 
        vdop: 'N/A',
        speed: 'N/A',
        climb: 'N/A',
        time: 'N/A',
        ept: 'N/A',
        satellitesVisible: 0,
        satellitesUsed: 0,
        bestSatellite: null
    });
    const [ppsInfo, setPpsInfo] = useState<PPSInfo>({
        available: false,
        offset: 'N/A',
        jitter: 'N/A',
        frequency: 'N/A',
        skew: 'N/A',
        stratum: 'N/A',
        refId: 'N/A',
        systemTime: 'N/A',
        lastOffset: 'N/A',
        rmsOffset: 'N/A',
        updateInterval: 'N/A'
    });
    const [loading, setLoading] = useState(false);

    const fetchNTPStatus = async () => {
        try {
            // Get chrony sources
            const sourcesProc = cockpit.spawn(['chronyc', 'sources', '-v'], { superuser: 'try' });
            sourcesProc.done((data) => {
                const lines = data.split('\n');
                const sourceData: NTPSource[] = [];
                
                for (const line of lines) {
                    if (line.startsWith('^') || line.startsWith('#')) {
                        const parts = line.split(/\s+/);
                        if (parts.length >= 7) {
                            sourceData.push({
                                name: parts[1] || 'Unknown',
                                stratum: parts[2] || '0',
                                poll: parts[3] || '0',
                                reach: parts[4] || '0',
                                status: line[0],
                                offset: parts[6] || '0'
                            });
                        }
                    }
                }
                setSources(sourceData);
                
                // Check for GPS source
                const hasGPS = sourceData.some(s => s.name.includes('GPS') || s.name.includes('PPS'));
                setGpsStatus(hasGPS ? "Active" : "Not detected");
                
                // Get GPS information
                const gpsProc = cockpit.spawn(['gpsd', '-V'], { superuser: 'try' });
                gpsProc.done(() => {
                    // Try to get GPS status from gpspipe
                    const gpsStatusProc = cockpit.spawn(['timeout', '3', 'gpspipe', '-w', '-n', '10'], { superuser: 'try' });
                    gpsStatusProc.done((gpsData) => {
                        try {
                            const lines = gpsData.split('\n');
                            let tpvData = null;
                            let skyData = null;
                            
                            // Parse GPS data
                            for (const line of lines) {
                                if (line.trim()) {
                                    const data = JSON.parse(line);
                                    if (data.class === 'TPV' && data.lat && data.lon) {
                                        tpvData = data;
                                    }
                                    if (data.class === 'SKY' && data.satellites) {
                                        skyData = data;
                                    }
                                }
                            }
                            
                            if (tpvData) {
                                const satUsed = skyData ? skyData.satellites.filter(sat => sat.used).length : 0;
                                const satVisible = skyData ? skyData.nSat : 0;
                                const bestSat = skyData ? 
                                    skyData.satellites.reduce((best, sat) => 
                                        sat.ss > (best?.ss || 0) ? sat : best, null) : null;
                                
                                setGpsInfo({
                                    status: tpvData.mode >= 2 ? 'Fix acquired' : 'No fix',
                                    satellites: satUsed.toString(),
                                    latitude: tpvData.lat.toFixed(6),
                                    longitude: tpvData.lon.toFixed(6),
                                    altitude: tpvData.alt ? tpvData.alt.toFixed(1) + 'm' : 'N/A',
                                    mode: tpvData.mode === 3 ? '3D Fix' : tpvData.mode === 2 ? '2D Fix' : 'No Fix',
                                    hdop: skyData?.hdop ? skyData.hdop.toFixed(2) : 'N/A',
                                    pdop: skyData?.pdop ? skyData.pdop.toFixed(2) : 'N/A',
                                    vdop: skyData?.vdop ? skyData.vdop.toFixed(2) : 'N/A',
                                    speed: tpvData.speed ? (tpvData.speed * 3.6).toFixed(1) + ' km/h' : '0.0 km/h',
                                    climb: tpvData.climb ? tpvData.climb.toFixed(1) + ' m/s' : '0.0 m/s',
                                    time: tpvData.time ? new Date(tpvData.time).toLocaleTimeString() : 'N/A',
                                    ept: tpvData.ept ? (tpvData.ept * 1000).toFixed(1) + ' ms' : 'N/A',
                                    satellitesVisible: satVisible,
                                    satellitesUsed: satUsed,
                                    bestSatellite: bestSat ? { prn: bestSat.PRN.toString(), ss: bestSat.ss } : null
                                });
                            }
                        } catch (e) {
                            // GPS data parsing failed, keep defaults
                        }
                    }).fail(() => {
                        // gpspipe not available or failed
                        setGpsInfo(prev => ({ ...prev, status: hasGPS ? 'Active' : 'Not available' }));
                    });
                }).fail(() => {
                    // GPS daemon not available
                    setGpsInfo(prev => ({ ...prev, status: 'GPS daemon not running' }));
                });
            });

            // Get chrony clients
            const clientsProc = cockpit.spawn(['chronyc', 'clients'], { superuser: 'try' });
            clientsProc.done((data) => {
                const lines = data.split('\n');
                const clientData: NTPClient[] = [];
                
                for (const line of lines) {
                    if (line && !line.startsWith('Hostname') && !line.startsWith('=')) {
                        const parts = line.split(/\s+/).filter(part => part !== '');
                        if (parts.length >= 10) {
                            clientData.push({
                                hostname: parts[0] || 'Unknown',
                                ntpRequests: parts[1] || '0',
                                ntpDrop: parts[2] || '0',
                                ntpInterval: parts[3] || '-',
                                ntpIntervalLast: parts[4] || '-',
                                ntpLast: parts[5] || '-',
                                cmdRequests: parts[6] || '0',
                                cmdDrop: parts[7] || '0',
                                cmdInterval: parts[8] || '-',
                                cmdLast: parts[9] || '-'
                            });
                        }
                    }
                }
                setClients(clientData);
            });
            
            // Get PPS and chrony tracking info
            const trackingProc = cockpit.spawn(['chronyc', 'tracking'], { superuser: 'try' });
            trackingProc.done((data) => {
                const lines = data.split('\n');
                const trackingData: any = {};
                
                for (const line of lines) {
                    if (line.includes(':')) {
                        const [key, value] = line.split(':').map(s => s.trim());
                        trackingData[key] = value;
                    }
                }
                
                // Get source statistics for PPS jitter
                const sourcestatsProc = cockpit.spawn(['chronyc', 'sourcestats'], { superuser: 'try' });
                sourcestatsProc.done((statsData) => {
                    const statsLines = statsData.split('\n');
                    let gpsStats = null;
                    
                    for (const line of statsLines) {
                        if (line.includes('GPS') && !line.startsWith('Name')) {
                            const parts = line.split(/\s+/).filter(p => p);
                            if (parts.length >= 8) {
                                gpsStats = {
                                    name: parts[0],
                                    offset: parts[6],
                                    stdDev: parts[7]
                                };
                            }
                            break;
                        }
                    }
                    
                    setPpsInfo({
                        available: !!trackingData['Reference ID'],
                        offset: gpsStats?.offset || trackingData['Last offset'] || 'N/A',
                        jitter: gpsStats?.stdDev || 'N/A',
                        frequency: trackingData['Frequency'] || 'N/A',
                        skew: trackingData['Skew'] || 'N/A',
                        stratum: trackingData['Stratum'] || 'N/A',
                        refId: trackingData['Reference ID'] || 'N/A',
                        systemTime: trackingData['System time'] || 'N/A',
                        lastOffset: trackingData['Last offset'] || 'N/A',
                        rmsOffset: trackingData['RMS offset'] || 'N/A',
                        updateInterval: trackingData['Update interval'] || 'N/A'
                    });
                }).fail(() => {
                    // sourcestats failed, use tracking data only
                    setPpsInfo(prev => ({
                        ...prev,
                        available: !!trackingData['Reference ID'],
                        frequency: trackingData['Frequency'] || 'N/A',
                        skew: trackingData['Skew'] || 'N/A',
                        stratum: trackingData['Stratum'] || 'N/A',
                        refId: trackingData['Reference ID'] || 'N/A',
                        systemTime: trackingData['System time'] || 'N/A',
                        lastOffset: trackingData['Last offset'] || 'N/A',
                        rmsOffset: trackingData['RMS offset'] || 'N/A',
                        updateInterval: trackingData['Update interval'] || 'N/A'
                    }));
                });
            }).fail(() => {
                setPpsInfo(prev => ({ ...prev, available: false }));
            });
            
            setLoading(false);
        } catch (error) {
            console.error('Error fetching NTP status:', error);
            setLoading(false);
        }
    };

    useEffect(() => {
        const hostname = cockpit.file('/etc/hostname');
        hostname.watch(content => setHostname(content?.trim() ?? ""));
        
        fetchNTPStatus();
        
        // Refresh every 30 seconds
        const interval = setInterval(fetchNTPStatus, 30000);
        
        return () => {
            hostname.close();
            clearInterval(interval);
        };
    }, []);

    const getStatusVariant = (status: string) => {
        switch (status) {
            case '*': return 'success';  // Current best source
            case '+': return 'success';  // Combined source (good)
            case '#': return 'info';     // Local reference (PPS, GPS)
            case '-': return 'warning';  // Not combined but reachable
            case 'x': return 'warning';  // False ticker
            case '~': return 'warning';  // Variable delay
            case '?': return 'danger';   // Unreachable
            default: return 'info';     // Unknown status
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case '*': return 'Current best source';
            case '+': return 'Combined source';
            case '-': return 'Not combined';
            case '#': return 'Local reference (GPS/PPS)';
            case 'x': return 'False ticker';
            case '~': return 'Variable delay';
            case '?': return 'Unreachable/Failed';
            default: return `Status: ${status}`;
        }
    };

    return (
        <div style={{height: '100vh', overflowY: 'scroll', padding: '20px'}}>
        <Grid hasGutter>
            <GridItem span={12}>
                <Alert
                    variant="info"
                    title={cockpit.format(_("GPS NTP Server - $0"), hostname)}
                />
            </GridItem>
            
            <GridItem span={6}>
                <Card>
                    <CardTitle>
                        GPS Status
                        <Button 
                            variant="link" 
                            onClick={fetchNTPStatus} 
                            isDisabled={loading}
                            style={{float: 'right'}}
                        >
                            {loading ? 'Refreshing...' : 'Refresh'}
                        </Button>
                    </CardTitle>
                    <CardBody>
                        <Alert
                            variant={gpsInfo.status.includes('Fix') ? 'success' : gpsInfo.status === 'Active' ? 'warning' : 'danger'}
                            title={`GPS Signal: ${gpsInfo.status} (${gpsInfo.mode})`}
                        />
                        {gpsInfo.latitude !== 'N/A' && (
                            <div style={{marginTop: '10px', fontSize: '0.9em'}}>
                                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px'}}>
                                    <div>
                                        <strong>Position:</strong><br/>
                                        Lat: {gpsInfo.latitude}<br/>
                                        Lon: {gpsInfo.longitude}<br/>
                                        <strong>Altitude:</strong> {gpsInfo.altitude}
                                    </div>
                                    <div>
                                        <strong>Motion:</strong><br/>
                                        Speed: {gpsInfo.speed}<br/>
                                        Climb: {gpsInfo.climb}<br/>
                                        <strong>GPS Time:</strong> {gpsInfo.time}
                                    </div>
                                </div>
                                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px'}}>
                                    <div>
                                        <strong>Satellites:</strong><br/>
                                        Used: {gpsInfo.satellites}/{gpsInfo.satellitesVisible}<br/>
                                        {gpsInfo.bestSatellite && (
                                            <span>Best: PRN {gpsInfo.bestSatellite.prn} ({gpsInfo.bestSatellite.ss} dB)</span>
                                        )}
                                    </div>
                                    <div>
                                        <strong>Precision (DOP):</strong><br/>
                                        HDOP: {gpsInfo.hdop}<br/>
                                        PDOP: {gpsInfo.pdop}<br/>
                                        VDOP: {gpsInfo.vdop}
                                    </div>
                                    <div>
                                        <strong>Time Accuracy:</strong><br/>
                                        EPT: {gpsInfo.ept}<br/>
                                        <div style={{
                                            marginTop: '5px',
                                            padding: '2px 6px',
                                            borderRadius: '3px',
                                            backgroundColor: 
                                                gpsInfo.hdop !== 'N/A' && parseFloat(gpsInfo.hdop) < 2 ? '#d4edda' :
                                                gpsInfo.hdop !== 'N/A' && parseFloat(gpsInfo.hdop) < 5 ? '#fff3cd' : '#f8d7da',
                                            color: 
                                                gpsInfo.hdop !== 'N/A' && parseFloat(gpsInfo.hdop) < 2 ? '#155724' :
                                                gpsInfo.hdop !== 'N/A' && parseFloat(gpsInfo.hdop) < 5 ? '#856404' : '#721c24',
                                            fontSize: '0.8em',
                                            textAlign: 'center'
                                        }}>
                                            {
                                                gpsInfo.hdop !== 'N/A' && parseFloat(gpsInfo.hdop) < 2 ? 'Excellent' :
                                                gpsInfo.hdop !== 'N/A' && parseFloat(gpsInfo.hdop) < 5 ? 'Good' : 'Poor'
                                            } precision
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardBody>
                </Card>
            </GridItem>
            
            <GridItem span={6}>
                <Card>
                    <CardTitle>PPS Accuracy</CardTitle>
                    <CardBody>
                        <Alert
                            variant={ppsInfo.available ? 'success' : 'danger'}
                            title={`PPS: ${ppsInfo.available ? 'Active' : 'Not Available'}`}
                        />
                        {ppsInfo.available && (
                            <div style={{marginTop: '10px', fontSize: '0.85em'}}>
                                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px'}}>
                                    <div>
                                        <strong>Stratum:</strong> {ppsInfo.stratum}<br/>
                                        <strong>Ref ID:</strong> {ppsInfo.refId}<br/>
                                        <strong>Frequency:</strong> {ppsInfo.frequency}
                                    </div>
                                    <div>
                                        <strong>System Time:</strong><br/>
                                        <span style={{fontSize: '0.9em'}}>{ppsInfo.systemTime}</span><br/>
                                        <strong>Update:</strong> {ppsInfo.updateInterval}
                                    </div>
                                </div>
                                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '0.8em'}}>
                                    <div style={{textAlign: 'center', padding: '4px', backgroundColor: '#f8f9fa', borderRadius: '3px'}}>
                                        <strong>Last Offset</strong><br/>
                                        <span style={{color: '#007bff'}}>{ppsInfo.lastOffset}</span>
                                    </div>
                                    <div style={{textAlign: 'center', padding: '4px', backgroundColor: '#f8f9fa', borderRadius: '3px'}}>
                                        <strong>RMS Offset</strong><br/>
                                        <span style={{color: '#28a745'}}>{ppsInfo.rmsOffset}</span>
                                    </div>
                                    <div style={{textAlign: 'center', padding: '4px', backgroundColor: '#f8f9fa', borderRadius: '3px'}}>
                                        <strong>Skew</strong><br/>
                                        <span style={{color: '#dc3545'}}>{ppsInfo.skew}</span>
                                    </div>
                                </div>
                                {ppsInfo.jitter !== 'N/A' && (
                                    <div style={{marginTop: '8px', textAlign: 'center', padding: '4px', backgroundColor: '#e9ecef', borderRadius: '3px'}}>
                                        <strong>GPS Jitter:</strong> <span style={{color: '#6c757d'}}>{ppsInfo.jitter}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardBody>
                </Card>
            </GridItem>
            
            <GridItem span={12}>
                <Card>
                    <CardTitle>NTP Clients ({clients.length})</CardTitle>
                    <CardBody style={{maxHeight: '300px', overflowY: 'auto'}}>
                        {clients.length > 0 ? (
                            <List>
                                {clients.map((client, index) => (
                                    <ListItem key={index}>
                                        <div style={{fontSize: '0.9em'}}>
                                            <div style={{fontWeight: 'bold', marginBottom: '4px'}}>
                                                {client.hostname}
                                            </div>
                                            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.85em', color: '#666'}}>
                                                <div>
                                                    <strong>NTP:</strong> {client.ntpRequests} req, {client.ntpDrop} drop<br/>
                                                    <strong>Interval:</strong> {client.ntpInterval} ({client.ntpIntervalLast})<br/>
                                                    <strong>Last NTP:</strong> {client.ntpLast === '-' ? 'Never' : client.ntpLast + 's ago'}
                                                </div>
                                                <div>
                                                    <strong>CMD:</strong> {client.cmdRequests} req, {client.cmdDrop} drop<br/>
                                                    <strong>CMD Int:</strong> {client.cmdInterval}<br/>
                                                    <strong>Last CMD:</strong> {client.cmdLast === '-' ? 'Never' : client.cmdLast + 's ago'}
                                                </div>
                                            </div>
                                        </div>
                                    </ListItem>
                                ))}
                            </List>
                        ) : (
                            <Alert variant="info" title="No active clients" />
                        )}
                    </CardBody>
                </Card>
            </GridItem>
            
            <GridItem span={12}>
                <Card>
                    <CardTitle>Time Sources</CardTitle>
                    <CardBody>
                        {sources.length > 0 ? (
                            <List>
                                {sources.map((source, index) => (
                                    <ListItem key={index}>
                                        <Alert
                                            variant={getStatusVariant(source.status)}
                                            isInline
                                            title={`${source.name} (Stratum ${source.stratum})`}
                                        >
                                            Status: {getStatusText(source.status)} | 
                                            Offset: {source.offset} | 
                                            Reachability: {source.reach}
                                        </Alert>
                                    </ListItem>
                                ))}
                            </List>
                        ) : (
                            <Alert variant="warning" title="No time sources configured" />
                        )}
                    </CardBody>
                </Card>
            </GridItem>
        </Grid>
        </div>
    );
};
