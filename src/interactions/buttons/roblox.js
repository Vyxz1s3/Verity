import { robloxAccept, robloxDeny } from '../../handlers/robloxButtonHandler.js';

export default [
  {
    name: 'roblox_accept',
    execute: robloxAccept.execute.bind(robloxAccept),
    customId: robloxAccept.customId
  },
  {
    name: 'roblox_deny',
    execute: robloxDeny.execute.bind(robloxDeny),
    customId: robloxDeny.customId
  }
];

