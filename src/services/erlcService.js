import axios from 'axios';
import { logger } from '../utils/logger.js';

const ROBLOX_API = 'https://apis.roblox.com';

class ERLCService {
  async getServerInfo(serverId) {
    try {
      // Fetch server info from Roblox API
      const res = await axios.get(
        `${ROBLOX_API}/v1/servers/game-servers?placeId=4282985734&serverStartIndex=0&serverCount=100`,
        { validateStatus: () => true }
      );

      if (res.status !== 200) {
        logger.error('❌ Failed to fetch ERLC servers:', res.status);
        return null;
      }

      // Find the specific server
      const server = res.data.servers?.find(s => s.id === serverId);
      if (!server) {
        logger.warn(`⚠️ Server ${serverId} not found`);
        return null;
      }

      return {
        id: server.id,
        name: server.name,
        players: server.playerCount || 0,
        maxPlayers: server.maxPlayers || 0,
        ping: server.ping || 0,
        fps: server.fps || 0
      };
    } catch (err) {
      logger.error('❌ getServerInfo error:', err.message);
      return null;
    }
  }

  async getGamePlayers(serverId) {
    try {
      // This would need a custom API endpoint from the game
      // For now, returning a placeholder structure
      return {
        totalPlayers: 0,
        police: 0,
        firefighters: 0,
        civilians: 0
      };
    } catch (err) {
      logger.error('❌ getGamePlayers error:', err.message);
      return null;
    }
  }
}

export const erlc = new ERLCService();

