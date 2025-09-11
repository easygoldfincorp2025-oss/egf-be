const UnsecureIssuedLoanModel = require("../models/unsecure-issued-loan");
const SecureIssuedLoanModel = require("../models/secure-issued-loan");
const UnsecurePartPaymentModel = require("../models/unsecure-loan-part-payment");
const SecurePartPaymentModel = require("../models/secure-loan-part-payment");


async function secureUnsecurePartPayment(loan, interestDetail, interestLoanAmount) {
    try {
        // Fetch unsecure loan data
        const unsecureLoan = await UnsecureIssuedLoanModel.findOne({ loan }).select('_id consultingCharge');

        // Fetch secure loan data
        const secureLoan = await SecureIssuedLoanModel.findOne({ loan }).select('_id');

        // If both loans are not found, return true (exit early)
        if (!unsecureLoan && !secureLoan) {
            return true;
        }

        const {_id: unsecureLoanId, consultingCharge} = unsecureLoan;
        const {_id: secureLoanId} = secureLoan;

        // Create interest records
        const unsecurePartPaymentPayload = {
            ...interestDetail,
            loan: secureLoanId,
            amountPaid: ((consultingCharge / 1.25) * interestDetail.amountPaid),
            interestLoanAmount: ((consultingCharge / 1.25) * interestDetail.interestLoanAmount),
            paymentDetail: interestDetail.paymentDetail.paymentMode === 'Cash' ?
                {...interestDetail.paymentDetail, paymentMode: "Cash", cashAmount: ((consultingCharge / 1.25) * interestDetail.amountPaid)} :
                { paymentMode: "Cash", cashAmount: ((consultingCharge / 1.25) * interestDetail.amountPaid)}
        };

        const securePartPaymentPayload = {
            ...interestDetail,
            loan: secureLoanId,
            amountPaid: (interestDetail.amountPaid - unsecurePartPaymentPayload.amountPaid),
            interestLoanAmount: (interestDetail.interestLoanAmount - unsecurePartPaymentPayload.interestLoanAmount),
            paymentDetail: interestDetail.paymentDetail.paymentMode === 'Cash' ?
                {...interestDetail.paymentDetail, cashAmount: (interestDetail.amountPaid - unsecurePartPaymentPayload.amountPaid)} :
                {...interestDetail.paymentDetail, bankAmount: (interestDetail.amountPaid - unsecurePartPaymentPayload.amountPaid)}
        };

        await Promise.all([
            UnsecurePartPaymentModel.create({
                loan: unsecureLoanId,
                ...unsecurePartPaymentPayload
            }),
            SecurePartPaymentModel.create({
                loan: secureLoanId,
                ...securePartPaymentPayload
            }),
        ]);


        const populateOptions = [
            {path: 'scheme'},
            {path: 'customer', populate: {path: 'branch'}},
            {path: 'company'},
        ];

        const updatedUnSecuredLoanInterestAmount = ((consultingCharge / 1.25) * interestLoanAmount);
        const updatedSecuredLoanInterestAmount = interestLoanAmount - updatedUnSecuredLoanInterestAmount;

        await Promise.all([
            UnsecureIssuedLoanModel.findByIdAndUpdate(unsecureLoanId, {interestLoanAmount: updatedUnSecuredLoanInterestAmount} , {new: true}).populate(populateOptions),
            SecureIssuedLoanModel.findByIdAndUpdate(secureLoanId, {interestLoanAmount:  updatedSecuredLoanInterestAmount}, {new: true}).populate(populateOptions),
        ]);
    } catch (error) {
        console.error('Error processing unsecure loan interest:', error.message);
        throw error;
    }
}

module.exports = { secureUnsecurePartPayment };