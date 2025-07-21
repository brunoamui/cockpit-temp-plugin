# Cockpit GPS NTP Monitor

A Cockpit web interface plugin for monitoring GPS-based NTP server status and accuracy on Linux systems.

## Overview

This plugin provides a web-based interface for monitoring GPS-based Network Time Protocol (NTP) servers running on Linux systems. It integrates with the Cockpit web console and provides real-time monitoring of GPS receiver status, NTP synchronization accuracy, and client connections.

## Features

- **GPS Status Monitoring**: Real-time display of GPS receiver status including satellite count, signal quality, and position fix
- **PPS Accuracy Monitoring**: Monitor Pulse Per Second timing accuracy and jitter
- **NTP Client Tracking**: View active NTP clients and their connection statistics
- **Chrony Integration**: Full integration with Chrony NTP daemon for precise time sources
- **Web Interface**: Modern React-based user interface built on Cockpit framework

## Installation

### Prerequisites

- Linux system (Fedora, RHEL, CentOS, Ubuntu, etc.)
- Cockpit web console installed
- GPS receiver hardware connected to the system
- Chrony NTP daemon configured
- GPSD daemon for GPS communication

### Installing the Plugin

1. Clone this repository to your Linux system:
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

## How It Works

The plugin reads GPS and NTP status from standard Linux system commands:

- **GPS data**: Retrieved via `gpspipe` command from GPSD daemon
- **NTP status**: Monitored using `chronyc` commands (sources, clients, tracking, sourcestats)
- **PPS timing**: Analyzed through Chrony's tracking and source statistics
- **System time**: Obtained from standard Linux time APIs

### Supported GPS Hardware

The plugin works with any GPS receiver supported by GPSD, including:
- u-blox GPS modules
- Generic NMEA 0183 compatible devices
- PPS (Pulse Per Second) capable receivers
- USB GPS dongles
- Serial GPS receivers

## What You'll See

The web interface displays:

- **GPS Status**: Current fix status, position, altitude, speed, and satellite information
- **PPS Accuracy**: Timing precision metrics including offset, jitter, and frequency drift
- **NTP Clients**: List of systems requesting time synchronization
- **Time Sources**: Status of all configured time sources and their reliability

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

**Note**: This plugin is designed for general Linux systems running Cockpit, Chrony, and GPSD. It can be used on servers, workstations, or any Linux-based system that needs precise GPS time synchronization.
