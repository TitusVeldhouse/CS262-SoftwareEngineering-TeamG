const os = require('node:os');
const app = require('./app');

const PORT = 3000;
// 0.0.0.0 means "accept connections on every network interface", so phones and
// emulators on the same network can reach the server, not just this computer.
const HOST = '0.0.0.0';

// Lists this computer's IPv4 addresses on the local network (e.g. 192.168.1.20).
function getLanAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((iface) => iface && iface.family === 'IPv4' && !iface.internal)
    .map((iface) => iface.address);
}

app.listen(PORT, HOST, () => {
  console.log(`Listening on http://localhost:${PORT}`);
  for (const address of getLanAddresses()) {
    console.log(`  On your network: http://${address}:${PORT} (use this from a phone)`);
  }
});
