const UnsecureIssuedLoanModel = require('../../models/unsecure-issued-loan');
const SecureIssuedLoanModel = require('../../models/secure-issued-loan');
const UnsecureInterestLoanModel = require('../../models/unsecure-interest');
const SecureInterestLoanModel = require('../../models/secure-interest');

/**
 * Handles the creation of interest records and updates for both unsecure and secure loans.
 */
async function secure_unsecureLoanInterest(loan, nextInstallmentDate, lastInstallmentDate, interestDetail) {
    try {
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
        const unsecureInterestPayload = {
            ...interestDetail,
            loan: unsecureLoanId,
            adjustedPay: ((consultingCharge / 1.25) * interestDetail.adjustedPay),
            interestAmount: ((consultingCharge / 1.25) * interestDetail.interestAmount),
            consultingCharge: ((consultingCharge / 1.25) * interestDetail.consultingCharge),
            penalty: ((consultingCharge / 1.25) * interestDetail.penalty),
            amountPaid: ((consultingCharge / 1.25) * interestDetail.amountPaid),
            interestLoanAmount: ((consultingCharge / 1.25) * interestDetail.interestLoanAmount),
            paymentDetail: {
                paymentMode: "Cash",
                cashAmount: (consultingCharge / 1.25) * interestDetail.amountPaid
            }
        };

        const secureInterestPayload = {
            ...interestDetail,
            loan: secureLoanId,
            adjustedPay: (interestDetail.adjustedPay - unsecureInterestPayload.adjustedPay),
            interestAmount: (interestDetail.interestAmount - unsecureInterestPayload.interestAmount),
            consultingCharge: (interestDetail.consultingCharge - unsecureInterestPayload.consultingCharge),
            penalty: (interestDetail.penalty - unsecureInterestPayload.penalty),
            amountPaid: (interestDetail.amountPaid - unsecureInterestPayload.amountPaid),
            interestLoanAmount: (interestDetail.interestLoanAmount - unsecureInterestPayload.interestLoanAmount),
            paymentDetail: interestDetail.paymentDetail.paymentMode === 'Cash' ?
                {...interestDetail.paymentDetail, cashAmount: interestDetail.amountPaid - unsecureInterestPayload.amountPaid} :
                {...interestDetail.paymentDetail, bankAmount: interestDetail.amountPaid - unsecureInterestPayload.amountPaid}
        };

        await Promise.all([
            UnsecureInterestLoanModel.create({
                loan: unsecureLoanId,
                ...unsecureInterestPayload
            }),
            SecureInterestLoanModel.create({
                loan: secureLoanId,
                ...secureInterestPayload
            }),
        ]);

        // Update next and last installment dates for both loans
        const updateData = {
            nextInstallmentDate,
            lastInstallmentDate,
        };

        const populateOptions = [
            {path: 'scheme'},
            {path: 'customer', populate: {path: 'branch'}},
            {path: 'company'},
        ];

        await Promise.all([
            UnsecureIssuedLoanModel.findByIdAndUpdate(unsecureLoanId, updateData, {new: true}).populate(populateOptions),
            SecureIssuedLoanModel.findByIdAndUpdate(secureLoanId, updateData, {new: true}).populate(populateOptions),
        ]);
    } catch (error) {
        console.error('Error processing unsecure loan interest:', error.message);
        throw error;
    }
}

module.exports = {secure_unsecureLoanInterest};
