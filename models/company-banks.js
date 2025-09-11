const mongoose = require('mongoose');

const companyBankSchema = new mongoose.Schema({
    company: {type: String, ref: 'Company', required: true},
    bankName: {type: String, required: true},
    accountNumber: {type: String, required: true},
    accountType: {type: String, required: true},
    accountHolderName: {type: String, required: true},
    branchName: {type: String, required: true},
    IFSC: {type: String, required: true},
}, {timestamps: true});

module.exports = mongoose.model('Company Bank', companyBankSchema);

