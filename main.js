import { Client, GatewayIntentBits, ActivityType } from 'discord.js';
import mongoose from 'mongoose';
import { startTimer, deleteTimer, deleteAllTimers } from './commands/timerCommands.js';
import { setServerChannel } from './commands/kanalCommands.js';
import { addRole, removeRole, listRoles } from './commands/roleCommands.js';
import { hasPermission } from './permissionCheck.js';

try {
    await mongoose.connect("mongodb://localhost:27017/timerbot?retryWrites=true&w=majority");
    console.log("MongoDB bağlantısı başarılı!");
} catch (err) {
    console.error("MongoDB bağlantı hatası:", err);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});



const prefix = '!';

client.once('ready', () => {
    console.log('Bot başarıyla giriş yaptı!');

    client.user.setActivity({
        name: "Owner : Geze",
        type: ActivityType.Playing
    });
});

const handleCommand = async (message, command) => {
    const args = message.content.slice(prefix.length).trim().split(/\s+/);

    // Yetki kontrolü
    const member = message.member;
    if (!(await hasPermission(member))) {
        return message.reply('Bu komutu kullanmak için gerekli yetkiniz yok.');
    }

    switch (command) {
        case 'timer':
            await startTimer(message);
            break;
        case 'sil':
            await deleteTimer(message);
            break;
        case 'hepsinisil':
            await deleteAllTimers(message);
            break;
        case 'kanal':
            await setServerChannel(message);
            break;
        case 'rolladd':
            await addRole(message);
            break;
        case 'rolsil':
            await removeRole(message);
            break;
        case 'roller':
            await listRoles(message);
            break;
        default:
            console.log('Bilinmeyen komut.');
            break;
    }
};

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/\s+/);
    const command = args.shift().toLowerCase();

    await handleCommand(message, command);
});

client.login('MTIxMTM2MTMxMTU2OTYxNjk2OA.GAApMI.tMuKryKac6vfhG3pSoVJ6TGEJVBKjmK7UfLFMw');