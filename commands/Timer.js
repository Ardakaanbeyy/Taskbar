const mongoose = require('mongoose');

const timerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    server_id: { type: String, required: true },
    stages: [{
        name: { type: String, required: true },
        time: { type: Number, required: true }, // Dakika cinsinden
        startTime: { type: Date, required: true },
        completed: { type: Boolean, default: false }
    }],
    currentIndex: { type: Number, default: 0 },
    messageId: { type: String }
});

module.exports = mongoose.model('Timer', timerSchema);
