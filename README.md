# CS262-SoftwareEngineering-TeamG
A product in development for CS 262 - Software Engineering
<br><br>[Link to Team Contract](https://github.com/tpv8/CS262-SoftwareEngineering-TeamG/blob/7d60b9f4ccc204b4507acd7b96c3cf4adaec68c4/TEAM_CONTRACT.md)

<br><br>**Group Members**:
- Joshua Rogan
- Josh Julian
- Faith Liz Nsengiyumva
- Ty Veldhouse
- Jonathan Barrantes Segovia

<br>
Vision statement
<br>
CalvinFinder is for anyone visiting or navigating Calvin University who needs an easier way to find classes, buildings, and points of interest. CalvinFinder is a mobile app that makes exploring campus more convenient by helping users locate places both inside and outside buildings. Unlike previous attempts at campus navigation apps, our product combines classroom locations with points of interest such as vending machines, printers, and more, all in one accessible platform.

## Client

The client app (Calvin Finder, an Expo / React Native prototype) lives in [client/](client/).
See [client/README.md](client/README.md) for setup, screens, and testing instructions.

### Quickstart

From the repository root, you can run:

```bash
# Start the Expo development server
npm start

# Run the test suite
npm test

# Run linting
npm run lint
```

Or navigate directly into the `client/` folder:

```bash
cd client
npm install
npx expo start
```

## Running on a phone

The app talks to the Express server running on your laptop, so the phone has
to be able to reach your laptop over the network.

1. Start the server: `cd server && npm start`. It prints addresses like
   `On your network: http://192.168.1.20:3000`.
2. Start the app: `cd client && npx expo start`, then scan the QR code with
   Expo Go. Keep the default LAN mode; don't use `--tunnel` unless you also set
   `EXPO_PUBLIC_API_URL` (see below).
3. The app finds the server by itself: it reuses the laptop address Expo Go
   connected to, with port 3000. The Metro terminal logs the address it picked,
   for example `[api] Using server at http://192.168.1.20:3000 (expo-host)`.

**Quick connection test:** open `http://<laptop-ip>:3000/api/v1/health` in the
phone's browser. If you see `{"status":"ok"}`, the app can reach the server too.
If the app can't connect, it shows `Can't reach server at <address>`.

**Same Wi-Fi is required.** The phone and laptop must be on the same network.

**Campus Wi-Fi (including Calvin's) usually blocks this.** Campus networks
often stop devices from connecting to each other, even on the same Wi-Fi. If
the health check above doesn't load, use one of these:

- **Phone hotspot:** connect the laptop to the phone's hotspot and restart
  `npx expo start`. The address is detected automatically.
- **Tunnel:** run `ngrok http 3000` and copy the `https://...` URL it prints.
  Create `client/.env.local` (see [client/.env.example](client/.env.example))
  with `EXPO_PUBLIC_API_URL=<that url>`, then restart `npx expo start`. This
  also works together with `npx expo start --tunnel`.

**Android emulator:** works without setup. If Metro runs with `--localhost`,
the app uses `10.0.2.2`, the emulator's address for your laptop.

**iOS simulator:** works without setup; it shares your laptop's network.

**Firewall prompts:** the first time the server starts, Windows (Windows
Defender Firewall) or macOS may ask whether to allow incoming connections for
Node.js. Allow it on private networks, or the phone will be blocked. If you
dismissed the prompt, allow Node.js in the firewall settings.

## User Stories
User stories and software requirements specification can be accessed as pdfs in /docs
