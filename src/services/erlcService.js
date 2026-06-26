import axios from 'axios';
import { logger } from '../utils/logger.js';

class ERLCService {
  async getServerStats(apiKey) {
    try {
      if (!apiKey) {
        logger.error('❌ No API key provided');
        return null;
      }

      // Call ERLC server API with the API key
      const res = await axios.get('https://api.erlc.cc/server/info', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        validateStatus: () => true
      });

      if (res.status !== 200) {
        logger.error('❌ Failed to fetch ERLC server stats:', res.status);
        return null;
      }

      return {
        totalPlayers: res.data.players?.total || 0,
        police: res.data.players?.police || 0,
        sheriff: res.data.players?.sheriff || 0,
        firefighters: res.data.players?.firefighters || 0,
        civilians: res.data.players?.civilians || 0,
        maxPlayers: res.data.maxPlayers || 0,
        serverName: res.data.serverName || 'Unknown',
        status: res.data.status || 'offline'
      };
    } catch (err) {
      logger.error('❌ getServerStats error:', err.message);
      return null;
    }
  }

  async executeCommand(apiKey, command) {
    try {
      if (!apiKey || !command) {
        logger.error('❌ Missing API key or command');
        return false;
      }

      const res = await axios.post('https://api.erlc.cc/server/command', {
        command: command
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        validateStatus: () => true
      });

      if (res.status === 200) {
        logger.info(`✅ Command executed: ${command}`);
        return true;
      }

      logger.warn(`⚠️ Command failed: ${res.status}`);
      return false;
    } catch (err) {
      logger.error('❌ executeCommand error:', err.message);
      return false;
    }
  }

  async startInterrogation(apiKey, suspectName) {
    try {
      const command = `/interrogate ${suspectName}`;
      return await this.executeCommand(apiKey, command);
    } catch (err) {
      logger.error('❌ startInterrogation error:', err.message);
      return false;
    }
  }

  async endInterrogation(apiKey) {
    try {
      const command = '/interrogate end';
      return await this.executeCommand(apiKey, command);
    } catch (err) {
      logger.error('❌ endInterrogation error:', err.message);
      return false;
    }
  }
}

export const erlc = new ERLCService();

