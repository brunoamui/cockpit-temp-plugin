# Cockpit Temperature Monitor Plugin

A comprehensive temperature monitoring plugin for Cockpit that provides real-time temperature tracking with graphing capabilities and automatic logging setup.

![Temperature Monitor](https://img.shields.io/badge/Cockpit-Plugin-blue) ![React](https://img.shields.io/badge/React-TypeScript-blue) ![Chart.js](https://img.shields.io/badge/Chart.js-Graphs-green)

## Features

### 🌡️ Real-Time Temperature Monitoring
- **Live temperature display** with color-coded status indicators
- **Dual temperature sources**: CPU sensors and thermal zone readings
- **Visual status indicators**:
  - 🟢 Normal (< 60°C)
  - 🟡 Warm (60-69°C)
  - 🟠 Hot (70-79°C)
  - 🔴 Critical (≥ 80°C)

### 📊 Interactive Temperature Graphs
- **Chart.js-powered** interactive temperature charts
- **Multiple time ranges**: 1h, 6h, 24h, 7d, all time
- **Dual temperature line charts** showing both sensors and thermal zone data
- **Real-time updates** every 30 seconds

### 🔧 Automatic Logging Setup
- **One-click installation** of temperature logging system
- **Automated cron job** for minute-by-minute temperature logging
- **CSV format logs** stored in `/var/log/temperature/`
- **Automatic log rotation** (30-day retention)
- **Smart installation detection** and status monitoring

## Screenshots

### Current Status Tab
Real-time temperature display with logging status and one-click setup.

### Temperature Graph Tab
Interactive charts with selectable time ranges and historical temperature data.

## Installation

### Prerequisites
- **Cockpit** installed and running
- **Node.js** (>= 16) for building the plugin
- **System with temperature sensors** (CPU thermal zones)

### Quick Install

1. **Clone the repository:**
   ```bash
   git clone https://github.com/brunoamui/cockpit-temp-plugin.git
   cd cockpit-temp-plugin
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the plugin:**
   ```bash
   npm run build
   ```

4. **Deploy to Cockpit:**
   ```bash
   sudo mkdir -p /usr/share/cockpit/cockpit-temp-plugin
   sudo cp -r dist/* /usr/share/cockpit/cockpit-temp-plugin/
   sudo systemctl restart cockpit
   ```

5. **Access the plugin:**
   - Open Cockpit: `http://your-server:9090`
   - Navigate to **"Temperature Monitor"** in the sidebar

### Development Setup

1. **Clone and install dependencies:**
   ```bash
   git clone https://github.com/brunoamui/cockpit-temp-plugin.git
   cd cockpit-temp-plugin
   npm install
   ```

2. **Development build with watch mode:**
   ```bash
   npm run watch
   ```

3. **Deploy for testing:**
   ```bash
   # Build and deploy to local Cockpit instance
   npm run build
   sudo rsync -av dist/ /usr/share/cockpit/cockpit-temp-plugin/
   sudo systemctl restart cockpit
   ```

## Architecture

### Technology Stack
- **React 18** with TypeScript
- **Chart.js 4** with date-time adapter
- **PatternFly 6** for UI components
- **Cockpit API** for system integration
- **ESBuild** for bundling

### Plugin Structure
```
src/
├── app.tsx          # Main React application
├── index.html       # Plugin entry point
├── manifest.json    # Cockpit plugin manifest
└── index.ts         # TypeScript entry point

dist/                # Built plugin files
├── index.html
├── index.js
├── manifest.json
└── assets/
```

### Temperature Logging Script
The plugin automatically installs a bash script (`/usr/local/bin/temp_logger.sh`) that:
- Collects temperature from `sensors` command
- Reads thermal zone data from `/sys/class/thermal/thermal_zone0/temp`
- Logs data in CSV format with timestamps
- Runs every minute via cron job

## Configuration

### Temperature Thresholds
Temperature status colors and thresholds can be customized in the `getTempColor()` and `getTempStatus()` functions in `src/app.tsx`:

```typescript
const getTempColor = (temp: number): string => {
    if (temp >= 80) return '#dc3545'; // Critical - red
    if (temp >= 70) return '#fd7e14'; // Hot - orange
    if (temp >= 60) return '#ffc107'; // Warm - yellow
    return '#28a745'; // Normal - green
};
```

### Logging Configuration
The logging script can be customized for different:
- **Log retention period** (default: 30 days)
- **Logging frequency** (default: every minute)
- **Log file location** (default: `/var/log/temperature/`)

## Supported Systems

### Operating Systems
- **Linux** with systemd
- **Raspberry Pi OS**
- **Ubuntu/Debian**
- **RHEL/CentOS/Fedora**

### Hardware Requirements
- **CPU temperature sensors** accessible via `sensors` command
- **Thermal zones** in `/sys/class/thermal/`
- **Standard utilities**: `bc`, `grep`, `awk`, `sed`

## Troubleshooting

### Plugin Not Appearing
1. Check Cockpit is running: `sudo systemctl status cockpit`
2. Verify plugin location: `ls -la /usr/share/cockpit/cockpit-temp-plugin/`
3. Check manifest.json syntax: `cat /usr/share/cockpit/cockpit-temp-plugin/manifest.json`
4. Restart Cockpit: `sudo systemctl restart cockpit`

### Temperature Data Not Available
1. Check sensors availability: `sensors`
2. Verify thermal zones: `ls /sys/class/thermal/`
3. Test thermal reading: `cat /sys/class/thermal/thermal_zone0/temp`
4. Install lm-sensors if needed: `sudo apt install lm-sensors` (Debian/Ubuntu)

### Logging Installation Issues
1. Check permissions: Plugin needs sudo access for installation
2. Verify cron service: `sudo systemctl status cron`
3. Check script execution: `sudo /usr/local/bin/temp_logger.sh`
4. Review log directory: `ls -la /var/log/temperature/`

## Contributing

### Development Workflow
1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/new-feature`
3. **Make your changes**
4. **Test the plugin** with `npm run build` and local deployment
5. **Submit a pull request**

### Code Style
- **TypeScript** for type safety
- **ESLint** for code linting
- **React functional components** with hooks
- **PatternFly components** for consistent UI

### Building and Testing
```bash
# Install dependencies
npm install

# Development build with watch
npm run watch

# Production build
npm run build

# Linting
npm run eslint

# Style checking
npm run stylelint
```

## License

This project is licensed under the **LGPL-2.1** License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **Cockpit Project** for the excellent web-based server management platform
- **PatternFly** for the beautiful UI component library  
- **Chart.js** for the powerful charting capabilities
- **React** and **TypeScript** for the solid development foundation

## Related Projects

- [Cockpit Project](https://cockpit-project.org/)
- [PatternFly](https://www.patternfly.org/)
- [Chart.js](https://www.chartjs.org/)

---

**Made with ❤️ for the Cockpit community**
