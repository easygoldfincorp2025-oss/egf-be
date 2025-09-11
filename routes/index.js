const express = require('express');
const authRouter = require("../routes/auth")
const branchRouter = require("../routes/branch")
const userRouter = require("../routes/user")
const schemeRouter = require("../routes/scheme")
const inquiryRouter = require("../routes/inquiry")
const customerRouter = require("../routes/customer")
const caratRouter = require("../routes/carat")
const loanRouter = require("./loan_type")
const propertyRouter = require("../routes/property")
const penaltyRouter = require("../routes/penalty")
const employeeRouter = require("../routes/employee")
const configRouter = require("../routes/config")
const companyRouter = require("../routes/company")
const issueLoanRouter = require("../routes/issue-loan")
const otherIssuedLoanRouter = require("../routes/other-issued-loan")
const reminderRouter = require("../routes/reminder")
const commonRouter = require("../routes/common")
const reportRouter = require("../routes/reports")
const verificationRouter = require("../routes/verification")
const whatsappNotificationRouter = require("../routes/whatsapp-notification")
const analyticsRouter = require("../routes/analytics")
const expenseRouter = require("../routes/expense")
const chargeInOutRouter = require("../routes/charge-in-out")
const partyRouter = require("../routes/party")
const otherIncomeRouter = require("../routes/other-income")
const paymentInOutRouter = require("../routes/payment-in-out")
const dashboardRouter = require("../routes/dashboard")
const transferRouter = require("../routes/transfer")
const companyBankRoutes = require("./company-banks")

const router = express.Router();

router.get('/', function (req, res, next) {
    res.render('index', {title: 'EGF'});
});

router.get('/ip', function (req, res, next) {
    let ip = req.ip;

    let forwardedIp = req.headers['x-forwarded-for']?.split(',')[0] || req.connection.remoteAddress;

    res.send({ ip, forwardedIp });
});

router.use('/auth', authRouter)
router.use('/company', companyRouter)
router.use('/company', dashboardRouter)
router.use('/company', branchRouter)
router.use('/company', schemeRouter)
router.use('/company', inquiryRouter)
router.use('/company', branchRouter)
router.use('/company', userRouter)
router.use('/company', customerRouter)
router.use('/company', caratRouter)
router.use('/company', loanRouter)
router.use('/company', propertyRouter)
router.use('/company', penaltyRouter)
router.use('/company', employeeRouter)
router.use('/company', configRouter)
router.use('/company', reminderRouter)
router.use('/company', commonRouter)
router.use('/company', reportRouter)
router.use('/verification', verificationRouter)
router.use('/whatsapp-notification', whatsappNotificationRouter)
router.use('/company', analyticsRouter)
router.use('/company', expenseRouter)
router.use('/company', partyRouter)
router.use('/company', chargeInOutRouter)
router.use('/company', paymentInOutRouter)
router.use('/company', otherIncomeRouter)
router.use('/company', transferRouter)
router.use('/company', companyBankRoutes);


// loans
router.use('/company',  issueLoanRouter)
router.use('/company',  otherIssuedLoanRouter)

module.exports = router;
