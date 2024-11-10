const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: false,
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    progress: {
        type: String,
        enum: ['Not_Started', 'In_Progress', 'Finished', 'We_are_Cooked_Chat'],
        default: 'Not_Started'
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    timeEstimation: {
        type: Number,
        required: true
    },
    comments: {
        type: String,
        required: false,
    },
    users: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User' // Reference to User model
    }],
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project', // Reference to Project model
        required: true
    },
});

module.exports = mongoose.model('Task', TaskSchema);
