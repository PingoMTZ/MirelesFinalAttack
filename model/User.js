const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    projects: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project' // Reference to Project model
    }],
    tasks: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task' // Reference to Task model
    }]
});

module.exports = mongoose.model('User', UserSchema);
