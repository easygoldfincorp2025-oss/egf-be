const UnsecureIssuedLoanModel = require("../models/unsecure-issued-loan");
const SecureIssuedLoanModel = require("../models/secure-issued-loan");
const UnsecureLoanCloseModel = require("../models/unsecure-loan-close");
const SecureLoanCloseModel = require("../models/secure-loan-close");


async function secureUnsecureLoanClose(loan, payload) {
    try {
        const unsecureLoan = await UnsecureIssuedLoanModel.findOne({ loan }).select('_id consultingCharge');

        // Fetch secure loan data
        const secureLoan = await SecureIssuedLoanModel.findOne({ loan }).select('_id');

        // If both loans are not found, return true (exit early)
        if (!unsecureLoan && !secureLoan) {
            return true;
        }

        // If either loan is not found individually, throw an error
        if (!unsecureLoan) throw new Error('Unsecure loan not found');
        if (!secureLoan) throw new Error('Secure loan not found');

        const {_id: unsecureLoanId, consultingCharge} = unsecureLoan;
        const {_id: secureLoanId} = secureLoan;

        // Create interest records
        const unsecureLoanClosePayload = {
            ...payload,
            loan: secureLoanId,
            totalLoanAmount: ((consultingCharge / 1.25) * payload.totalLoanAmount),
            netAmount: ((consultingCharge / 1.25) * payload.netAmount),
            closingCharge: 0,
            paymentDetail: {
                paymentMode: "Cash",
                cashAmount: ((consultingCharge / 1.25) * payload.netAmount)
            }
        };

        const secureLoanClosePayload = {
            ...payload,
            loan: secureLoanId,
            totalLoanAmount: (payload.totalLoanAmount - unsecureLoanClosePayload.totalLoanAmount),
            netAmount: (payload.netAmount - unsecureLoanClosePayload.netAmount),
            paymentDetail: payload.paymentDetail.paymentMode === 'Cash' ?
                {...payload.paymentDetail, cashAmount: (payload.netAmount - unsecureLoanClosePayload.netAmount)} :
                {...payload.paymentDetail, bankAmount: (payload.netAmount - unsecureLoanClosePayload.netAmount)}
        };

        await Promise.all([
            UnsecureLoanCloseModel.create({
                loan: unsecureLoanId,
                ...unsecureLoanClosePayload
            }),
            SecureLoanCloseModel.create({
                loan: secureLoanId,
                ...secureLoanClosePayload
            }),
        ]);

        const loanDetail = {
            status : "Closed",
            interestLoanAmount : 0,
            closedBy : payload.closedBy
        }

        await Promise.all([
            UnsecureIssuedLoanModel.findByIdAndUpdate(unsecureLoanId, loanDetail , {new: true}),
            SecureIssuedLoanModel.findByIdAndUpdate(secureLoanId, loanDetail, {new: true}),
        ]);
    } catch (error) {
        console.error('Error processing unsecure loan interest:', error.message);
        throw error;
    }
}

module.exports = { secureUnsecureLoanClose };