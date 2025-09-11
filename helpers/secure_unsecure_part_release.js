const UnsecureIssuedLoanModel = require("../models/unsecure-issued-loan");
const SecureIssuedLoanModel = require("../models/secure-issued-loan");
const UnsecurePartReleaseModel = require("../models/unsecure-part-release");
const SecurePartReleaseModel = require("../models/secure-part-release");


async function secureUnsecurePartRelease(loan, propertyImage, payload, interestLoanAmount, finalProperty) {
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
        const unsecurePartReleasePayload = {
            ...payload,
            loan: secureLoanId,
            propertyImage,
            amountPaid: ((consultingCharge / 1.25) * payload.amountPaid),
            adjustedAmount: ((consultingCharge / 1.25) * payload.adjustedAmount),
            interestLoanAmount: ((consultingCharge / 1.25) * payload.interestLoanAmount),
            pendingLoanAmount: ((consultingCharge / 1.25) * payload.pendingLoanAmount),
            paymentDetail: {
                paymentMode: "Cash",
                cashAmount: ((consultingCharge / 1.25) * payload.adjustedAmount)
            }
        };

        const securePartReleasePayload = {
            ...payload,
            loan: secureLoanId,
            propertyImage,
            adjustedAmount: (payload.adjustedAmount - unsecurePartReleasePayload.adjustedAmount),
            pendingLoanAmount: (payload.pendingLoanAmount - unsecurePartReleasePayload.pendingLoanAmount),
            amountPaid: (payload.amountPaid - unsecurePartReleasePayload.amountPaid),
            interestLoanAmount: (payload.interestLoanAmount - unsecurePartReleasePayload.interestLoanAmount),
            paymentDetail: payload.paymentDetail.paymentMode === 'Cash' ? {
                ...payload.paymentDetail, cashAmount: payload.adjustedAmount - unsecurePartReleasePayload.adjustedAmount
            } : {
                ...payload.paymentDetail, bankAmount: payload.adjustedAmount - unsecurePartReleasePayload.adjustedAmount
            }
        };

        await Promise.all([UnsecurePartReleaseModel.create({
            loan: unsecureLoanId, ...unsecurePartReleasePayload
        }), SecurePartReleaseModel.create({
            loan: secureLoanId, ...securePartReleasePayload
        }),]);


        const populateOptions = [{path: 'scheme'}, {path: 'customer', populate: {path: 'branch'}}, {path: 'company'},];

        const updatedUnSecuredLoanInterestAmount = ((consultingCharge / 1.25) * interestLoanAmount);
        const updatedSecuredLoanInterestAmount = interestLoanAmount - updatedUnSecuredLoanInterestAmount;

        await Promise.all([UnsecureIssuedLoanModel.findByIdAndUpdate(unsecureLoanId, {
            interestLoanAmount: updatedUnSecuredLoanInterestAmount, propertyDetails: finalProperty
        }, {new: true}).populate(populateOptions), SecureIssuedLoanModel.findByIdAndUpdate(secureLoanId, {
            interestLoanAmount: updatedSecuredLoanInterestAmount, propertyDetails: finalProperty
        }, {new: true}).populate(populateOptions),]);
    } catch (error) {
        console.error('Error processing unsecure loan part release:', error.message);
        throw error;
    }
}

module.exports = {secureUnsecurePartRelease};