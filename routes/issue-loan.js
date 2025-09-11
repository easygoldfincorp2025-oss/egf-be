const express = require('express');
const multer = require('multer');
const router = express.Router();
const {
    issueLoan,
    getAllLoans,
    updateLoan,
    loanPartPayment,
    GetClosedLoanDetails,
    deleteUchakInterestPayment,
    GetUchakInterestPayment,
    uchakInterestPayment,
    deleteInterestPayment,
    deletePartReleaseDetail,
    partRelease,
    loanClose,
    getSingleLoan,
    updatePartReleaseDetail,
    deletePartPaymentDetail,
    updateInterestPayment,
    deleteIssuedLoan,
    disburseLoan,
    interestPayment,
    GetInterestPayment,
    GetPartPaymentDetail,
    GetPartReleaseDetail,
    InterestReports,
    getAllSecuredLoans,
    getAllUnsecuredLoans,
    GetSecureClosedLoanDetails,
    GetUnsecureClosedLoanDetails,
    GetSecureInterestPayment,
    GetUnsecureInterestPayment,
    GetSecurePartPaymentDetail,
    GetUnsecurePartPaymentDetail,
    GetSecurePartReleaseDetail,
    GetUnsecurePartReleaseDetail,
} = require('../controllers/issue-loan')

const storage = multer.memoryStorage();
const upload = multer({storage});

router.post('/:companyId/issue-loan', upload.single('property-image'), issueLoan);
router.post('/disburse-loan', disburseLoan);
router.get('/:companyId/loans', getAllLoans);
router.get('/:companyId/secured-loans', getAllSecuredLoans);
router.get('/:companyId/unsecured-loans', getAllUnsecuredLoans);
router.delete('/:companyId/loans/:loanId', deleteIssuedLoan);
router.get('/:companyId/loans/interest-reports', InterestReports);
router.get('/:companyId/loans/:loanId', getSingleLoan);
router.put('/:companyId/loans/:loanId', upload.single('property-image'), updateLoan);
router.post('/loans/:loanId/interest-payment', interestPayment);
router.delete('/loans/:loanId/interest-payment/:id', deleteInterestPayment);
router.post('/loans/:loanId/loan-close', loanClose);
router.post('/loans/:loanId/uchak-interest-payment', uchakInterestPayment);
router.get('/loans/:loanId/uchak-interest-payment', GetUchakInterestPayment);
router.delete('/loans/:loanId/uchak-interest-payment/:id', deleteUchakInterestPayment);
router.get('/loans/:loanId/interest-payment', GetInterestPayment);
router.get('/loans/:loanId/secured-interest-payment', GetSecureInterestPayment);
router.get('/loans/:loanId/unsecured-interest-payment', GetUnsecureInterestPayment);
router.put('/loans/:loanId/interest-payment/:interestId', updateInterestPayment);
router.put('/loans/:loanId/part-release/:partId', updatePartReleaseDetail);
router.get('/loans/:loanId/loan-part-payment', GetPartPaymentDetail);
router.get('/loans/:loanId/secured-loan-part-payment', GetSecurePartPaymentDetail);
router.get('/loans/:loanId/unsecured-loan-part-payment', GetUnsecurePartPaymentDetail);
router.get('/loans/:loanId/part-release', GetPartReleaseDetail);
router.get('/loans/:loanId/secured-part-release', GetSecurePartReleaseDetail);
router.get('/loans/:loanId/unsecured-part-release', GetUnsecurePartReleaseDetail);
router.get('/loans/:loanId/loan-close', GetClosedLoanDetails);
router.get('/loans/:loanId/secured-loan-close', GetSecureClosedLoanDetails);
router.get('/loans/:loanId/unsecured-loan-close', GetUnsecureClosedLoanDetails);
router.post('/loans/:loanId/part-release', upload.single('property-image'), partRelease);
router.post('/loans/:loanId/part-payment', loanPartPayment);
router.delete('/loans/:loanId/part-payment/:paymentId', deletePartPaymentDetail);
router.delete('/loans/:loanId/part-release/:partId', deletePartReleaseDetail);

module.exports = router;
