import mongoose from 'mongoose';

const ServerRoleSchema = new mongoose.Schema({
    server_id: String,
    role_id: String
});

const ServerRole = mongoose.model('ServerRole', ServerRoleSchema);

// roleCommands.js
import { hasPermission } from '../permissionCheck.js';

const addRole = async (message) => {
    const member = message.member;
    if (!(await hasPermission(member))) {
        return message.reply('Bu komutu kullanmak için gerekli yetkiniz yok.');
    }

    const args = message.content.slice('!rolladd'.length).trim().split(/\s+/);
    if (args.length === 0) return message.reply('Lütfen en az bir rol ID girin.');

    const serverId = message.guild.id;

    try {
        for (let roleId of args) {
            await ServerRole.create({ server_id: serverId, role_id: roleId });
        }
        message.reply(`Başarıyla eklenen roller: ${args.join(', ')}`);
    } catch (err) {
        console.error(err);
        message.reply('Rol eklenirken hata oluştu.');
    }
};

const removeRole = async (message) => {
    const member = message.member;
    if (!(await hasPermission(member))) {
        return message.reply('Bu komutu kullanmak için gerekli yetkiniz yok.');
    }

    const args = message.content.slice('!rolsil'.length).trim();
    if (!args) return message.reply('Lütfen silmek istediğiniz rol ID\'sini girin.');

    const serverId = message.guild.id;

    try {
        const result = await ServerRole.deleteOne({ server_id: serverId, role_id: args });
        if (result.deletedCount === 0) {
            return message.reply('Bu rol kayıtlı değil.');
        }
        message.reply(`Rol başarıyla silindi: ${args}`);
    } catch (err) {
        console.error(err);
        message.reply('Rol silinirken bir hata oluştu.');
    }
};

const listRoles = async (message) => {
    const member = message.member;
    if (!(await hasPermission(member))) {
        return message.reply('Bu komutu kullanmak için gerekli yetkiniz yok.');
    }

    const serverId = message.guild.id;

    try {
        const roles = await ServerRole.find({ server_id: serverId });
        if (roles.length === 0) return message.reply('Bu sunucuda kayıtlı yetkili rol bulunmamaktadır.');

        const roleList = roles.map(row => `<@&${row.role_id}>`).join('\n');
        message.reply(`Yetkili Roller:\n${roleList}`);
    } catch (err) {
        console.error(err);
        message.reply('Veritabanı hatası oluştu.');
    }
};

export { addRole, removeRole, listRoles, ServerRole };
