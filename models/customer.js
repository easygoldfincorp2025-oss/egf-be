const mongoose = require('mongoose')
const addressSchema = require("./common/address");

const customerSchema = new mongoose.Schema({
    company: {type: String, ref: "Company", required: true},
    branch: {type: String, ref: "Branch", required: true},
    firstName: String,
    middleName: String,
    lastName: String,
    email: String,
    contact: String,
    dob: String,
    drivingLicense: String,
    customerCode: String,
    joiningDate: String,
    panCard: {type: String},
    aadharCard: {type: String},
    isAadharVerified: {type: Boolean, default: false},
    referenceBy: String,
    otpContact: String,
    businessType: String,
    loanType: Object,
    status: {type: String, default: "Active"},
    remark: String,
    avatar_url: {type: String, default: null},
    nominee: {
        name: String,
        relation: String,
        dob: String,
    },
    permanentAddress: {type: addressSchema},
    temporaryAddress: {type: addressSchema},
    bankDetails: [],
    isLoan: {type: Boolean, default: false},
    deleted_at: {type: Date, default: null},
},{timestamps: true})

module.exports = mongoose.model("Customer",customerSchema)