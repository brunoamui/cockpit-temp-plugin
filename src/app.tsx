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
    requests: string;
    last: string;
}

interface GPSInfo {
    status: string;
    satellites: string;
    latitude: string;
    longitude: string;
    altitude: string;
    mode: string;
}

export const Application = () => {
    const [hostname, setHostname] = useState('');
    const [sources, setSources] = useState<NTPSource[]>([]);
    const [clients, setClients] = useState<NTPClient[]>([]);
    const [gpsStatus, setGpsStatus] = useState('Unknown');
    const [gpsInfo, setGpsInfo] = useState<GPSInfo>({ status: 'Unknown', satellites: '0', latitude: 'N/A', longitude: 'N/A', altitude: 'N/A', mode: 'N/A' });
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
                                const satCount = skyData ? skyData.satellites.filter(sat => sat.used).length : '0';
                                setGpsInfo({
                                    status: tpvData.mode >= 2 ? 'Fix acquired' : 'No fix',
                                    satellites: satCount.toString(),
                                    latitude: tpvData.lat.toFixed(6),
                                    longitude: tpvData.lon.toFixed(6),
                                    altitude: tpvData.alt ? tpvData.alt.toFixed(1) + 'm' : 'N/A',
                                    mode: tpvData.mode === 3 ? '3D Fix' : tpvData.mode === 2 ? '2D Fix' : 'No Fix'
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
                        const parts = line.split(/\s+/);
                        if (parts.length >= 3) {
                            clientData.push({
                                hostname: parts[0] || 'Unknown',
                                requests: parts[1] || '0',
                                last: parts[4] || 'Never'
                            });
                        }
                    }
                }
                setClients(clientData);
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
                            title={`GPS Signal: ${gpsInfo.status}`}
                        />
                        {gpsInfo.latitude !== 'N/A' && (
                            <div style={{marginTop: '10px'}}>
                                <strong>Position:</strong> {gpsInfo.latitude}, {gpsInfo.longitude}<br/>
                                <strong>Altitude:</strong> {gpsInfo.altitude}<br/>
                                <strong>Mode:</strong> {gpsInfo.mode}<br/>
                                <strong>Satellites:</strong> {gpsInfo.satellites}
                            </div>
                        )}
                    </CardBody>
                </Card>
            </GridItem>
            
            <GridItem span={6}>
                <Card>
                    <CardTitle>NTP Clients ({clients.length})</CardTitle>
                    <CardBody style={{maxHeight: '300px', overflowY: 'auto'}}>
                        {clients.length > 0 ? (
                            <List>
                                {clients.map((client, index) => (
                                    <ListItem key={index}>
                                        <strong>{client.hostname}</strong> - {client.requests} requests (Last: {client.last})
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
