import mongoose from 'mongoose';
import { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { ServerChannel } from './kanalCommands.js';

const TimerSchema = new mongoose.Schema({
    server_id: String,
    name: String,
    stages: Array,
    currentIndex: Number,
    startTime: Number,
    messageId: String,
    isCancelled: { type: Boolean, default: false },
    isWaitingForApproval: { type: Boolean, default: false },
    lastUpdateTime: { type: Date, default: null }
});

const Timer = mongoose.model('Timer', TimerSchema);

// Kanal ID'sini almak için kullanılan fonksiyon
const getChannelId = async (serverId) => {
    try {
        const serverChannel = await ServerChannel.findOne({ server_id: serverId });
        return serverChannel ? serverChannel.channel_id : null;
    } catch (err) {
        console.error('Kanal ID\'si alınırken hata oluştu:', err);
        return null;
    }
};

// Helper function to calculate the progress of a stage
const calculateProgress = (stage) => {
    let elapsedTime = Date.now() - stage.startTime;
    let progress = elapsedTime / (stage.time * 60000);
    return Math.min(1, Math.max(0, progress)); // Ensure the progress is between 0 and 1
};

// Helper function to create a visual progress bar
const createProgressBar = (progress) => {
    const totalBars = 20;
    const filledBars = Math.round(progress * totalBars);
    return '█'.repeat(filledBars) + '░'.repeat(totalBars - filledBars);
};

// **Zamanlayıcıyı başlatmak için kullanılan fonksiyon**
const startTimer = async (message) => {
    const args = message.content.slice('!timer'.length).trim();
    if (!args) return message.reply('Lütfen geçerli bir görev adı ve aşama süreleri girin.');

    const timerSets = args.split(',');
    const name = timerSets[0].trim();
    const stages = timerSets.slice(1).map(stage => stage.trim());

    if (!name || stages.length === 0) return message.reply('Lütfen geçerli bir görev adı ve en az bir aşama süresi girin.');

    let stagesData = [];
    const defaultStageNames = ['Çeviri', 'Encode', 'Upload'];

    for (let i = 0; i < stages.length; i++) {
        const stageTime = parseInt(stages[i]);
        if (isNaN(stageTime) || stageTime <= 0) return message.reply(`"${defaultStageNames[i] || `Aşama ${i + 1}`}" için geçerli bir süre girin.`);

        stagesData.push({ name: defaultStageNames[i] || `Aşama ${i + 1}`, time: stageTime, startTime: null, completed: false });
    }

    const serverId = message.guild.id;

    try {
        let timer = await Timer.findOne({ server_id: serverId, name });

        if (timer) {
            return message.reply('Bu isimde bir zamanlayıcı zaten mevcut.');
        }

        timer = new Timer({ server_id: serverId, name, stages: stagesData, currentIndex: 0, startTime: null, messageId: null });
        await timer.save();

        message.reply(`Yeni zamanlayıcı "${name}" başarıyla başlatıldı.`);
        runTimerStages(timer, message);
    } catch (err) {
        console.error(err);
        message.reply('Zamanlayıcı kaydedilirken bir hata oluştu.');
    }
};

// **Zamanlayıcıyı çalıştıran fonksiyon**
const runTimerStages = async (timer, message) => {
    const serverId = message.guild.id;
    const channelId = await getChannelId(serverId);

    if (!channelId) {
        return message.reply('Kanal ID\'si bulunamadı!');
    }

    const channel = message.guild.channels.cache.get(channelId);
    if (!channel) {
        return message.reply('Geçerli bir kanal bulunamadı!');
    }

    const updateEmbed = async () => {
        const completedStages = timer.stages.filter(stage => stage.completed).map(stage => `${stage.name} : [██████████████] %100`);
        const remainingStages = timer.stages.filter(stage => !stage.completed);
        let embedColor = '#00FF00';
        let description = '';

        if (timer.currentIndex >= timer.stages.length) {
            embedColor = '#0000FF';
            description = `**Görev tamamlandı!** \n\n${completedStages.join('\n')}`;
        } else if (timer.isCancelled) {
            embedColor = '#FF0000';
            description = `**Görev iptal edildi!** \n\n${completedStages.join('\n')}`;
        } else {
            const currentStage = timer.stages[timer.currentIndex];
            const progress = calculateProgress(currentStage);
            const progressBar = createProgressBar(progress);

            description = `${completedStages.length > 0 ? `**Tamamlanmış aşamalar**\n${completedStages.join('\n')}\n\n` : ''}` +
                `**Mevcut aşama**\n${currentStage.name} : [${progressBar}] ${Math.round(progress * 100)}%\n\n` +
                `${remainingStages.length > 1 ? `**Bekleyen aşamalar**\n${remainingStages.slice(1).map(stage => `${stage.name} : [░░░░░░░░░░░░░░░░] %0`).join('\n')}\n\n` : ''}`;
        }

        const taskEmbed = new EmbedBuilder()
            .setColor(embedColor)
            .setTitle(`${timer.name} - Görev Durumu`)
            .setDescription(description)
            .setFooter({ text: `${message.guild.name}` })
            .setTimestamp();

        if (timer.messageId) {
            const msg = await channel.messages.fetch(timer.messageId).catch(() => null);
            if (msg) {
                await msg.edit({ embeds: [taskEmbed] });
                return;
            }
        }

        let msg = await channel.send({ embeds: [taskEmbed] });
        timer.messageId = msg.id;
        await timer.save();
    };

    await updateEmbed();

    const interval = setInterval(async () => {
        if (timer.currentIndex >= timer.stages.length || timer.isCancelled) {
            clearInterval(interval);
            return;
        }

        let currentStage = timer.stages[timer.currentIndex];
        if (!currentStage.startTime) {
            currentStage.startTime = Date.now();
            await timer.save();
        }

        const elapsedTime = Date.now() - currentStage.startTime;

        if (elapsedTime >= currentStage.time * 60000 && !currentStage.completed && !timer.isWaitingForApproval) {
            await sendApprovalMessage(timer, message);
        }

        if (timer.isWaitingForApproval) {
            const timeSinceLastUpdate = Date.now() - timer.lastUpdateTime;
            if (timeSinceLastUpdate >= 600000) {
                await updateEmbed();
                timer.lastUpdateTime = Date.now();
                await timer.save();
            }
        } else {
            await updateEmbed();
        }
    }, timer.isWaitingForApproval ? 600000 : 10000);  // 10 dakika veya 3 saniye
};

// timerCommands.js
import { hasPermission } from '../permissionCheck.js';

const sendApprovalMessage = async (timer, message) => {
    const currentStage = timer.stages[timer.currentIndex];

    // Eğer aşama zaten tamamlandıysa, onay mesajı göndermeyelim
    if (currentStage.completed) return;

    const approvalButton = new ButtonBuilder()
        .setCustomId('approve')
        .setLabel('Aşamayı Onayla')
        .setStyle(ButtonStyle.Success);

    const cancelButton = new ButtonBuilder()
        .setCustomId('cancel')
        .setLabel('Görevi İptal Et')
        .setStyle(ButtonStyle.Danger);

    const actionRow = new ActionRowBuilder().addComponents(approvalButton, cancelButton);

    const approvalMessage = await message.reply({
        content: `${currentStage.name} aşaması tamamlandı. Lütfen onay verin.`,
        components: [actionRow]
    });

    // Buton etkileşimlerini dinle
    const filter = async (interaction) => {
        const member = interaction.member;
        return await hasPermission(member); // Yetki kontrolü
    };

    const collector = approvalMessage.createMessageComponentCollector({
        filter,
        time: 3600000,  // 1 saat
        max: 1
    });

    collector.on('collect', async (interaction) => {
        if (interaction.customId === 'approve') {
            // Aşama onaylandı
            await approveStage(timer, message);
            await interaction.reply({ content: 'Aşama onaylandı!', flags: [MessageFlags.Ephemeral] });
        } else if (interaction.customId === 'cancel') {
            // Görev iptal edildi
            await cancelStage(timer, message);
            await interaction.reply({ content: 'Görev iptal edildi!', flags: [MessageFlags.Ephemeral] });
        }
    });

    timer.isWaitingForApproval = true;
    timer.lastUpdateTime = Date.now();
    await timer.save();
};


// **Aşama onaylama fonksiyonu**
const approveStage = async (timer, message) => {
    const currentStage = timer.stages[timer.currentIndex];

    if (currentStage.completed) return; // Zaten onaylanmışsa işlem yapma

    timer.stages[timer.currentIndex].completed = true;
    timer.currentIndex += 1;
    timer.isWaitingForApproval = false;
    await timer.save();

    message.reply('Aşama başarıyla onaylandı.');
    runTimerStages(timer, message);  // Durum güncellenip bir sonraki aşamaya geçme
};

// **Görev iptal fonksiyonu**
const cancelStage = async (timer, message) => {
    timer.isCancelled = true;
    timer.isWaitingForApproval = false;
    await timer.save();

    message.reply('Görev iptal edildi.');
    runTimerStages(timer, message);  // Durum güncellenip iptal işlemi yapılır
};



const deleteTimer = async (message) => {
    const args = message.content.slice('!sil'.length).trim();
    if (!args) return message.reply('Lütfen silmek istediğiniz görev adını girin.');

    const serverId = message.guild.id;

    try {
        const result = await Timer.deleteOne({ server_id: serverId, name: args });
        if (result.deletedCount === 0) {
            return message.reply('Bu isimde bir zamanlayıcı bulunamadı.');
        }
        message.reply(`Zamanlayıcı "${args}" başarıyla silindi.`);
    } catch (err) {
        console.error(err);
        message.reply('Zamanlayıcı silinirken bir hata oluştu.');
    }
};


const deleteAllTimers = async (message) => {
    const serverId = message.guild.id;

    try {
        const result = await Timer.deleteMany({ server_id: serverId });

        if (result.deletedCount === 0) {
            return message.reply('Bu sunucuda silinecek zamanlayıcı bulunmamaktadır.');
        }

        message.reply(`Tüm zamanlayıcılar başarıyla silindi.`);
    } catch (err) {
        console.error(err);
        message.reply('Zamanlayıcılar silinirken bir hata oluştu.');
    }
};

export { startTimer, deleteTimer, deleteAllTimers };
