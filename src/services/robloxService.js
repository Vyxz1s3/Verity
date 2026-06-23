import axios from 'axios';
import { logger } from '../utils/logger.js';

const ROBLOX_API = 'https://apis.roblox.com';

class RobloxService {
  constructor() {
    this.username = process.env.ROBLOX_USERNAME;
    this.password = process.env.ROBLOX_PASSWORD;
    this.cookie = null;
    this.lastAuth = 0;
  }

  async login() {
    try {
      if (this.cookie && Date.now() - this.lastAuth < 3600000) return true;

      if (!this.username || !this.password) {
        logger.error('❌ Roblox credentials not set');
        return false;
      }

      const res = await axios.post('https://auth.roblox.com/v2/login', {
        ctype: 'Username',
        cvalue: this.username,
        password: this.password
      }, {
        headers: { 'Content-Type': 'application/json' },
        validateStatus: () => true
      });

      if (res.status !== 200) {
        logger.error('❌ Roblox login failed:', res.status);
        return false;
      }

      const cookies = res.headers['set-cookie'];
      if (cookies) {
        this.cookie = cookies.join('; ');
        this.lastAuth = Date.now();
        logger.info('✅ Roblox login success');
        return true;
      }

      return false;
    } catch (err) {
      logger.error('❌ Login error:', err.message);
      return false;
    }
  }

  async getJoinRequests(groupId) {
    try {
      if (!await this.login()) return [];

      const res = await axios.get(`${ROBLOX_API}/v1/groups/${groupId}/join-requests`, {
        headers: { Cookie: this.cookie },
        validateStatus: () => true
      });

      if (res.status === 200) {
        return res.data.data || [];
      }

      logger.warn(`⚠️ Failed to fetch requests for group ${groupId}: ${res.status}`);
      return [];
    } catch (err) {
      logger.error('❌ getJoinRequests error:', err.message);
      return [];
    }
  }

  async getUser(userId) {
    try {
      const res = await axios.get(`${ROBLOX_API}/v1/users/${userId}`, {
        validateStatus: () => true
      });

      return res.status === 200 ? res.data : null;
    } catch (err) {
      logger.error('❌ getUser error:', err.message);
      return null;
    }
  }

  async acceptRequest(groupId, userId) {
    try {
      if (!await this.login()) return false;

      const res = await axios.post(
        `${ROBLOX_API}/v1/groups/${groupId}/join-requests/users/${userId}/accept`,
        {},
        { headers: { Cookie: this.cookie }, validateStatus: () => true }
      );

      return res.status === 200;
    } catch (err) {
      logger.error('❌ acceptRequest error:', err.message);
      return false;
    }
  }

  async denyRequest(groupId, userId) {
    try {
      if (!await this.login()) return false;

      const res = await axios.post(
        `${ROBLOX_API}/v1/groups/${groupId}/join-requests/users/${userId}/decline`,
        {},
        { headers: { Cookie: this.cookie }, validateStatus: () => true }
      );

      return res.status === 200;
    } catch (err) {
      logger.error('❌ denyRequest error:', err.message);
      return false;
    }
  }
}

export const roblox = new RobloxService();

const seen = new Set();

export async function checkRobloxRequests(client) {
  try {
    const groups = [
      { id: process.env.ROBLOX_TEST_GROUP_ID, ch: process.env.ROBLOX_REQUESTS_CHANNEL_TEST, name: 'Test' },
      { id: process.env.ROBLOX_LASD_GROUP_ID, ch: process.env.ROBLOX_REQUESTS_CHANNEL_LASD, name: 'LASD' },
      { id: process.env.ROBLOX_CHP_GROUP_ID, ch: process.env.ROBLOX_REQUESTS_CHANNEL_CHP, name: 'CHP' },
      { id: process.env.ROBLOX_LAFD_GROUP_ID, ch: process.env.ROBLOX_REQUESTS_CHANNEL_LAFD, name: 'LAFD' }
    ];

    for (const g of groups) {
      if (!g.id || !g.ch) continue;

      try {
        const channel = await client.channels.fetch(g.ch).catch(() => null);
        if (!channel) {
          logger.warn(`⚠️ Channel ${g.ch} not found`);
          continue;
        }

        const requests = await roblox.getJoinRequests(g.id);
        logger.info(`📋 ${g.name}: ${requests.length} requests`);

        for (const req of requests) {
          const uid = req.requester.userId;
          const key = `${g.id}_${uid}`;

          if (seen.has(key)) continue;
          seen.add(key);

          const user = await roblox.getUser(uid);
          if (!user) continue;

          const embed = {
            title: `🎮 ${g.name} Join Request`,
            color: 0x1a1a1a,
            fields: [
              { name: 'User', value: user.name, inline: true },
              { name: 'ID', value: String(uid), inline: true }
            ],
            timestamp: new Date()
          };

          await channel.send({
            embeds: [embed],
            components: [{
              type: 1,
              components: [
                { type: 2, style: 3, label: 'Accept', custom_id: `roblox_accept_${g.id}_${uid}`, emoji: '✅' },
                { type: 2, style: 4, label: 'Deny', custom_id: `roblox_deny_${g.id}_${uid}`, emoji: '❌' }
              ]
            }]
          });

          logger.info(`✅ Posted request from ${user.name}`);
        }
      } catch (err) {
        logger.error(`❌ Error checking ${g.name}:`, err.message);
      }
    }
  } catch (err) {
    logger.error('❌ checkRobloxRequests error:', err.message);
  }
}

