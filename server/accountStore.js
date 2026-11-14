const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  findBuildingRow,
  findFloorRow,
  findRoomRow,
  findPoiRow,
} = require('./data');

const POI_ROOM_TYPES = new Set(['dining', 'restroom', 'facility', 'lounge']);

// Keep client location aliases consistent with client/src/data/campus-places.ts
const MANIFEST_TO_CAMPUS_NAME = {
  'Spoelhof University Center': 'Spoelhof Center',
  'Spoelhof Fieldhouse': 'Fieldhouse',
  'Devos Communication Center': 'Devos Communication Building',
  'Devries Hall': 'DeVries Hall',
};

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password, storedHash) {
  const parts = String(storedHash || '').split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  const derived = crypto.scryptSync(String(password), salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

/**
 * Resolves either a domain FK payload ({ building_id | room_id | poi_id }) or
 * a client FavoritePlace payload ({ id, kind, building, floor, roomId, poiFilter, ... })
 * into a validated favorites table target satisfying the domain model's "one of"
 * foreign-key rule: exactly one of building_id, room_id, or poi_id is non-null.
 */
function resolveFavoriteTarget(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('Favorite payload must be an object');
  }

  const fkCount =
    (input.building_id != null ? 1 : 0) +
    (input.room_id != null ? 1 : 0) +
    (input.poi_id != null ? 1 : 0);

  if (fkCount > 1) {
    throw new Error(
      'Favorite must reference exactly one target: building_id, room_id, or poi_id'
    );
  }

  if (fkCount === 1) {
    if (input.building_id != null) {
      const building = findBuildingRow(Number(input.building_id));
      if (!building) throw new Error('Referenced building_id does not exist');
      return {
        building_id: building.id,
        room_id: null,
        poi_id: null,
        floor_label: typeof input.floor_label === 'string'
          ? input.floor_label
          : typeof input.floor === 'string'
          ? input.floor
          : null,
      };
    }
    if (input.room_id != null) {
      const room = findRoomRow(Number(input.room_id));
      if (!room) throw new Error('Referenced room_id does not exist');
      return {
        building_id: null,
        room_id: room.id,
        poi_id: null,
        floor_label: null,
      };
    }
    const poi = findPoiRow(Number(input.poi_id));
    if (!poi) throw new Error('Referenced poi_id does not exist');
    return {
      building_id: null,
      room_id: null,
      poi_id: poi.id,
      floor_label: null,
    };
  }

  // Client FavoritePlace translation
  const clientId = typeof input.id === 'string' ? input.id : '';

  if (input.poiFilter || clientId.startsWith('poi:')) {
    const label = input.poiFilter || clientId.slice(4) || input.title;
    const poi = findPoiRow(label);
    if (!poi) {
      throw new Error(`Unknown point of interest: ${label}`);
    }
    return {
      building_id: null,
      room_id: null,
      poi_id: poi.id,
      floor_label: null,
    };
  }

  if (input.roomId || clientId.startsWith('room:')) {
    const roomKey = input.roomId || clientId.slice(5);
    const room = findRoomRow(roomKey);
    if (!room) {
      throw new Error(`Unknown room: ${roomKey}`);
    }
    return {
      building_id: null,
      room_id: room.id,
      poi_id: null,
      floor_label: null,
    };
  }

  const buildingQuery =
    input.building ||
    input.campusLocation ||
    (clientId.startsWith('building:') ? clientId.slice(9) : null) ||
    (clientId.startsWith('floor:') ? clientId.split(':')[1] : null) ||
    input.title;

  const building = findBuildingRow(buildingQuery);
  if (!building) {
    throw new Error(`Unknown building for favorite: ${buildingQuery || clientId}`);
  }

  const floorLabel =
    input.kind === 'floor' || clientId.startsWith('floor:')
      ? input.floor || (clientId.startsWith('floor:') ? clientId.split(':')[2] : null)
      : null;

  return {
    building_id: building.id,
    room_id: null,
    poi_id: null,
    floor_label: floorLabel || null,
  };
}

/**
 * Projects a stored favorites row (matching docs/initialDatabaseDesign.png)
 * into both the DB row representation and the client FavoritePlace shape.
 */
function projectFavoriteRow(row) {
  const createdAt = row.created_at || new Date().toISOString();

  if (row.room_id != null) {
    const room = findRoomRow(row.room_id);
    const floor = room ? findFloorRow(room.floor_id) : null;
    const building = floor ? findBuildingRow(floor.building_id) : null;
    const buildingName = building ? building.name : 'Unknown Building';
    const campusLocation = MANIFEST_TO_CAMPUS_NAME[buildingName] || buildingName;
    const floorLabel = floor ? floor.label : undefined;
    const isPoiRoom = Boolean(room && room.type && POI_ROOM_TYPES.has(room.type));
    return {
      id: row.id,
      user_id: row.user_id,
      building_id: null,
      room_id: row.room_id,
      poi_id: null,
      floor_label: null,
      created_at: createdAt,
      place: {
        id: `room:${room.client_room_id}`,
        kind: isPoiRoom ? 'poi' : 'room',
        title: room.name || `Room ${room.room_number}`,
        subtitle: `${buildingName} · ${floorLabel || ''} (${room.room_number})`,
        building: buildingName,
        floor: floorLabel,
        roomId: room.client_room_id,
        roomNumber: room.room_number,
        campusLocation,
        createdAt,
      },
    };
  }

  if (row.poi_id != null) {
    const poi = findPoiRow(row.poi_id);
    const floor = poi && poi.floor_id != null ? findFloorRow(poi.floor_id) : null;
    const building = floor ? findBuildingRow(floor.building_id) : null;
    const isOutdoorFilter = Boolean(poi && poi.floor_id == null);
    return {
      id: row.id,
      user_id: row.user_id,
      building_id: null,
      room_id: null,
      poi_id: row.poi_id,
      floor_label: null,
      created_at: createdAt,
      place: isOutdoorFilter
        ? {
            id: `poi:${poi.label}`,
            kind: 'poi',
            title: poi.label,
            subtitle: 'Campus Map POI Filter',
            poiFilter: poi.label,
            createdAt,
          }
        : {
            id: `poi-item:${poi.id}`,
            kind: 'poi',
            title: poi.label,
            subtitle: building && floor ? `${building.name} · ${floor.label}` : poi.description,
            building: building ? building.name : undefined,
            floor: floor ? floor.label : undefined,
            poiFilter: poi.label,
            createdAt,
          },
    };
  }

  const building = findBuildingRow(row.building_id);
  const buildingName = building ? building.name : 'Unknown Building';
  const campusLocation = MANIFEST_TO_CAMPUS_NAME[buildingName] || buildingName;

  if (row.floor_label) {
    return {
      id: row.id,
      user_id: row.user_id,
      building_id: row.building_id,
      room_id: null,
      poi_id: null,
      floor_label: row.floor_label,
      created_at: createdAt,
      place: {
        id: `floor:${buildingName}:${row.floor_label}`,
        kind: 'floor',
        title: `${buildingName} · ${row.floor_label}`,
        subtitle: 'Building Floor Plan',
        building: buildingName,
        floor: row.floor_label,
        campusLocation,
        createdAt,
      },
    };
  }

  return {
    id: row.id,
    user_id: row.user_id,
    building_id: row.building_id,
    room_id: null,
    poi_id: null,
    floor_label: null,
    created_at: createdAt,
    place: {
      id: `building:${campusLocation}`,
      kind: 'building',
      title: campusLocation,
      subtitle: 'Campus Building',
      campusLocation,
      building: buildingName,
      createdAt,
    },
  };
}

function favoriteTargetKey(userId, target) {
  return [
    userId,
    target.building_id ?? '',
    target.room_id ?? '',
    target.poi_id ?? '',
    target.floor_label ?? '',
  ].join('|');
}

class AccountStore {
  constructor(options = {}) {
    this.persistPath = options.persistPath || null;
    this.reset();
    if (this.persistPath) {
      this._loadFromDisk();
    }
  }

  reset() {
    this.auth_users = [];
    this.profiles = [];
    this.favorites = [];
    this.sessions = new Map();
    this.nextFavoriteId = 1;
  }

  _loadFromDisk() {
    try {
      if (!fs.existsSync(this.persistPath)) return;
      const raw = fs.readFileSync(this.persistPath, 'utf8');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.auth_users)) this.auth_users = parsed.auth_users;
      if (Array.isArray(parsed.profiles)) this.profiles = parsed.profiles;
      if (Array.isArray(parsed.favorites)) this.favorites = parsed.favorites;
      if (typeof parsed.nextFavoriteId === 'number') {
        this.nextFavoriteId = parsed.nextFavoriteId;
      }
      if (parsed.sessions && typeof parsed.sessions === 'object') {
        this.sessions = new Map(Object.entries(parsed.sessions));
      }
    } catch {
      // Keep clean state if persisted store file cannot be read.
    }
  }

  _saveToDisk() {
    if (!this.persistPath) return;
    try {
      fs.mkdirSync(path.dirname(this.persistPath), { recursive: true });
      const payload = {
        auth_users: this.auth_users,
        profiles: this.profiles,
        favorites: this.favorites,
        nextFavoriteId: this.nextFavoriteId,
        sessions: Object.fromEntries(this.sessions.entries()),
      };
      fs.writeFileSync(this.persistPath, JSON.stringify(payload, null, 2), 'utf8');
    } catch {
      // Ignore disk write errors in read-only environments.
    }
  }

  _sanitizeUser(userRow) {
    return {
      id: userRow.id,
      email: userRow.email,
      created_at: userRow.created_at,
    };
  }

  _issueSession(userId) {
    const token = crypto.randomBytes(32).toString('hex');
    this.sessions.set(token, {
      user_id: userId,
      created_at: new Date().toISOString(),
    });
    this._saveToDisk();
    return token;
  }

  authenticateToken(token) {
    if (!token) return null;
    const session = this.sessions.get(token);
    if (!session) return null;
    const userRow = this.auth_users.find((u) => u.id === session.user_id);
    if (!userRow) return null;
    const profileRow = this.profiles.find((p) => p.id === userRow.id);
    return {
      user: this._sanitizeUser(userRow),
      profile: profileRow || {
        id: userRow.id,
        display_name: userRow.email.split('@')[0],
        settings: {},
        is_admin: false,
      },
    };
  }

  revokeToken(token) {
    if (!token) return;
    this.sessions.delete(token);
    this._saveToDisk();
  }

  register({ email, password, displayName, guestFavorites }) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      const err = new Error('A valid email address is required');
      err.status = 400;
      throw err;
    }
    if (typeof password !== 'string' || password.length < 6) {
      const err = new Error('Password must be at least 6 characters');
      err.status = 400;
      throw err;
    }
    if (this.auth_users.some((u) => u.email === normalizedEmail)) {
      const err = new Error('An account with this email already exists');
      err.status = 409;
      throw err;
    }

    const userId = crypto.randomUUID();
    const userRow = {
      id: userId,
      email: normalizedEmail,
      password_hash: hashPassword(password),
      created_at: new Date().toISOString(),
    };
    const fallbackName = normalizedEmail.split('@')[0] || 'Calvin User';
    const profileRow = {
      id: userId,
      display_name:
        typeof displayName === 'string' && displayName.trim()
          ? displayName.trim()
          : fallbackName,
      settings: {},
      is_admin: false,
    };

    this.auth_users.push(userRow);
    this.profiles.push(profileRow);

    if (Array.isArray(guestFavorites) && guestFavorites.length > 0) {
      this.syncFavorites(userId, guestFavorites, { mergeExisting: true });
    }

    const token = this._issueSession(userId);
    const { rows, places } = this.listFavorites(userId);
    this._saveToDisk();

    return {
      token,
      user: this._sanitizeUser(userRow),
      profile: profileRow,
      favorites: places,
      rows,
    };
  }

  login({ email, password, guestFavorites }) {
    const normalizedEmail = normalizeEmail(email);
    const userRow = this.auth_users.find((u) => u.email === normalizedEmail);
    if (!userRow || !verifyPassword(password, userRow.password_hash)) {
      const err = new Error('Invalid email or password');
      err.status = 401;
      throw err;
    }

    if (Array.isArray(guestFavorites) && guestFavorites.length > 0) {
      this.syncFavorites(userRow.id, guestFavorites, { mergeExisting: true });
    }

    const profileRow = this.profiles.find((p) => p.id === userRow.id);
    const token = this._issueSession(userRow.id);
    const { rows, places } = this.listFavorites(userRow.id);
    this._saveToDisk();

    return {
      token,
      user: this._sanitizeUser(userRow),
      profile: profileRow,
      favorites: places,
      rows,
    };
  }

  updateProfile(userId, updates = {}) {
    const profileRow = this.profiles.find((p) => p.id === userId);
    if (!profileRow) {
      const err = new Error('Profile not found');
      err.status = 404;
      throw err;
    }
    if (typeof updates.display_name === 'string') {
      profileRow.display_name = updates.display_name.trim() || profileRow.display_name;
    }
    if (updates.settings && typeof updates.settings === 'object' && !Array.isArray(updates.settings)) {
      profileRow.settings = { ...profileRow.settings, ...updates.settings };
    }
    this._saveToDisk();
    return profileRow;
  }

  listFavorites(userId) {
    const userRows = this.favorites.filter((f) => f.user_id === userId);
    const projected = userRows.map(projectFavoriteRow);
    return {
      rows: projected.map(({ place: _place, ...row }) => row),
      places: projected.map((entry) => entry.place),
    };
  }

  addFavorite(userId, input) {
    let target;
    try {
      target = resolveFavoriteTarget(input);
    } catch (error) {
      const err = new Error(error.message);
      err.status = 400;
      throw err;
    }

    const key = favoriteTargetKey(userId, target);
    const existing = this.favorites.find(
      (row) => favoriteTargetKey(row.user_id, row) === key
    );
    if (existing) {
      const projected = projectFavoriteRow(existing);
      return {
        row: { ...existing },
        place: projected.place,
        ...this.listFavorites(userId),
      };
    }

    const row = {
      id: this.nextFavoriteId++,
      user_id: userId,
      building_id: target.building_id,
      room_id: target.room_id,
      poi_id: target.poi_id,
      floor_label: target.floor_label,
      created_at:
        typeof input.createdAt === 'string'
          ? input.createdAt
          : new Date().toISOString(),
    };

    // Newest favorites appear first to mirror client behavior while retaining DB id
    this.favorites.unshift(row);
    this._saveToDisk();
    const projected = projectFavoriteRow(row);
    return {
      row,
      place: projected.place,
      ...this.listFavorites(userId),
    };
  }

  syncFavorites(userId, items, { mergeExisting = false } = {}) {
    if (!Array.isArray(items)) {
      const err = new Error('favorites must be an array');
      err.status = 400;
      throw err;
    }

    const resolvedTargets = [];
    for (const item of items) {
      let target;
      try {
        target = resolveFavoriteTarget(item);
      } catch (error) {
        const err = new Error(error.message);
        err.status = 400;
        throw err;
      }
      resolvedTargets.push({ item, target });
    }

    if (!mergeExisting) {
      const existingByKey = new Map();
      for (const row of this.favorites) {
        if (row.user_id === userId) {
          existingByKey.set(favoriteTargetKey(userId, row), row);
        }
      }
      this.favorites = this.favorites.filter((row) => row.user_id !== userId);

      const seen = new Set();
      const nextUserRows = [];
      for (const { item, target } of resolvedTargets) {
        const key = favoriteTargetKey(userId, target);
        if (seen.has(key)) continue;
        seen.add(key);

        const reused = existingByKey.get(key);
        nextUserRows.push(
          reused || {
            id: this.nextFavoriteId++,
            user_id: userId,
            building_id: target.building_id,
            room_id: target.room_id,
            poi_id: target.poi_id,
            floor_label: target.floor_label,
            created_at:
              typeof item.createdAt === 'string'
                ? item.createdAt
                : new Date().toISOString(),
          }
        );
      }
      this.favorites.unshift(...nextUserRows);
      this._saveToDisk();
      return this.listFavorites(userId);
    }

    // Merge guest favorites without duplicating or removing existing account rows
    const existingKeys = new Set(
      this.favorites
        .filter((row) => row.user_id === userId)
        .map((row) => favoriteTargetKey(userId, row))
    );

    const newRows = [];
    for (const { item, target } of resolvedTargets) {
      const key = favoriteTargetKey(userId, target);
      if (existingKeys.has(key)) continue;
      existingKeys.add(key);
      newRows.push({
        id: this.nextFavoriteId++,
        user_id: userId,
        building_id: target.building_id,
        room_id: target.room_id,
        poi_id: target.poi_id,
        floor_label: target.floor_label,
        created_at:
          typeof item.createdAt === 'string'
            ? item.createdAt
            : new Date().toISOString(),
      });
    }

    if (newRows.length > 0) {
      this.favorites.unshift(...newRows);
      this._saveToDisk();
    }

    return this.listFavorites(userId);
  }

  removeFavorite(userId, favoriteIdentifier) {
    const idStr = String(favoriteIdentifier || '').trim();
    const numericId = Number(idStr);

    const beforeCount = this.favorites.length;
    this.favorites = this.favorites.filter((row) => {
      if (row.user_id !== userId) return true;
      if (Number.isInteger(numericId) && numericId > 0 && row.id === numericId) {
        return false;
      }
      const projected = projectFavoriteRow(row);
      return projected.place.id !== idStr;
    });

    if (this.favorites.length === beforeCount) {
      const err = new Error('Favorite not found');
      err.status = 404;
      throw err;
    }

    this._saveToDisk();
    return this.listFavorites(userId);
  }

  clearFavorites(userId) {
    this.favorites = this.favorites.filter((row) => row.user_id !== userId);
    this._saveToDisk();
    return this.listFavorites(userId);
  }
}

const defaultPersistPath =
  process.env.NODE_ENV === 'test'
    ? null
    : process.env.ACCOUNT_STORE_FILE ||
      path.join(__dirname, '.data', 'accounts.json');

const accountStore = new AccountStore({ persistPath: defaultPersistPath });

module.exports = {
  AccountStore,
  accountStore,
  resolveFavoriteTarget,
  projectFavoriteRow,
};
