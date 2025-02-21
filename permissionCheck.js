// utils/permissionCheck.js
import { ServerRole } from './commands/roleCommands.js'; // ServerRole modelini import ediyoruz
import {PermissionsBitField} from 'discord.js'


export const hasPermission = async (member) => {
    // Yönetici yetkisi kontrolü
    if (member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return true;
    }

    // ServerRole koleksiyonundaki rollerle kullanıcının rollerini karşılaştırma
    const serverId = member.guild.id;
    const allowedRoles = await ServerRole.find({ server_id: serverId });

    if (allowedRoles.length === 0) {
        return false; // Kayıtlı rol yoksa yetki verme
    }

    // Kullanıcının rollerini kontrol et
    const userRoles = member.roles.cache.map(role => role.id);
    return allowedRoles.some(allowedRole => userRoles.includes(allowedRole.role_id));
};