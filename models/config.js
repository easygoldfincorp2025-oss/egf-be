
const mongoose = require('mongoose')

const defaultPermissions = {
    'Employee': {
        sections: ['dashboard', 'Inquiry', 'Customer', 'Employee', 'scheme', "carat", "property", "penalty", "Loan issue", "disburse", "Loan Pay History","reminder","Gold Loan Calculator","Reports","setting"],
        responsibilities: {
            "dashboard": false,
            "create_inquiry": false,
            "update_inquiry": false,
            "delete_inquiry": false,
            "print_inquiry_detail": false,
            "bulk_inquiry_detail": false,
            "inquiry_follow_Up": false,
            "create_customer": false,
            "update_customer": false,
            "delete_customer": false,
            "print_customer": false,
            "create_employee": false,
            "update_employee": false,
            "delete_employee": false,
            "print_employee_detail": false,
            "create_scheme": false,
            "update_scheme": false,
            "delete_scheme": false,
            "print_scheme_detail": false,
            "gold_price_change": false,
            "create_carat": false,
            "update_carat": false,
            "delete_carat": false,
            "print_carat_detail": false,
            "create_property": false,
            "update_property": false,
            "delete_property": false,
            "print_property": false,
            "create_penalty": false,
            "update_penalty": false,
            "delete_penalty": false,
            "print_penalty_detail": false,
            "create_loanIssue": false,
            "update_loanIssue": false,
            "delete_loanIssue": false,
            "print_loanIssue_detail": false,
            "create_disburse": false,
            "update_disburse": false,
            "delete_disburse": false,
            "print_disburse_detail": false,
            "bulk_interest_pay": false,
            "update_loanPayHistory": false,
            "print_loanPayHistory_detail": false,
            "create_reminder": false,
            "update_reminder": false,
            "delete_reminder": false,
            "print_reminder_detail": false
        }
    },
}

const configSchema = new mongoose.Schema({
    company: {type: String, ref: "Company", required: true},
    goldRate: [{
        branch: String,  //  id of the branch
        rate: Number,
    }],
    savant: Number,
    qrCode: String,
    headersConfig: {},
    businessType: [],
    loanTypes: [],
    permissions: {type: Object, default: defaultPermissions},
    roles: [],
    remarks: [],
    exportPolicyConfig: [],
    months: [],
    otherNames: [],
    whatsappConfig: {},
    expenseType: [],
    chargeType: [],
    devices: [],
    area: [],
    percentage: [],
    configDevices: []
},{timestamps: true})

module.exports = mongoose.model("Config", configSchema)