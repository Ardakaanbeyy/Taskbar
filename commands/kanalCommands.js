import mongoose from 'mongoose';

const ServerChannelSchema = new mongoose.Schema({
    server_id: String,
    channel_id: String
});

const ServerChannel = mongoose.model('ServerChannel', ServerChannelSchema);

const setServerChannel = async (message) => {
    const args = message.content.slice('!kanal'.length).trim();
    if (!args) {
        return message.reply('Lütfen bir kanal ID\'si girin.');
    }

    const channelId = args;
    const serverId = message.guild.id;

    try {
        const serverChannel = await ServerChannel.findOneAndUpdate(
            { server_id: serverId },
            { channel_id: channelId },
            { new: true, upsert: true }
        );

        if (serverChannel.isNew) {
            message.reply(`Kanal başarıyla ayarlandı! Kanal ID: ${channelId}`);
        } else {
            message.reply(`Kanal başarıyla güncellendi! Kanal ID: ${channelId}`);
        }
    } catch (err) {
        console.error(err);
        message.reply('Veritabanı hatası oluştu.');
    }
};

export { setServerChannel, ServerChannel };  // Burada ServerChannel modelini dışa aktarıyoruz
