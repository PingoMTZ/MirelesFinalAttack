const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: false,
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    administrator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User' // Reference to User model
    },
    users: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User' // Reference to User model
    }],
    tasks: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task' // Reference to Task model
    }],
    members:[{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }]
});

module.exports = mongoose.model('Project', ProjectSchema);



