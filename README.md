# RadioGPS ADS-B Monitor - Cockpit Plugin

A Cockpit web interface plugin for monitoring ADS-B (Automatic Dependent Surveillance-Broadcast) receiver statistics and accessing the tar1090 live aircraft tracking map.

## Overview

This plugin provides a comprehensive web-based interface for monitoring ADS-B receiver performance and accessing live aircraft tracking data. It integrates seamlessly with the Cockpit web console and provides real-time statistics from readsb and tar1090.

## Features

- **Live Map Access**: One-click access to tar1090 live aircraft tracking map in a new window
- **Real-time Statistics**: Monitor ADS-B receiver performance metrics and signal quality
- **Signal Quality Analysis**: Track signal strength, noise levels, and SNR with color-coded alerts
- **Historical Data**: View statistics for different time periods (1 min, 5 min, 15 min, total)
- **Service Status**: Monitor readsb service health, uptime, and configuration
- **Aircraft Tracking**: Display current aircraft counts, positions, and message statistics
- **Performance Monitoring**: CPU usage, message processing rates, and system performance
- **Modern Interface**: Clean, responsive React-based UI built with PatternFly components

## Installation

### Prerequisites

- Linux system (Fedora, RHEL, CentOS, Ubuntu, etc.)
- Cockpit web console installed and running
- **readsb**: ADS-B decoder service
- **tar1090**: Web interface for aircraft tracking
- RTL-SDR dongle or other ADS-B receiver hardware
- Node.js (for building the plugin)

### Installing the Plugin

1. Clone this repository to your Linux system:
```bash
git clone https://github.com/your-username/radiogps-adsb-plugin.git
cd radiogps-adsb-plugin
```

2. Install dependencies:
```bash
npm install
```

3. Build the plugin:
```bash
make
```

4. Deploy to Cockpit:
```bash
# Copy built files to Cockpit plugins directory
sudo cp -r dist/* /usr/share/cockpit/radiogps-adsb-plugin/
# Or for user-specific installation:
mkdir -p ~/.local/share/cockpit/radiogps-adsb-plugin
cp -r dist/* ~/.local/share/cockpit/radiogps-adsb-plugin/
```

5. Restart Cockpit service:
```bash
sudo systemctl restart cockpit.socket
```

## Development

### Project Structure
```
radiogps-adsb-plugin/
├── src/
│   └── app.tsx          # Main React application
├── package.json         # Node.js dependencies
├── manifest.json        # Cockpit plugin manifest
├── build.js            # Build script
├── Makefile            # Build automation
└── dist/               # Built plugin files (generated)
```

### Building for Production

```bash
make
```

This creates an optimized build in the `dist/` directory.

## How It Works

The plugin integrates with existing ADS-B infrastructure:

- **ADS-B Data**: Retrieved from tar1090's JSON API endpoint (`/tar1090/data/stats.json`)
- **Service Status**: Monitored using `systemctl status readsb` commands
- **Real-time Updates**: Automatically refreshes data every 10 seconds
- **Map Integration**: Opens tar1090 web interface in a new window for live tracking

### Configuration

The plugin expects:
- `readsb` service running and accessible via systemctl
- tar1090 web interface available at `http://localhost/tar1090/`
- Statistics JSON endpoint at `http://localhost/tar1090/data/stats.json`

### Customizing URLs

If your tar1090 installation is at a different location, edit `src/app.tsx`:
- Line 89: Stats JSON endpoint
- Line 197: Live map URL

## What You'll See

### Statistics Dashboard
- **Receiver Status**: Service health, uptime, receiver gain, and PPM correction
- **Signal Quality**: Real-time signal strength, noise levels, and SNR analysis
- **Current Activity**: Aircraft counts, message rates, position updates, and range
- **Historical Data**: Performance metrics for 1min, 5min, 15min, and total periods

### Live Map Access
- One-click button to open tar1090 in a new window
- Real-time aircraft positions and flight tracks
- Aircraft details and flight information
- Coverage and range visualization

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Guidelines

- Follow React and TypeScript best practices
- Write tests for new features
- Update documentation for API changes
- Use semantic commit messages

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Compatibility

- **Cockpit**: 230+
- **readsb**: Any recent version
- **tar1090**: Any recent version
- **Browsers**: Modern browsers with JavaScript enabled
- **Operating Systems**: Fedora, RHEL, CentOS, Ubuntu, Debian

## Support

If you encounter issues:
1. Verify that readsb and tar1090 services are running properly
2. Check that tar1090 web interface is accessible at `http://localhost/tar1090/`
3. Review browser console for JavaScript errors
4. Check Cockpit logs for plugin loading issues

For bugs and feature requests, please open an issue on GitHub.

## Acknowledgments

- [Cockpit Project](https://cockpit-project.org/) - Web-based server administration
- [readsb](https://github.com/wiedehopf/readsb) - ADS-B decoder
- [tar1090](https://github.com/wiedehopf/tar1090) - Web interface for aircraft tracking
- [PatternFly](https://www.patternfly.org/) - Design system and React components

---

**Note**: This plugin is designed for Linux systems running Cockpit with readsb and tar1090 for ADS-B reception and aircraft tracking. It provides a centralized monitoring interface for ADS-B receiver performance and easy access to live aircraft tracking data.
