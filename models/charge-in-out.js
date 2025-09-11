const mongoose = require('mongoose');

const chargeInOutSchema = new mongoose.Schema({
    company: {type: String, ref: 'Company'},
    branch: {type: String, ref: 'Branch'},
    otherLoanId: {type: String, default: null},
    loanId: {type: String, default: null},
    chargeType: String,
    description: String,
    category: String,
    date: Date,
    paymentDetail: Object,
    status: {type: String},
    deleted_at: {type: Date, default: null},
}, {timestamps: true});

module.exports = mongoose.model('ChargeInOut', chargeInOutSchema);