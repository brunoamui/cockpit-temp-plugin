# Cockpit NTP GPS Plugin

A Cockpit plugin for GPS-based NTP server configuration and monitoring on pfSense/OPNsense systems.

## Overview

This plugin provides a web-based interface for configuring and monitoring GPS-based Network Time Protocol (NTP) servers. It integrates with pfSense/OPNsense firewalls and provides real-time monitoring of GPS status, NTP synchronization, and satellite tracking.

## Features

- **GPS Status Monitoring**: Real-time display of GPS receiver status including satellite count, signal quality, and lock status
- **NTP Configuration**: Easy configuration of NTP servers with GPS time sources
- **Satellite Tracking**: Visual display of GPS satellite positions and signal strengths
- **Time Synchronization**: Monitor NTP synchronization status and accuracy
- **Web Interface**: Modern React-based user interface built on Cockpit framework

## Installation

### Prerequisites

- pfSense or OPNsense firewall system
- Cockpit web console installed
- GPS receiver hardware connected to the system
- NTP daemon configured

### Installing the Plugin

1. Clone this repository to your pfSense system:
```bash
git clone https://github.com/brunoamui/cockpit-ntp-plugin.git
cd cockpit-ntp-plugin
```

2. Install dependencies:
```bash
npm install
```

3. Build the plugin:
```bash
make
```

4. Install to Cockpit:
```bash
sudo make install
```

5. Restart Cockpit service:
```bash
sudo systemctl restart cockpit
```

## Development

### Setting up Development Environment

1. Clone the repository:
```bash
git clone https://github.com/brunoamui/cockpit-ntp-plugin.git
cd cockpit-ntp-plugin
```

2. Install dependencies:
```bash
npm install
```

3. Start development server:
```bash
make watch
```

The development server will automatically reload when you make changes.

### Building for Production

```bash
make
```

This creates an optimized build in the `dist/` directory.

### Running Tests

```bash
make check
```

## Configuration

The plugin reads GPS and NTP status from standard system interfaces:

- GPS data from `/dev/gps0` or similar GPS device
- NTP status from `ntpq` command output
- System time information from standard Linux time APIs

### GPS Hardware Support

The plugin supports various GPS receivers including:
- u-blox GPS modules
- Generic NMEA 0183 compatible devices
- PPS (Pulse Per Second) capable receivers

## API Documentation

The plugin exposes several REST endpoints for GPS and NTP data:

- `GET /api/gps/status` - Current GPS receiver status
- `GET /api/gps/satellites` - Satellite information and positions
- `GET /api/ntp/status` - NTP synchronization status
- `GET /api/ntp/peers` - NTP peer information

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Guidelines

- Follow React and TypeScript best practices
- Write tests for new features
- Update documentation for API changes
- Use semantic commit messages

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Issues**: Report bugs or request features on [GitHub Issues](https://github.com/brunoamui/cockpit-ntp-plugin/issues)
- **Documentation**: Visit our repository for detailed documentation

## Acknowledgments

- Built on the [Cockpit Project](https://cockpit-project.org/) framework
- Uses GPS data parsing libraries from the open source community
- Inspired by the need for precise time synchronization in network infrastructure

---

**Note**: This plugin is designed for use with pfSense/OPNsense systems but can be adapted for other Linux-based firewall distributions.
