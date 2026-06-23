import { logger } from '../utils/logger.js';
import axios from 'axios';

const ROBLOX_API = 'https://apis.roblox.com';

class RobloxJoinRequestHandler {
  constructor() {
    this.username = process.env.ROBLOX_USERNAME;
    this.password = process.env.ROBLOX_PASSWORD;
    this.cookie = null;
    this.lastAuthTime = 0;
    this.authCooldown = 3600000; // 1 hour
  }

  async authenticate() {
    try {
      if (this.cookie && Date.now() - this.lastAuthTime < this.authCooldown) {
        return true;
      }

      if (!this.username || !this.password) {
        logger.error('🎮 Roblox credentials missing');
        return false;
      }

      logger.info('🎮 Authenticating with Roblox...');
      
      const response = await axios.post(
        'https://auth.roblox.com/v2/login',
        {
          ctype: 'Username',
          cvalue: this.username,
          password: this.password
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0'
          },
          withCredentials: true,
          validateStatus: () => true
        }
      );

      if (response.status === 200 && response.data.user) {
        const cookies = response.headers['set-cookie'];
        if (cookies) {
          this.cookie = cookies.join('; ');
          this.lastAuthTime = Date.now();
          logger.info('🎮 Roblox auth successful');
          return true;
        }
      }

      logger.error('🎮 Roblox auth failed:', response.status, response.data?.errors?.[0]?.message);
      return false;
    } catch (error) {
      logger.error('🎮 Auth error:', error.message);
      return false;
    }
  }

  async getGroupJoinRequests(groupId) {
    try {
      if (!await this.authenticate()) {
        return [];
      }

      const response = await axios.get(
        `${ROBLOX_API}/v1/groups/${groupId}/join-requests`,
        {
          headers: {
            'Cookie': this.cookie,
            'User-Agent': 'Mozilla/5.0'
          },
          validateStatus: () => true
        }
      );

      if (response.status === 200) {
        const requests = response.data.data || [];
        logger.info(`🎮 Group ${groupId}: ${requests.length} join requests`);
        return requests;
      }

      logger.warn(`🎮 Failed to fetch requests for group ${groupId}: ${response.status}`);
      return [];
    } catch (error) {
      logger.error(`🎮 Error fetching requests:`, error.message);
      return [];
    }
  }

  async getUserInfo(userId) {
    try {
      const response = await axios.get(
        `${ROBLOX_API}/v1/users/${userId}`,
        { validateStatus: () => true }
      );

      return response.status === 200 ? response.data : null;
    } catch (error) {
      logger.error(`🎮 Error fetching user ${userId}:`, error.message);
      return null;
    }
  }

  async acceptJoinRequest(groupId, userId) {
    try {
      if (!await this.authenticate()) return false;

      const response = await axios.post(
        `${ROBLOX_API}/v1/groups/${groupId}/join-requests/users/${userId}/accept`,
        {},
        {
          headers: { 'Cookie': this.cookie },
          validateStatus: () => true
        }
      );

      if (response.status === 200) {
        logger.info(`🎮 Accepted user ${userId} to group ${groupId}`);
        return true;
      }

      logger.warn(`🎮 Accept failed: ${response.status}`);
      return false;
    } catch (error) {
      logger.error(`🎮 Accept error:`, error.message);
      return false;
    }
  }

  async denyJoinRequest(groupId, userId) {
    try {
      if (!await this.authenticate()) return false;

      const response = await axios.post(
        `${ROBLOX_API}/v1/groups/${groupId}/join-requests/users/${userId}/decline`,
        {},
        {
          headers: { 'Cookie': this.cookie },
          validateStatus: () => true
        }
      );

      if (response.status === 200) {
        logger.info(`🎮 Denied user ${userId} from group ${groupId}`);
        return true;
      }

      logger.warn(`🎮 Deny failed: ${response.status}`);
      return false;
    } catch (error) {
      logger.error(`🎮 Deny error:`, error.message);
      return false;
    }
  }
}

export const robloxHandler = new RobloxJoinRequestHandler();

const processedRequests = new Set();

export async function checkRobloxJoinRequests(client) {
  try {
    const configs = [
      { groupId: process.env.ROBLOX_TEST_GROUP_ID, channelId: process.env.ROBLOX_REQUESTS_CHANNEL_TEST, name: 'Test' },
      { groupId: process.env.ROBLOX_LASD_GROUP_ID, channelId: process.env.ROBLOX_REQUESTS_CHANNEL_LASD, name: 'LASD' },
      { groupId: process.env.ROBLOX_CHP_GROUP_ID, channelId: process.env.ROBLOX_REQUESTS_CHANNEL_CHP, name: 'CHP' },
      { groupId: process.env.ROBLOX_LAFD_GROUP_ID, channelId: process.env.ROBLOX_REQUESTS_CHANNEL_LAFD, name: 'LAFD' }
    ];

    for (const config of configs) {
      if (!config.groupId || !config.channelId) continue;

      try {
        const channel = await client.channels.fetch(config.channelId).catch(() => null);
        if (!channel) {
          logger.warn(`🎮 Channel not found: ${config.channelId}`);
          continue;
        }

        const requests = await robloxHandler.getGroupJoinRequests(config.groupId);

        for (const req of requests) {
          const userId = req.requester.userId;
          const reqKey = `${config.groupId}_${userId}`;

          if (processedRequests.has(reqKey)) continue;
          processedRequests.add(reqKey);

          const user = await robloxHandler.getUserInfo(userId);
          if (!user) continue;

          const embed = {
            title: `🎮 Join Request - ${config.name}`,
            color: 0x1a1a1a,
            fields: [
              { name: 'Username', value: user.name, inline: true },
              { name: 'Display Name', value: user.displayName, inline: true },
              { name: 'User ID', value: `${userId}`, inline: true }
            ],
            footer: { text: `Group: ${config.groupId}` },
            timestamp: new Date()
          };

          await channel.send({
            embeds: [embed],
            components: [{
              type: 1,
              components: [
                { type: 2, style: 3, label: 'Accept', custom_id: `roblox_accept_${config.groupId}_${userId}`, emoji: '✅' },
                { type: 2, style: 4, label: 'Deny', custom_id: `roblox_deny_${config.groupId}_${userId}`, emoji: '❌' }
              ]
            }]
          });

          logger.info(`🎮 Posted request from ${user.name} (${userId}) to ${config.name}`);
        }
      } catch (error) {
        logger.error(`🎮 Error checking ${config.name}:`, error.message);
      }
    }
  } catch (error) {
    logger.error('🎮 checkRobloxJoinRequests error:', error.message);
  }
}

